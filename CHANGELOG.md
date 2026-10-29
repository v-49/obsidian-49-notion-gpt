# Changelog

## 1.1.2

- Filter the attribute-stripped citation badges emitted by the web Copy button, including the HTML parser repair of nested paragraph content. Match structure rather than source names, retaining prose, links and code.
- Archive superseded plugin folders during Windows installation so old local IDs no longer appear beside the public plugin after reloading. Preserve local preferences and backups.
- Include the optional browser copy helper from the unreleased 1.1.1 work. Source-side copying is still required when the website export has already discarded emphasis or diagrams.
- Include image alignment from 1.1.0 and reconcile package metadata and installation documentation.

## 1.1.0

- Center standalone images by default in Reading view and Live Preview.
- Add left, center, and right alignment to the existing image context menu, including local images, external images, and pasted data-URI SVGs.
- Remember alignment per note and image in local plugin data, while preserving native image sizes, resize handles, and original Markdown.
- Keep inline images and images within tables in their existing flow.

## 1.0.2

- Use the community-directory-compatible identifier `fortynine-notion-gpt`.
- Import table widths from the original unified local package as well as the standalone table-resize extension.
- Keep superseded local IDs disabled during installer migration while retaining their files and backups.

## 1.0.1

- Prepare the unified plugin for public distribution with reproducible builds, MIT licensing, English documentation, and release validation.
- Retain rich-text emphasis, source-control filtering, native web cards, table resizing, and reading styles from the initial local package.
- Keep scroll-lock startup silent and hide controls outside a valid two-pane note layout.

## 1.0.0

- Combine the original local layout snippets, rich-paste fixes, table resizing, and relative scroll lock into one plugin.
