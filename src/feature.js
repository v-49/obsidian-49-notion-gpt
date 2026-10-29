const { Component } = require('obsidian');

// One Obsidian plugin owns registrations and persistence. Feature components
// have their own listener cleanup, without creating hidden child plugins.
class Feature extends Component {
  constructor(owner, key) {
    super();
    this.owner = owner;
    this.app = owner.app;
    this.key = key;
  }
  addCommand(command) {
    this.owner.addCommand({ ...command, id: `${this.key}-${command.id}` });
  }
  addRibbonIcon(...args) {
    const el = this.owner.addRibbonIcon(...args);
    this.register(() => el.remove());
    return el;
  }
  addStatusBarItem() {
    const el = this.owner.addStatusBarItem();
    this.register(() => el.remove());
    return el;
  }
  registerMarkdownPostProcessor(processor) {
    return this.owner.registerMarkdownPostProcessor(processor);
  }
  async loadData() { return this.owner.data[this.key]; }
  saveData(data) { return this.owner.saveFeature(this.key, data); }
}
module.exports = { Feature };
