"use strict";

const { Notice, setIcon } = require("obsidian");
const { Feature } = require('../feature');

// Each scroll container retains its own position. No file offsets or note
// contents are read, written, or shared between the two views.
class RelativeScrollSession {
  constructor(panes, onState = () => {}, onInvalid = () => {}) {
    this.panes = panes;
    this.onState = onState;
    this.onInvalid = onInvalid;
    this.positions = panes.map((pane) => pane.scrollTop);
    this.disposers = [];
    this.alt = false;
    this.independent = panes.map(() => ({ until: 0, enabled: false }));
    this.disposed = false;
    this.propagating = false;
    panes.forEach((pane, index) => {
      this.listen(pane, "scroll", () => this.scroll(index), { passive: true });
      this.listen(pane, "wheel", (event) => {
        this.independent[index] = { enabled: event.altKey, until: Date.now() + 220 };
        this.setAlt(event.altKey);
      }, { passive: true, capture: true });
    });
    const windows = new Set(panes.map((pane) => pane.ownerDocument.defaultView));
    for (const win of windows) {
      this.listen(win, "keydown", (event) => this.setAlt(event.altKey), true);
      this.listen(win, "keyup", (event) => this.setAlt(event.altKey), true);
      this.listen(win, "blur", () => {
        this.setAlt(false);
        this.independent.forEach((state) => { state.enabled = false; });
      });
    }
  }

  listen(target, name, fn, options) {
    target.addEventListener(name, fn, options);
    this.disposers.push(() => target.removeEventListener(name, fn, options));
  }

  setAlt(value) {
    if (this.alt !== value) {
      this.alt = value;
      this.onState(value);
    }
  }

  scroll(index) {
    if (this.disposed) return;
    if (this.panes.some((pane) => !pane.isConnected)) {
      this.onInvalid();
      return;
    }
    const source = this.panes[index];
    const delta = source.scrollTop - this.positions[index];
    this.positions[index] = source.scrollTop;
    const gesture = this.independent[index];
    const independent = this.alt || (gesture.enabled && Date.now() < gesture.until);
    if (this.propagating || independent || Math.abs(delta) < 0.01) return;
    const targetIndex = 1 - index;
    const target = this.panes[targetIndex];
    const max = Math.max(0, target.scrollHeight - target.clientHeight);
    this.propagating = true;
    try {
      target.scrollTop = Math.min(max, Math.max(0, target.scrollTop + delta));
      // Update before the asynchronously dispatched scroll event. Its echo
      // then has zero delta, preventing recursion and bounce at boundaries.
      this.positions[targetIndex] = target.scrollTop;
    } finally {
      this.propagating = false;
    }
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    for (const dispose of this.disposers.splice(0)) dispose();
  }
}

