const { Plugin, Notice } = require('obsidian');
const Paste = require('./features/paste');
const ScrollLock = require('./features/scroll-lock');
const TableResize = require('./features/table-resize');

module.exports = class FortyNineSuite extends Plugin {
  async onload() {
    this.stopped = false;
    this.writeQueue = Promise.resolve();
    this.data = (await this.loadData()) || { version: 1 };
    if (this.stopped) return;
    // Import existing local column widths once. No user notes go into releases.
    if (!this.data.tables) {
      const path = `${this.app.vault.configDir}/plugins/native-table-resize/data.json`;
      if (await this.app.vault.adapter.exists(path)) {
        try {
          const old = JSON.parse(await this.app.vault.adapter.read(path));
          if (old.version === 1 && old.files) await this.saveFeature('tables', old);
        } catch (error) {
          console.error('49: table-width migration failed', error);
          new Notice('49：旧表格列宽未能读取，原数据已保留。');
        }
      }
    }
    if (this.stopped) return;
    this.addChild(new Paste(this, 'paste'));
    this.addChild(new ScrollLock(this, 'scroll'));
    this.addChild(new TableResize(this, 'tables'));
  }

  saveFeature(key, data) {
    this.data[key] = JSON.parse(JSON.stringify(data));
    const snapshot = JSON.parse(JSON.stringify(this.data));
    // A failed write must not poison the queue for later saves.
    const write = this.writeQueue.catch(() => {}).then(() => this.saveData(snapshot));
    this.writeQueue = write;
    return write;
  }

  onunload() { this.stopped = true; }
};
