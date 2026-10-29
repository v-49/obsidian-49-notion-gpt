const { Menu, Notice } = require('obsidian');
const { Feature } = require('../feature');
const ALIGNMENTS = [
  ['left', '图片左对齐', 'align-left'],
  ['center', '图片居中', 'align-center'],
  ['right', '图片右对齐', 'align-right'],
];

// A bounded, stable key avoids storing whole data-URI images in plugin data.
function imageKey(src) {
  let a = 2166136261, b = 5381;
  for (let i = 0; i < src.length; i++) {
    a = Math.imul(a ^ src.charCodeAt(i), 16777619);
    b = Math.imul(b, 33) ^ src.charCodeAt(i);
  }
  return `${src.length}:${(a >>> 0).toString(16)}:${(b >>> 0).toString(16)}`;
}

function describeImage(img, view) {
  const root = view.containerEl;
  if (!root.contains(img) || img.closest('table, .metadata-container, .callout-icon, .embed-actions, .cm-tooltip, .markdown-embed')) return null;
  const embed = img.closest('.image-embed');
  const line = img.closest('.cm-line, p');
  // Images within a sentence retain inline layout. A native block image has
  // no enclosing paragraph/line with ordinary text.
  if (line?.textContent.trim()) return null;
  if (!embed && !img.closest('.markdown-preview-view, .cm-content')) return null;
  const host = embed || (img.parentElement?.tagName === 'A' ? img.parentElement : img);
  let src = embed?.getAttribute('src') || img.getAttribute('src');
  if (!src) return null;
  if (/^(?:app|file):/.test(src)) src = src.split('?')[0];
  return { img, host, view, path: view.file.path, key: imageKey(src) };
}

