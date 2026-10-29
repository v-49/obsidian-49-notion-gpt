## 49 Notion GPT Style 1.1.2

Fixes citation labels that still appeared after pasting from the web Copy button. The exporter strips the attributes recognized by earlier versions; this release additionally recognizes its narrow exported badge structure and retains ordinary prose, links, tables and code.

Includes standalone image alignment from 1.1.0, the optional source-copy browser helper, and installer migration that archives superseded local plugin IDs with their data and backups. Core features remain reading layout, editable web cards, native table-column resizing and relative scroll lock.

The Obsidian plugin cannot recover emphasis or diagrams already removed by a website exporter. The optional browser helper operates at the source; refresh existing ChatGPT tabs after enabling it. It is not installed automatically with the Obsidian plugin.

Requires Obsidian 1.14.0+ on desktop. Update main.js, styles.css and manifest.json from this release in .obsidian/plugins/fortynine-notion-gpt, keeping data.json, then reload the plugin. The Windows ZIP includes the migration installer and source; it excludes private notes and test captures.

### Validation and known limitations

24 automated tests, ESLint and isolated Windows installation/upgrade checks passed. A captured clipboard sample preserved all other text and four tables after removing two citation badges. The affected user reports the residue gone after restarting Obsidian.

- [#1: Upstream copy-format loss](https://github.com/v-49/obsidian-49-notion-gpt/issues/1) remains documented; remaining visual differences are accepted, with no additional local reconstruction planned. The optional browser helper is experimental, not an end-to-end verified guarantee.
- [#2: Remaining desktop interaction checks](https://github.com/v-49/obsidian-49-notion-gpt/issues/2) tracks the outstanding verification work separately from implemented features.
