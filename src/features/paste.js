const { htmlToMarkdown } = require("obsidian");
const { Feature } = require('../feature');

// ChatGPT's rendered answers use semantic data attributes on spans, rather
// than <strong>. Convert those explicit marks before Obsidian's HTML converter.
function normalizeRichHtml(html) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  let changed = false;
  // Citation popovers are web controls, not part of the quoted prose. Do not
  // strip real hyperlinks or matching words occurring in ordinary paragraphs.
  for (const control of doc.body.querySelectorAll('[data-d-component="popover-trigger"][role="button"]')) {
    if (control.querySelector('[data-d-component="badge"] [data-d-component="favicon"]') &&
        !control.querySelector('a[href]')) {
      control.remove();
      changed = true;
    }
  }
  for (const el of doc.body.querySelectorAll("span, b, i")) {
    if (el.closest("pre, code, svg, math")) continue;
    const weight = el.style.fontWeight;
    const strong = el.hasAttribute("data-d-default-strong") ||
      ["bold", "semibold"].includes(el.getAttribute("data-d-weight")) ||
      weight === "bold" || Number.parseInt(weight, 10) >= 600;
    const emphasis = el.hasAttribute("data-d-default-em") || el.style.fontStyle === "italic";
    if (strong && !el.closest("strong")) {
      const mark = doc.createElement("strong");
      mark.append(...el.childNodes);
      el.append(mark);
      changed = true;
    }
    if (emphasis && !el.closest("em")) {
      const mark = doc.createElement("em");
      mark.append(...el.childNodes);
      el.append(mark);
      changed = true;
    }
  }
  // Represent bordered web content with editable native Obsidian callouts.
  // Structural HTML survives the native image-import path as well as the
  // direct converter; no custom source-text placeholders are required.
  for (const box of [...doc.body.querySelectorAll('[data-d-component="box"][data-d-has-border]')].reverse()) {
    if (box.closest('pre, code, svg, math') || !box.textContent.trim()) continue;
    const card = doc.createElement('blockquote');
    const marker = doc.createElement('p');
    marker.textContent = '[!web-card]';
    card.append(marker);
    let row = null;
    for (const child of [...box.childNodes]) {
      if (child.nodeType !== 1) { (row || card).append(child); continue; }
      if (child.matches('[data-d-component="divider"]')) {
        card.append(doc.createElement('hr'));
        row = null;
      } else if (child.matches('[data-d-component="row"]') && child.querySelector('[data-d-component="icon"]')) {
        const icon = child.querySelector('[data-d-component="icon"]');
        const lucide = [...icon.classList].find(name => /^lucide-[a-z-]+$/.test(name));
        // This renderer also has a filled search icon without a named class.
        const search = icon.querySelector('path')?.getAttribute('d')?.startsWith('M10.875 4.5');
        const name = lucide ? lucide.slice(7) : search ? 'search' : 'info';
        icon.remove();
        row = doc.createElement('blockquote');
        const heading = doc.createElement('p');
        heading.textContent = `[!web-row|${name}] ${child.textContent.trim().replace(/\s+/g, ' ')}`;
        row.append(heading);
        card.append(row);
      } else {
        (row || card).append(child);
      }
    }
    box.replaceWith(card);
    changed = true;
  }
  return { html: changed ? doc.body.innerHTML : html, changed };
}

