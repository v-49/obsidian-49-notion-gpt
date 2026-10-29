## 49 Notion GPT Style 1.0.1

Initial public release of the unified desktop plugin.

- Reading and editing typography, lists, quotes, and table spacing.
- Rich-text paste fixes for emphasis, citation-button debris, and native editable web cards.
- Native Markdown table-column resizing with local width memory.
- Relative scrolling for two side-by-side notes, with Alt for temporary independent movement.
- Silent startup and scroll-lock controls that hide outside a valid two-note layout.
- Includes scoped prompt-handbook, project-dashboard, and folder styles.

Requires Obsidian 1.14.0 or later on desktop. See the README for scope and privacy details.

### Install

Download `main.js`, `manifest.json`, and `styles.css` from this release into `<vault>/.obsidian/plugins/49-notion-gpt/`, restart Obsidian, then enable **49 Notion GPT Style**.

The ZIP is an optional Windows migration bundle with installer and source. Keep any local `data.json` when updating.

Validation: 13 regression tests passed, official Obsidian ESLint checks passed with zero warnings, and the runtime dependency audit reported zero vulnerabilities. Community-directory listing is subject to its separate review.
