# 49 Notion GPT Style

A desktop Obsidian plugin that brings together restrained reading styles, rich-text paste fixes, editable web cards, native table-column resizing, and relative scrolling between two note panes.

[中文说明](README.zh-CN.md) · [Releases](https://github.com/v-49/obsidian-49-notion-gpt/releases) · [Report an issue](https://github.com/v-49/obsidian-49-notion-gpt/issues)

## Features

- **Reading layout:** consistent measure, heading scale, paragraph rhythm, emphasis, lists, quotes, and table spacing in Reading view and Live Preview.
- **Rich-text paste:** recognize explicit emphasis spans from ChatGPT, remove detached citation-button labels while retaining ordinary links, and tighten simple flat lists without flattening nested lists or code.
- **Editable web cards:** convert recognized bordered web content into native Obsidian callouts, including row titles, supported icons, and dividers.
- **Image alignment:** standalone images are centered by default. Right-click an image for left, center, or right alignment, including pasted SVG data images. Choices are remembered per note and image. Inline images and table images retain their existing flow; native sizes and resize controls are preserved.
- **Table columns:** resize ordinary Markdown tables by dragging a column edge, double-click to fit content, or use arrow keys with Shift for fine adjustment. Widths are saved locally by note and table identity.
- **Relative scroll lock:** position two side-by-side notes independently, then lock their scrolling from those positions. Hold Alt to adjust one pane. Startup is silent, controls are hidden in a single-pane layout, and changing a note or display mode releases the lock.
- **Scoped styles:** prompt-handbook code blocks, project-dashboard styling, and folder-group refinements are included in the same package.

Requires **Obsidian 1.14.0 or later on desktop**. Mobile is not currently supported.

## Install

Install from the [community page](https://community.obsidian.md/plugins/fortynine-notion-gpt) when its install action is available, or from [GitHub Releases](https://github.com/v-49/obsidian-49-notion-gpt/releases).

1. Download `main.js`, `manifest.json`, and `styles.css` from the same release.
2. Place them in `<vault>/.obsidian/plugins/fortynine-notion-gpt/` (use your configured settings directory if different).
3. Restart Obsidian, then enable **49 Notion GPT Style** in Community plugins.

Updates replace those three files. Keep your local `data.json`.

The optional Windows bundle also includes a PowerShell installer and source. Its installer backs up the original plugin configuration, disables the superseded local extensions and snippets, and preserves unrelated settings. The plugin itself never installs or updates extensions.

## Use

Copy rich text from a webpage and paste normally. Paste-as-plain-text has no HTML formatting to preserve. Recognition is based on semantic HTML; this is not a pixel-perfect website importer, and unsupported source layouts may become ordinary Markdown. If a website copy exporter has already removed emphasis or diagrams, the receiving plugin cannot reconstruct them. The optional browser helper copies from rendered ChatGPT content; refresh existing ChatGPT tabs after loading it.

For scroll lock, open exactly two notes side by side. Position each note, then click the lock icon or status-bar control. Click again to unlock. Holding Alt temporarily suspends synchronization. The same file can be open in both panes. The toggle command is also available in the command palette.

For tables, hover over a visible table and drag a column boundary. Double-click a boundary to fit its contents. After focusing a resize handle, use left/right arrows; Shift changes the step to one pixel. Commands are available to focus resize controls or reset widths for the active note. Embedded notes and tables with merged cells are left to their existing renderer.

Recognized web cards use native callouts:

```markdown
> [!web-card]
> > [!web-row|search] Find information
> > The content remains editable Markdown.
>
> ---
>
> > [!web-row|truck] Deliver the result
> > A second row in the same card.
```

## Existing local-package users

This is the unified successor to the local `49-notion-gpt` package, the `compact-rich-paste`, `relative-scroll-lock`, and `native-table-resize` extensions, and the `wider-note`, `prompt-handbook-code`, and `project-progress-dashboard` CSS snippets. The Windows installer archives those plugin folders in its backup to avoid duplicate entries; manual installers must disable the old entries. The public plugin ID is `fortynine-notion-gpt`. It imports old table widths once from the local unified package or standalone table extension if their data file exists in the current vault; the old file is retained.

Prompt-handbook styling is scoped to the `prompt-handbook` CSS class. Dashboard styling is scoped to `project-progress-dashboard`. Folder grouping follows the original `1.1-主任务/work` convention; it only affects that matching folder tree. Other folder trees keep their own layout.

## Privacy and scope

### Known limitations and verification

- [#1: Source copy loses emphasis and diagrams](https://github.com/v-49/obsidian-49-notion-gpt/issues/1): retained as an upstream limitation. Remaining visual differences are accepted; no additional local reconstruction is planned. The optional browser helper is experimental and has not completed independent end-to-end verification.
- [#2: Desktop interaction verification](https://github.com/v-49/obsidian-49-notion-gpt/issues/2): tracks the remaining real-application checks for mixed-media paste, image menus, scrolling and plugin lifecycle. Automated tests do not establish that every desktop interaction has passed.

Version 1.1.2 passed 24 automated tests, ESLint and isolated Windows installation/upgrade checks. A captured real clipboard sample preserved all other text and four tables after removing the detached citation badges. The affected user reports the citation residue gone after restarting Obsidian.

The plugin performs no telemetry, account sign-in, or network requests. It processes HTML only when you paste and stores table widths and image alignment preferences in its local plugin data file. Image preferences use bounded image-source keys, not full embedded image data. It reads note text locally to associate tables with source positions. It does not rewrite existing notes automatically. Pasted images and formulas use Obsidian's native import path; remote image links can be loaded by Obsidian in the usual way.

The optional installer operates on a vault explicitly supplied by the user. It is not executed by the plugin. The release excludes vault contents, backups, account configuration, and local table-width data.

## Development

```sh
npm ci
npm test
npm run lint
npm run build
```

The build emits the three release files at `dist/fortynine-notion-gpt/`, and copies `main.js` and `styles.css` to the repository root for release verification. Runtime assets have no external dependency other than Obsidian. Sources are in `src/`, styles in `styles/`, and regression tests in `tests/`.

## License and attribution

[MIT](LICENSE), copyright 2026 49. The relative-scroll module incorporates the author's earlier [Relative Scroll Lock](https://github.com/v-49/obsidian-relative-scroll-lock) project under the same license. Notion, ChatGPT, and Obsidian are trademarks of their respective owners; this is an independent community project.