module.exports = class ScrollLockPlugin extends Feature {
  onload() {
    this.session = null;
    this.binding = null;
    this.actions = new Map();
    this.loaded = true;
    this.ribbon = this.addRibbonIcon("unlock", "滚动锁：锁紧 / 松开", () => this.toggle());
    this.ribbon.classList.add('relative-scroll-lock-ribbon');
    this.status = this.addStatusBarItem();
    this.status.classList.add("relative-scroll-lock-status");
    this.status.setAttribute("role", "button");
    this.status.setAttribute("tabindex", "0");
    this.registerDomEvent(this.status, "click", () => this.toggle());
    this.registerDomEvent(this.status, "keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        this.toggle();
      }
    });
    this.addCommand({
      id: "toggle", name: "滚动锁：开启 / 关闭",
      callback: () => this.toggle(),
    });
    this.addCommand({ id: "unlock", name: "滚动锁：关闭", callback: () => this.unlock() });
    this.registerEvent(this.app.workspace.on("layout-change", () => this.refresh()));
    this.registerEvent(this.app.workspace.on("file-open", () => this.refresh()));
    this.registerEvent(this.app.workspace.on("active-leaf-change", () => this.refresh()));
    this.app.workspace.onLayoutReady(() => {
      if (!this.loaded) return;
      this.refresh();
    });
    this.render();
  }

  visibleLeaves() {
    const workspace = this.app.workspace;
    return workspace.getLeavesOfType("markdown").filter((leaf) => {
      if (typeof leaf.getRoot === "function" && leaf.getRoot() !== workspace.rootSplit) return false;
      const el = leaf.view.containerEl;
      if (!el.isConnected || !el.getClientRects().length) return false;
      const rect = el.getBoundingClientRect();
      const style = el.ownerDocument.defaultView.getComputedStyle(el);
      return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
    });
  }

  findPair() {
    const leaves = this.visibleLeaves();
    if (leaves.length !== 2) return null;
    leaves.sort((a, b) => a.view.containerEl.getBoundingClientRect().left - b.view.containerEl.getBoundingClientRect().left);
    const left = leaves[0].view.containerEl.getBoundingClientRect();
    const right = leaves[1].view.containerEl.getBoundingClientRect();
    const overlap = Math.min(left.bottom, right.bottom) - Math.max(left.top, right.top);
    if (right.left < left.right - 8 || overlap < Math.min(left.height, right.height) / 2) return null;
    if (!leaves.every((leaf) => leaf.view.file && this.scroller(leaf.view))) return null;
    return leaves;
  }

  scroller(view) {
    const reading = view.getMode() === "preview";
    const root = view.contentEl || view.containerEl;
    return root.querySelector(reading ? ".markdown-preview-view" : ".cm-scroller");
  }

  releaseNativeLink(pair) {
    if (pair[0].group && pair[0].group === pair[1].group) {
      for (const leaf of pair) leaf.setGroup(null);
      this.app.workspace.requestSaveLayout?.();
    }
  }

  toggle() {
    if (this.session) {
      this.unlock();
      return;
    }
    const pair = this.findPair();
    if (!pair) {
      new Notice("先将两篇笔记左右分屏，再开启滚动锁。", 2500);
      return;
    }
    this.releaseNativeLink(pair);
    this.binding = pair.map((leaf) => ({ leaf, view: leaf.view, path: leaf.view.file.path, scroller: this.scroller(leaf.view) }));
    this.session = new RelativeScrollSession(
      this.binding.map((item) => item.scroller),
      () => this.render(),
      () => this.unlock(),
    );
    this.render();
  }

  unlock() {
    this.session?.dispose();
    this.session = null;
    this.binding = null;
    this.render();
  }

  refresh() {
    if (!this.loaded) return;
    if (this.binding) {
      const pair = this.findPair();
      const valid = pair && this.binding.every(({ leaf, view, path, scroller }) =>
        pair.includes(leaf) && leaf.view === view && view.file?.path === path && this.scroller(view) === scroller);
      if (!valid) this.unlock();
    }
    const all = this.findPair() || [];
    for (const [view, button] of this.actions) {
      if (!all.some((leaf) => leaf.view === view) || !button.isConnected) {
        button.remove();
        this.actions.delete(view);
      }
    }
    for (const leaf of all) {
      const view = leaf.view;
      if (!this.actions.has(view) && typeof view.addAction === "function") {
        const button = view.addAction("unlock", "滚动锁：锁紧 / 松开", () => this.toggle());
        button.classList.add("relative-scroll-lock-action");
        this.actions.set(view, button);
      }
    }
    this.render();
  }

  render() {
    const locked = Boolean(this.session);
    const available = Boolean(this.findPair());
    const temporary = locked && this.session.alt;
    const text = temporary ? "滚动锁：临时松开" : locked ? "滚动锁：已锁定" : "滚动锁";
    const title = locked ? "点击解除同步；按住 Alt 可单独滚动" : "分别定位两栏后，点击同步滚动；Alt 可临时单独调整";
    const icon = locked && !temporary ? "lock" : "unlock";
    if (this.status) {
      this.status.hidden = !available;
      this.status.textContent = text;
      this.status.setAttribute("title", title);
      this.status.setAttribute("aria-label", `${text}。${title}`);
      this.status.setAttribute("aria-pressed", String(locked));
      this.status.classList.toggle("is-locked", locked);
    }
    for (const button of [this.ribbon, ...this.actions.values()]) {
      if (!button) continue;
      button.hidden = !available;
      setIcon(button, icon);
      button.setAttribute("aria-label", `${text}。${title}`);
      button.setAttribute("aria-pressed", String(locked));
      button.classList.toggle("is-active", locked);
    }
  }

  onunload() {
    this.loaded = false;
    this.session?.dispose();
    this.session = null;
    for (const button of this.actions.values()) button.remove();
    this.actions.clear();
  }
};

// Also exposed for regression tests; Obsidian loads the default class above.
module.exports.RelativeScrollSession = RelativeScrollSession;
