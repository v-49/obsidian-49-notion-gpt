const { htmlToMarkdown } = require("obsidian");
const { Feature } = require('../feature');

const { normalizeRichHtml } = require('../rich-html');

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