module.exports = class ImageAlignment extends Feature {
  async onload() {
    this.disposed = false;
    this.records = new Map();
    this.documents = new Map();
    this.menus = new WeakSet();
    this.timerWindow = this.app.workspace.containerEl.ownerDocument.defaultView;
    const saved = await this.loadData();
    if (this.disposed) return;
    this.data = saved?.version === 1 && saved.files ? saved : { version: 1, files: {} };
    for (const name of ['layout-change', 'file-open', 'editor-change']) {
      this.registerEvent(this.app.workspace.on(name, () => this.scheduleScan()));
    }
    // These hooks augment native local-file and URL menus when available.
    for (const name of ['file-menu', 'url-menu', 'editor-menu']) {
      this.registerEvent(this.app.workspace.on(name, menu => {
        if (this.context && Date.now() - this.context.time < 1000) {
          this.addMenu(menu, this.context.info);
          this.context.handled = true;
        }
      }));
    }
    this.registerEvent(this.app.vault.on('rename', (file, old) => {
      for (const path of Object.keys(this.data.files)) {
        if (path === old || path.startsWith(old + '/')) {
          this.data.files[file.path + path.slice(old.length)] = this.data.files[path];
          delete this.data.files[path];
        }
      }
      this.persist();
      this.scheduleScan();
    }));
    this.registerMarkdownPostProcessor(() => this.scheduleScan());
    this.app.workspace.onLayoutReady(() => { if (!this.disposed) this.scan(); });
  }

  scheduleScan() {
    if (this.disposed) return;
    this.timerWindow.clearTimeout(this.scanTimer);
    this.scanTimer = this.timerWindow.setTimeout(() => this.scan(), 70);
  }

  scan() {
    if (this.disposed) return;
    const seen = new Set(), docs = new Set();
    for (const leaf of this.app.workspace.getLeavesOfType('markdown')) {
      const view = leaf.view;
      if (!view.file) continue;
      const doc = view.containerEl.ownerDocument;
      docs.add(doc);
      this.bindDocument(doc);
      for (const img of view.containerEl.querySelectorAll('.image-embed img, .markdown-preview-view img, .cm-content img')) {
        const info = describeImage(img, view);
        if (!info) continue;
        seen.add(img);
        const previous = this.records.get(img);
        if (previous && previous.host !== info.host) this.restore(previous);
        this.records.set(img, info);
        this.apply(info);
      }
    }
    for (const [img, info] of this.records) {
      if (!seen.has(img)) { this.restore(info); this.records.delete(img); }
    }
    for (const [doc, cleanup] of this.documents) {
      if (!docs.has(doc)) { cleanup(); this.documents.delete(doc); }
    }
  }

  bindDocument(doc) {
    if (this.documents.has(doc)) return;
    const contextmenu = event => {
      const target = event.target;
      const img = target.closest?.('img') || target.closest?.('.image-embed')?.querySelector('img');
      const info = img && this.records.get(img);
      this.context = info ? { info, time: Date.now() } : null;
      if (!info) return;
      const context = this.context;
      // Obsidian's image widgets use the public, event-scoped Menu.forEvent.
      // Attach after their handlers, before its scheduled display. This also
      // handles pasted data-URI SVGs, which do not emit a local-file menu hook.
      doc.defaultView.queueMicrotask(() => {
        if (!this.disposed && this.context === context && !context.handled && info.img.isConnected) {
          this.addMenu(Menu.forEvent(event), info);
        }
      });
    };
    doc.addEventListener('contextmenu', contextmenu, true);
    const observer = new doc.defaultView.MutationObserver(records => {
      if (records.some(record => record.type === 'attributes' ||
        [...record.addedNodes, ...record.removedNodes].some(node => node.nodeType === 1 &&
          (node.matches('img, .image-embed') || node.querySelector('img'))))) this.scheduleScan();
    });
    observer.observe(doc.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['src'] });
    this.documents.set(doc, () => { doc.removeEventListener('contextmenu', contextmenu, true); observer.disconnect(); });
  }

  alignment(info) {
    const value = this.data.files[info.path]?.[info.key];
    return ALIGNMENTS.some(([key]) => key === value) ? value : 'center';
  }

  apply(info) {
    info.host.classList.add('fng-aligned-image');
    info.host.setAttribute('data-fng-image-align', this.alignment(info));
  }

  restore(info) {
    info.host.classList.remove('fng-aligned-image');
    info.host.removeAttribute('data-fng-image-align');
  }

  addMenu(menu, info) {
    if (this.menus.has(menu) || !info.img.isConnected) return;
    this.menus.add(menu);
    const current = this.alignment(info);
    for (const [alignment, title, icon] of ALIGNMENTS) {
      menu.addItem(item => item.setSection('image').setTitle(title).setIcon(icon)
        .setChecked(current === alignment).onClick(() => this.setAlignment(info, alignment)));
    }
  }

  setAlignment(info, alignment) {
    if (this.disposed || !ALIGNMENTS.some(([key]) => key === alignment)) return;
    // File paths are object keys, so never rely on an inherited property.
    if (!Object.hasOwn(this.data.files, info.path)) {
      Object.defineProperty(this.data.files, info.path, { value: {}, enumerable: true, configurable: true, writable: true });
    }
    this.data.files[info.path][info.key] = alignment;
    for (const other of this.records.values()) {
      if (other.path === info.path && other.key === info.key) this.apply(other);
    }
    this.persist();
  }

  persist() {
    this.saveData(this.data).catch(error => {
      console.error('49: image alignment could not be saved', error);
      if (!this.disposed) new Notice('图片对齐保存失败，请检查仓库是否可写。');
    });
  }

  onunload() {
    this.disposed = true;
    this.timerWindow.clearTimeout(this.scanTimer);
    for (const cleanup of this.documents.values()) cleanup();
    for (const info of this.records.values()) this.restore(info);
    this.records.clear();
    this.documents.clear();
    this.context = null;
  }
};
module.exports.imageKey = imageKey;
module.exports.describeImage = describeImage;
