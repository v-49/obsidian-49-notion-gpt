const { normalizeRichHtml } = require('../src/rich-html');

function findAnswer(button) {
  for (let node = button.parentElement, depth = 0; node && depth < 10; node = node.parentElement, depth++) {
    const roots = node.querySelectorAll('[data-dil-message-id], [data-message-author-role="assistant"] .markdown');
    if (roots.length === 1) return roots[0];
    if (roots.length > 1) return null;
  }
  return null;
}

function payloadFor(root) {
  const html = normalizeRichHtml(root.outerHTML).html;
  return { html, text: root.innerText || root.textContent || '' };
}

function installCopyFix(doc, clipboard = doc.defaultView.navigator.clipboard) {
  const win = doc.defaultView;
  const replaying = new WeakSet();
  const timers = new Set();
  const click = event => {
    if (!event.isTrusted) return;
    const button = event.target.closest?.('button');
    if (!button || replaying.has(button)) return;
    const name = button.getAttribute('aria-label') || button.getAttribute('title') || '';
    if (!/^(Copy|复制)$/.test(name)) return;
    const root = findAnswer(button);
    if (!root) return;
    const payload = payloadFor(root);
    if (!payload.text.trim()) return;
    // Only a deliberate answer-copy click on chatgpt.com is intercepted. No
    // clipboard reading, background requests, storage, or access to other tabs.
    event.preventDefault();
    event.stopImmediatePropagation();
    const fallback = () => {
      replaying.add(button);
      button.click();
      replaying.delete(button);
    };
    try {
      const item = new win.ClipboardItem({
        'text/html': new win.Blob([payload.html], {type:'text/html'}),
        'text/plain': new win.Blob([payload.text], {type:'text/plain'}),
      });
      clipboard.write([item]).then(() => {
        if (!button.isConnected) return;
        button.setAttribute('title', '已保留样式复制');
        button.setAttribute('data-fng-copy-complete', 'true');
        const timer = win.setTimeout(() => {
          timers.delete(timer);
          if (button.getAttribute('title') === '已保留样式复制') button.removeAttribute('title');
          button.removeAttribute('data-fng-copy-complete');
        }, 1800);
        timers.add(timer);
      }).catch(fallback);
    } catch { fallback(); }
  };
  const copy = event => {
    if (!event.isTrusted || !event.clipboardData) return;
    const selection = win.getSelection();
    if (!selection?.rangeCount || selection.isCollapsed) return;
    const range = selection.getRangeAt(0);
    const anchor = range.commonAncestorContainer.nodeType === 1 ? range.commonAncestorContainer : range.commonAncestorContainer.parentElement;
    if (!anchor?.closest('[data-dil-message-id], [data-message-author-role="assistant"]')) return;
    const holder = doc.createElement('div');
    holder.append(range.cloneContents());
    event.clipboardData.setData('text/html', normalizeRichHtml(holder.innerHTML).html);
    event.clipboardData.setData('text/plain', selection.toString());
    event.preventDefault();
  };
  doc.addEventListener('click', click, true);
  doc.addEventListener('copy', copy, true);
  return () => {
    doc.removeEventListener('click', click, true);
    doc.removeEventListener('copy', copy, true);
    for (const timer of timers) win.clearTimeout(timer);
  };
}

module.exports = { findAnswer, payloadFor, installCopyFix };