// Tighten only complete, flat, single-line lists. Nested items and continuation
// paragraphs are left intact, including indented code and deliberate paragraphs.
function tightenSimpleLists(lines) {
  let fence = null;
  const item = line => line.match(/^([-+*]|\d+[.)])\s+\S/);
  const kind = match => /^\d/.test(match[1]) ? "ordered" : match[1];
  for (let i = 0; i < lines.length; i++) {
    const marker = lines[i].match(/^ {0,3}(`{3,}|~{3,})/);
    if (marker) {
      if (!fence) fence = marker[1];
      else if (marker[1][0] === fence[0] && marker[1].length >= fence.length &&
        lines[i].trim() === marker[1]) fence = null;
      continue;
    }
    if (fence) continue;
    const first = item(lines[i]);
    if (!first) continue;
    let end = i + 1, count = 1, complex = false;
    for (; end < lines.length; end++) {
      const next = item(lines[end]);
      if (!lines[end].trim()) continue;
      if (next && kind(next) === kind(first)) { count++; continue; }
      if (/^\s+\S/.test(lines[end])) complex = true;
      break;
    }
    if (!complex && count > 1) {
      let last = end - 1;
      while (last > i && !lines[last].trim()) last--;
      const compact = lines.slice(i, last + 1).filter(line => line.trim());
      lines.splice(i, last - i + 1, ...compact);
      i += compact.length - 1;
    } else {
      // Skip the entire complex list, including any following nested content.
      while (end < lines.length && (!lines[end].trim() || /^\s+\S/.test(lines[end]) || item(lines[end]))) end++;
      i = end - 1;
    }
  }
  return lines;
}

function compactMarkdown(markdown) {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  const result = [];
  let fence = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const fenceMatch = line.match(/^\s*(`{3,}|~{3,})/);
    if (fenceMatch) {
      const marker = fenceMatch[1];
      if (fence === null) fence = marker;
      else if (marker[0] === fence[0] && marker.length >= fence.length && line.trim() === marker) fence = null;
      result.push(line);
      continue;
    }
    if (fence !== null) {
      result.push(line);
      continue;
    }

    // A quote-only line before ordinary text is a paste artifact. Keep the
    // paragraph separator so Markdown does not absorb that text into the quote.
    if (/^>\s*$/.test(line)) {
      let next = i + 1;
      while (next < lines.length && lines[next].trim() === "") next++;
      if (next === lines.length || !/^\s*>/.test(lines[next])) {
        if (next < lines.length && lines[i + 1]?.trim() !== "") result.push("");
        continue;
      }
    }

    // Do not compact blank lines inside an indented code block.
    if (/^ {4}\S|^\t\S/.test(line)) { result.push(line); continue; }
    if (line.trim() === "" && result.at(-1)?.trim() === "") {
      let before = result.length - 1, after = i + 1;
      while (before >= 0 && !result[before].trim()) before--;
      while (after < lines.length && !lines[after].trim()) after++;
      if (!(/^ {4}\S|^\t\S/.test(result[before] || "") && /^ {4}\S|^\t\S/.test(lines[after] || ""))) continue;
    }
    result.push(line.trim() === "" ? "" : line);
  }

  return tightenSimpleLists(result).join("\n").replace(/^\n+|\n+$/g, "");
}

module.exports = class CompactRichPaste extends Feature {
  onload() {
    const normalizedPastes = new WeakSet();
    this.registerEvent(this.app.workspace.on("editor-paste", (event, editor) => {
      if (normalizedPastes.has(event)) return;
      if (event.defaultPrevented || !event.clipboardData || event.clipboardData.files.length) return;
      const html = event.clipboardData.getData("text/html");
      if (!html) return;

      try {
        const normalized = normalizeRichHtml(html);
        // Keep Obsidian's native import path for embedded media and math. Replay
        // only the semantic HTML fix, without replacing or dropping those assets.
        if (/<(?:img|svg|math)\b/i.test(normalized.html)) {
          if (!normalized.changed || !event.target?.dispatchEvent) return;
          const data = new DataTransfer();
          for (const type of event.clipboardData.types) {
            data.setData(type, type === "text/html" ? normalized.html : event.clipboardData.getData(type));
          }
          const replay = new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true });
          normalizedPastes.add(replay);
          event.preventDefault();
          event.stopPropagation();
          event.target.dispatchEvent(replay);
          return;
        }
        const original = htmlToMarkdown(normalized.html);
        const compact = compactMarkdown(original);
        if (!normalized.changed && compact === original) return;
        event.preventDefault();
        editor.replaceSelection(compact);
      } catch (error) {
        console.error("Compact Rich Paste could not process this paste", error);
      }
    }));
  }
};

module.exports.compactMarkdown = compactMarkdown;
module.exports.normalizeRichHtml = normalizeRichHtml;
