// The web Copy exporter strips attributes but leaves the citation badge's
// exact wrapper tree: three spans, a row, an empty favicon slot, a label and
// optionally a +N count. Match that structure, never source names in prose.
function isExportedCitation(row) {
  if (row.attributes.length || row.closest('pre, code, a, svg, math')) return false;
  const onlyElements = el => [...el.childNodes].every(n => n.nodeType === 1 || !n.textContent.trim());
  const bare = (el, tag) => el?.tagName === tag && el.attributes.length === 0;
  const single = (el, tag) => onlyElements(el) && el.children.length === 1 && bare(el.firstElementChild, tag);
  let wrapper = row;
  let wrapped = true;
  for (let i = 0; i < 3; i++) {
    const parent = wrapper.parentElement;
    if (!bare(parent, 'SPAN') || !single(parent, wrapper.tagName)) { wrapped = false; break; }
    wrapper = parent;
  }
  if (!wrapped) {
    // HTML parsing moves a div out of a paragraph, leaving the three empty
    // spans at its end and an empty closing paragraph immediately after it.
    const before = row.previousElementSibling, after = row.nextElementSibling;
    let tail = before?.lastElementChild;
    if (before?.tagName !== 'P' || !bare(after, 'P') || after.childNodes.length ||
        before.lastChild !== tail) return false;
    for (let i = 0; i < 2; i++) {
      if (!bare(tail, 'SPAN') || !single(tail, 'SPAN')) return false;
      tail = tail.firstElementChild;
    }
    if (!bare(tail, 'SPAN') || tail.childNodes.length) return false;
    wrapper = row;
  }
  if (!onlyElements(row) || ![2, 3].includes(row.children.length)) return false;
  const [icon, label, count] = row.children;
  if (![...row.children].every(el => bare(el, 'SPAN'))) return false;
  if (!single(icon, 'DIV') || icon.firstElementChild.childNodes.length) return false;
  const textSlot = el => single(el, 'SPAN') && el.firstElementChild.children.length === 0;
  if (!textSlot(label) || !label.textContent.trim()) return false;
  if (count && (!textSlot(count) || !/^\+\d+$/.test(count.textContent.trim()))) return false;
  return wrapper;
}

// ChatGPT's rendered answers use semantic data attributes on spans, rather
// than <strong>. Convert those explicit marks before Obsidian's HTML converter.
function normalizeRichHtml(html) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  let changed = false;
  for (const row of doc.body.querySelectorAll('div')) {
    const wrapper = isExportedCitation(row);
    if (wrapper) { wrapper.remove(); changed = true; }
  }
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
    let target = el;
    if (strong && !el.closest("strong")) {
      const mark = doc.createElement("strong");
      mark.append(...el.childNodes);
      el.replaceWith(mark);
      target = mark;
      changed = true;
    }
    if (emphasis && !target.closest("em")) {
      const mark = doc.createElement("em");
      target.before(mark);
      mark.append(target);
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

module.exports = { normalizeRichHtml };
