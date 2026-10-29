/* Local extension. No network, Markdown rewriting, or replacement table editor. */
const { MarkdownView, Notice } = require('obsidian');
const { Feature } = require('../feature');
const MIN = 56;
const MAX = 4096;
const clamp = n => Math.round(Math.max(MIN, Math.min(MAX, n)));
const validWidths = (w, n) => Array.isArray(w) && w.length === n && w.every(x => Number.isFinite(x) && x >= MIN && x <= MAX);

// Source anchors disambiguate equal headers even when Live Preview virtualizes tables.
function tablesIn(text) {
  const lines = text.split('\n'), result = [], counts = new Map();
  let fence = null;
  for (let i = 0; i + 1 < lines.length; i++) {
    const f = lines[i].match(/^\s{0,3}(`{3,}|~{3,})/);
    if (f) { if (!fence) fence = f[1]; else if (f[1][0] === fence[0] && f[1].length >= fence.length) fence = null; continue; }
    if (fence || !lines[i].includes('|')) continue;
    const separator = lines[i + 1].trim().replace(/^\|/, '').replace(/\|$/, '');
    if (!/^\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*$/.test(separator)) continue;
    const header = lines[i].trim().replace(/^\|/, '').replace(/\|$/, '').trim().replace(/\s*\|\s*/g, '|');
    const occurrence = counts.get(header) || 0;
    counts.set(header, occurrence + 1);
    let end = i + 1;
    while (end + 1 < lines.length && lines[end + 1].trim() && lines[end + 1].includes('|')) end++;
    result.push({ start: i, end, key: JSON.stringify([header, occurrence]) });
    i = end;
  }
  return result;
}

module.exports = class NativeTableResize extends Feature {
  async onload() {
    this.documents = new Map();
    this.states = new Map();
    this.sections = new WeakMap();
    this.sources = new Map();
    this.disposed = false;
    this.timerWindow = this.app.workspace.containerEl.ownerDocument.defaultView;
    this.writeQueue = Promise.resolve();
    const saved = await this.loadData();
    if (this.disposed) return;
    this.data = saved?.version === 1 && saved.files ? saved : { version: 1, files: {} };
    this.registerMarkdownPostProcessor((el, ctx) => {
      for (const table of el.querySelectorAll('table')) {
        const section = ctx.getSectionInfo(table);
        if (section) this.sections.set(table, { path: ctx.sourcePath, line: section.lineStart });
      }
      this.scheduleScan();
    });
    this.registerEvent(this.app.workspace.on('layout-change', () => this.scheduleScan()));
    this.registerEvent(this.app.workspace.on('file-open', () => this.scheduleScan()));
    this.registerEvent(this.app.workspace.on('editor-change', () => this.scheduleScan()));
    this.registerEvent(this.app.vault.on('modify', file => { this.sources.delete(file.path); this.scheduleScan(); }));
    this.registerEvent(this.app.vault.on('rename', (file, old) => {
      for (const path of Object.keys(this.data.files)) {
        if (path === old || path.startsWith(old + '/')) {
          this.data.files[file.path + path.slice(old.length)] = this.data.files[path];
          delete this.data.files[path];
        }
      }
      this.sources.clear(); this.persist(); this.scheduleScan();
    }));
    this.addCommand({ id: 'focus-column-resize', name: '调整当前表格列宽', checkCallback: checking => {
      const view = this.app.workspace.getActiveViewOfType(MarkdownView);
      if (!view?.file) return false;
      if (!checking) {
        const tables = [...this.states.values()].filter(s => s.view === view && s.table.isConnected);
        const line = view.editor?.getCursor()?.line;
        const state = tables.find(s => s.anchor && line >= s.anchor.start && line <= s.anchor.end) || tables[0];
        if (state) { const ui = this.documents.get(state.table.ownerDocument); this.show(ui, state); ui.handles[0]?.focus(); }
        else new Notice('请先让要调整的表格显示在页面中。');
      }
      return true;
    }});
    this.addCommand({ id: 'reset-note-widths', name: '重置当前笔记的表格列宽', checkCallback: checking => {
      const view = this.app.workspace.getActiveViewOfType(MarkdownView);
      if (!view?.file) return false;
      if (!checking) {
        for (const ui of this.documents.values()) if (ui.drag) this.finish(ui, true);
        delete this.data.files[view.file.path];
        for (const s of this.states.values()) if (s.path === view.file.path) this.restore(s);
        this.persist(); this.scheduleScan();
        new Notice('已恢复当前笔记的自动列宽。');
      }
      return true;
    }});
    this.app.workspace.onLayoutReady(() => { if (!this.disposed) this.scan(); });
  }

  persist() {
    // Serialize writes: a slow earlier drag must never overwrite a later one.
    const snapshot = JSON.parse(JSON.stringify(this.data));
    this.writeQueue = this.writeQueue.then(() => this.saveData(snapshot)).catch(() => {
      if (!this.disposed) new Notice('列宽保存失败，请检查仓库是否可写。');
    });
  }

  scheduleScan() {
    if (this.disposed) return;
    this.timerWindow.clearTimeout(this.scanTimer);
    this.scanTimer = this.timerWindow.setTimeout(() => this.scan(), 70);
  }

  async scan() {
    if (this.disposed || this.scanning) { this.rescan = true; return; }
    this.scanning = true;
    try {
      const leaves = this.app.workspace.getLeavesOfType('markdown');
      for (const leaf of leaves) {
        const view = leaf.view, file = view.file;
        if (!file) continue;
        const doc = view.containerEl.ownerDocument;
        this.bindDocument(doc);
        let text;
        if (view.getMode?.() === 'source' && view.editor) text = view.editor.getValue();
        else {
          text = this.sources.get(file.path);
          if (text === undefined) {
            try { text = await this.app.vault.cachedRead(file); this.sources.set(file.path, text); } catch { continue; }
          }
        }
        if (this.disposed) return;
        const anchors = tablesIn(text);
        const tables = view.containerEl.querySelectorAll('.cm-table-widget table, .markdown-preview-view table');
        for (const table of tables) {
          // Embedded notes and HTML/merged tables have different identities and are left alone.
          if (table.closest('.internal-embed') || !table.rows[0] || table.querySelector('[colspan], [rowspan]') ||
            table.querySelector(':scope > colgroup:not([data-ntr])')) continue;
          let line = this.sections.get(table)?.line;
          if (table.closest('.cm-table-widget')) {
            try {
              const cm = view.editor?.cm;
              if (cm?.posAtDOM) line = cm.state.doc.lineAt(cm.posAtDOM(table.closest('.cm-table-widget'))).number - 1;
            } catch { /* In an unmounted widget, keep resizing session-only. */ }
          }
          const anchor = Number.isFinite(line) ? anchors.find(a => line >= a.start && line <= a.end) : null;
          let s = this.states.get(table);
          if (s && (s.path !== file.path || s.count !== table.rows[0].cells.length || s.key !== anchor?.key)) {
            const ui = this.documents.get(doc);
            if (ui.drag?.s === s) this.finish(ui, true);
            this.restore(s); this.states.delete(table); s = null;
          }
          if (!s) {
            s = { table, view, path: file.path, key: anchor?.key, anchor, count: table.rows[0].cells.length,
              originalVar: table.style.getPropertyValue('--ntr-width'), originalPriority: table.style.getPropertyPriority('--ntr-width') };
            this.states.set(table, s);
          }
          s.anchor = anchor;
          const widths = s.key && this.data.files[s.path]?.[s.key];
          const dragging = [...this.documents.values()].some(ui => ui.drag?.s === s);
          if (!dragging && validWidths(widths, s.count) && s.widths?.join() !== widths.join()) this.apply(s, widths);
        }
      }
      for (const [table, s] of this.states) if (!table.isConnected) {
        const ui = this.documents.get(table.ownerDocument);
        if (ui?.drag?.s === s) this.finish(ui, true);
        if (ui?.s === s) this.hide(ui);
        this.states.delete(table);
      }
      for (const ui of this.documents.values()) if (ui.s) this.position(ui);
    } finally {
      this.scanning = false;
      if (this.rescan) { this.rescan = false; this.scheduleScan(); }
    }
  }

  bindDocument(doc) {
    if (this.documents.has(doc)) return;
    const win = doc.defaultView, root = doc.createElement('div');
    root.className = 'ntr-overlay'; doc.body.append(root);
    const label = doc.createElement('div'); label.className = 'ntr-width-label'; label.hidden = true; root.append(label);
    const ui = { doc, win, root, label, handles: [], s: null, drag: null };
    this.documents.set(doc, ui);
    this.registerDomEvent(doc, 'pointermove', e => {
      if (ui.drag) { if (e.pointerId === ui.drag.pointerId) { ui.drag.x = e.clientX; this.queueFrame(ui); } return; }
      if (root.contains(e.target) || root.contains(doc.activeElement)) return;
      const table = e.target.closest?.('table'), s = this.states.get(table);
      if (s && !doc.querySelector('.modal-container')) this.show(ui, s); else this.hide(ui);
    }, { capture: true });
    this.registerDomEvent(doc, 'pointerup', e => { if (ui.drag?.pointerId === e.pointerId) this.finish(ui, false); }, true);
    this.registerDomEvent(doc, 'pointercancel', () => this.finish(ui, true), true);
    this.registerDomEvent(doc, 'keydown', e => {
      if (ui.drag && e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); this.finish(ui, true); }
    }, true);
    this.registerDomEvent(win, 'blur', () => { this.finish(ui, true); this.hide(ui); });
    this.registerDomEvent(doc, 'scroll', () => { if (ui.s) this.queueFrame(ui); }, true);
    this.registerDomEvent(win, 'resize', () => { if (ui.s) this.queueFrame(ui); });
    this.registerDomEvent(doc, 'pointerdown', e => {
      if (!root.contains(e.target) && !ui.drag) this.hide(ui);
    }, true);
    const observer = new win.MutationObserver(records => {
      if (records.some(r => !root.contains(r.target) && !r.target.closest?.('colgroup[data-ntr]') &&
        [...r.addedNodes, ...r.removedNodes].some(n => n.nodeType === 1 && (n.matches?.('table, .cm-table-widget, .markdown-preview-view') || n.querySelector?.('table'))))) this.scheduleScan();
    });
    observer.observe(doc.body, { childList: true, subtree: true });
    this.register(() => observer.disconnect());
  }

  show(ui, s) {
    if (!ui || ui.drag) return;
    if (ui.s !== s || ui.handles.length !== s.count) {
      this.hide(ui); ui.s = s;
      for (let i = 0; i < s.count; i++) {
        const h = ui.doc.createElement('div'); h.className = 'ntr-handle'; h.tabIndex = 0;
        h.setAttribute('role', 'separator'); h.setAttribute('aria-orientation', 'vertical');
        h.setAttribute('aria-label', `第 ${i + 1} 列宽度`);
        h.setAttribute('aria-valuemin', MIN); h.setAttribute('aria-valuemax', MAX);
        h.title = '拖动调整列宽；双击适应内容；方向键调整，Shift 微调';
        h.addEventListener('pointerdown', e => this.begin(ui, i, e));
        h.addEventListener('lostpointercapture', () => { if (ui.drag) this.finish(ui, true); });
        h.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); });
        h.addEventListener('dblclick', e => { e.preventDefault(); e.stopPropagation(); this.fit(ui, i); });
        h.addEventListener('keydown', e => {
          if (['ArrowLeft', 'ArrowRight'].includes(e.key)) {
            e.preventDefault(); e.stopPropagation();
            const widths = this.widths(s);
            widths[i] = clamp(widths[i] + (e.key === 'ArrowRight' ? 1 : -1) * (e.shiftKey ? 1 : 8));
            this.apply(s, widths); this.save(s); this.position(ui);
          } else if (e.key === 'Enter') { e.preventDefault(); this.fit(ui, i); }
          else if (e.key === 'Escape') { h.blur(); this.hide(ui); }
        });
        ui.root.append(h); ui.handles.push(h);
      }
    }
    this.position(ui);
  }

  hide(ui) {
    if (!ui || ui.drag) return;
    ui.handles.forEach(h => h.remove()); ui.handles = []; ui.s = null; ui.label.hidden = true;
  }

  clip(table) {
    const win = table.ownerDocument.defaultView;
    let left = 0, right = win.innerWidth, top = 0, bottom = win.innerHeight;
    for (let p = table.parentElement; p && p !== table.ownerDocument.body; p = p.parentElement) {
      const css = win.getComputedStyle(p), r = p.getBoundingClientRect();
      if (/(auto|scroll|hidden|clip)/.test(css.overflowX)) { left = Math.max(left, r.left); right = Math.min(right, r.right); }
      if (/(auto|scroll|hidden|clip)/.test(css.overflowY)) { top = Math.max(top, r.top); bottom = Math.min(bottom, r.bottom); }
    }
    return { left, right, top, bottom };
  }

  position(ui) {
    const s = ui.s;
    if (!s?.table.isConnected) { this.hide(ui); return; }
    const r = s.table.getBoundingClientRect(), clip = this.clip(s.table);
    const top = Math.max(r.top, clip.top), bottom = Math.min(r.bottom, clip.bottom);
    const widths = this.widths(s);
    ui.handles.forEach((h, i) => {
      const cell = s.table.rows[0]?.cells[i];
      if (!cell) { h.hidden = true; return; }
      const x = cell.getBoundingClientRect().right;
      h.hidden = ui.drag?.i !== i && (bottom <= top || x < clip.left + 3 || x > clip.right - 3);
      h.style.left = `${x - 6}px`; h.style.top = `${top}px`; h.style.height = `${Math.max(0, bottom - top)}px`;
      h.setAttribute('aria-valuenow', Math.round(widths[i]));
      if (ui.drag?.i === i) {
        ui.label.textContent = `${Math.round(widths[i])} px`;
        ui.label.style.left = `${Math.max(8, Math.min(x + 10, ui.win.innerWidth - 85))}px`;
        ui.label.style.top = `${Math.max(8, top - 30)}px`;
      }
    });
  }

  widths(s) { return s.widths?.slice() || Array.from(s.table.rows[0].cells, c => clamp(c.getBoundingClientRect().width)); }

  apply(s, widths) {
    if (!s.table.isConnected || !validWidths(widths, s.count)) return;
    let cols = s.table.querySelector(':scope > colgroup[data-ntr]');
    // Never take over a table already managed by another column-layout extension.
    if (!cols && s.table.querySelector(':scope > colgroup')) return;
    if (!cols) {
      cols = s.table.ownerDocument.createElement('colgroup'); cols.dataset.ntr = '1';
      for (let i = 0; i < s.count; i++) cols.append(s.table.ownerDocument.createElement('col'));
      s.table.prepend(cols);
    }
    widths = widths.map(clamp);
    widths.forEach((w, i) => cols.children[i].style.width = `${w}px`);
    s.table.style.setProperty('--ntr-width', `${widths.reduce((a, b) => a + b, 0)}px`);
    s.table.classList.add('ntr-fixed'); s.widths = widths;
  }

  restore(s) {
    s.table.querySelector(':scope > colgroup[data-ntr]')?.remove();
    s.table.classList.remove('ntr-fixed');
    if (s.originalVar) s.table.style.setProperty('--ntr-width', s.originalVar, s.originalPriority);
    else s.table.style.removeProperty('--ntr-width');
    s.widths = null;
  }

  begin(ui, i, e) {
    if (e.button !== 0 || !e.isPrimary || ui.drag) return;
    e.preventDefault(); e.stopPropagation();
    const s = ui.s, widths = this.widths(s), h = ui.handles[i];
    const scrollers = [];
    for (let p = s.table.parentElement; p; p = p.parentElement) scrollers.push({ el: p, left: p.scrollLeft });
    ui.drag = { s, i, startX: e.clientX, x: e.clientX, widths, wasFixed: !!s.widths, scrollers,
      pointerId: e.pointerId, h, moved: false };
    h.setPointerCapture(e.pointerId); h.classList.add('ntr-dragging');
    ui.doc.body.classList.add('ntr-resizing'); ui.label.hidden = false; this.position(ui);
  }

  queueFrame(ui) {
    if (ui.frame) return;
    ui.frame = ui.win.requestAnimationFrame(() => {
      ui.frame = 0;
      const d = ui.drag;
      if (d) {
        const dx = this.delta(d);
        if (Math.abs(dx) >= 2 || d.moved) {
          d.moved = true;
          const next = d.widths.slice(); next[d.i] = clamp(next[d.i] + dx);
          this.apply(d.s, next);
        }
      }
      this.position(ui);
    });
  }

  finish(ui, cancel) {
    const d = ui?.drag;
    if (!d) return;
    if (ui.frame) { ui.win.cancelAnimationFrame(ui.frame); ui.frame = 0; }
    ui.drag = null;
    if (cancel) { if (d.wasFixed) this.apply(d.s, d.widths); else this.restore(d.s); }
    else if (Math.abs(this.delta(d)) >= 2 || d.moved) {
      const next = d.widths.slice(); next[d.i] = clamp(next[d.i] + this.delta(d));
      this.apply(d.s, next); this.save(d.s);
    }
    if (d.h.hasPointerCapture(d.pointerId)) d.h.releasePointerCapture(d.pointerId);
    d.h.classList.remove('ntr-dragging'); ui.doc.body.classList.remove('ntr-resizing');
    ui.label.hidden = true; this.position(ui);
  }

  delta(d) { return d.x - d.startX + d.scrollers.reduce((sum, p) => sum + p.el.scrollLeft - p.left, 0); }

  save(s) {
    if (!s.key || !s.widths) return; // Unknown source position: never write ambiguous widths to another table.
    const files = this.data.files;
    if (!Object.hasOwn(files, s.path)) Object.defineProperty(files, s.path, { value: {}, enumerable: true, configurable: true, writable: true });
    files[s.path][s.key] = s.widths.slice();
    for (const other of this.states.values()) {
      if (other !== s && other.path === s.path && other.key === s.key && other.count === s.count && other.table.isConnected) {
        const ui = this.documents.get(other.table.ownerDocument);
        if (ui?.drag?.s !== other) this.apply(other, s.widths);
      }
    }
    for (const ui of this.documents.values()) if (ui.s) this.position(ui);
    this.persist();
  }

  fit(ui, i) {
    const s = ui.s;
    if (!s) return;
    let width = MIN;
    for (const row of s.table.rows) {
      const cell = row.cells[i]; if (!cell) continue;
      const content = cell.querySelector('.table-cell-wrapper') || cell;
      const clone = content.cloneNode(true), css = ui.win.getComputedStyle(content), cellCss = ui.win.getComputedStyle(cell);
      clone.querySelectorAll('.table-col-drag-handle, .table-row-drag-handle').forEach(n => n.remove());
      clone.classList.add('ntr-measure'); clone.style.font = css.font;
      clone.style.letterSpacing = css.letterSpacing;
      clone.style.padding = css.padding;
      ui.doc.body.append(clone);
      width = Math.max(width, clone.getBoundingClientRect().width + (content === cell ? 0 : parseFloat(cellCss.paddingLeft) + parseFloat(cellCss.paddingRight)) + 4);
      clone.remove();
    }
    const widths = this.widths(s); widths[i] = clamp(width);
    this.apply(s, widths); this.save(s); this.position(ui);
  }

  onunload() {
    this.disposed = true; this.timerWindow.clearTimeout(this.scanTimer);
    for (const ui of this.documents.values()) {
      this.finish(ui, true);
      if (ui.frame) ui.win.cancelAnimationFrame(ui.frame);
      ui.root.remove(); ui.doc.body.classList.remove('ntr-resizing');
    }
    for (const s of this.states.values()) this.restore(s);
    this.states.clear(); this.documents.clear();
  }
};
module.exports.tablesIn = tablesIn;
