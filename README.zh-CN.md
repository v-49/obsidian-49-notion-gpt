# 49 · Notion / GPT 细节优化

统一的 Obsidian 桌面插件，版本 1.1.2，适用于 Obsidian 1.14.0 及以上。插件列表中的名称为「49 Notion GPT Style」。

包含：

- 阅读和编辑布局：行宽、标题比例、段距、列表、引用、加粗和表格。
- 文件列表：项目文件夹的缩进、分组底色和展开引导线。
- 网页粘贴：识别 ChatGPT 的加粗标记，去除已识别的引用按钮残留（含网页复制后丢失属性的结构），保留正常链接，收紧简单列表，转换边框卡片。
- 图片对齐：独立图片默认居中，右键提供左、中、右对齐，兼容本地图片、外部图片与粘贴的 SVG 数据图片；按笔记和图片记住选择，保留原尺寸及缩放功能，行内和表格内图片保持原样。
- 提示词代码块与项目推进台样式，分别沿用 `prompt-handbook`、`project-progress-dashboard` 的作用范围。
- 原生表格列宽拖动、双击适应内容、键盘微调和本地记忆；包含 Windows 标题栏拖动修复。
- 双栏滚动锁：左右分别定位后同步相对滚动，按住 Alt 可单独调整。启动无通知，单页、上下分栏或非两栏布局隐藏入口；关闭分栏、切换文件或显示模式时自动解除。

## 安装与更新

先退出 Obsidian，然后运行包内 `install.ps1 -VaultPath "你的仓库路径"`。安装器只改 `.obsidian` 下的相关插件与启用配置，不修改笔记。

也可从 [GitHub Releases](https://github.com/v-49/obsidian-49-notion-gpt/releases) 下载同一版本的三个插件文件，放入 `.obsidian/plugins/fortynine-notion-gpt/`，然后在第三方插件中启用「49 Notion GPT Style」。手动安装时须停用三个旧插件 `compact-rich-paste`、`relative-scroll-lock`、`native-table-resize`，以及 `wider-note`、`prompt-handbook-code`、`project-progress-dashboard` 三份旧 CSS 片段，以免重复处理。

以后只更新此插件的 `main.js`、`manifest.json`、`styles.css`。保留本地 `data.json`；安装器会自动保留它。无需安装 Node.js 或其他依赖。

公开版标识为 `fortynine-notion-gpt`。从原本地统一包升级时，还需停用旧的 `49-notion-gpt`；安装器会自动处理。首次运行会从旧统一包或旧表格插件导入列宽记录。安装器在 `.obsidian/backups/49-notion-gpt-时间戳/` 备份原配置和自制插件，旧插件目录移入本次备份中的 `inactive-plugins/`，刷新插件列表后只显示一个统一插件。需要恢复时，退出 Obsidian，将备份中的插件目录还原至 `.obsidian/plugins/`，并将 `appearance.json` 与 `community-plugins.json` 放回 `.obsidian`，再启动。回退到旧表格插件时将使用旧列宽记录。

## 使用

照常复制网页并用 Ctrl+V 粘贴。粘贴为纯文本时不带网页结构；已经丢失的格式不能凭空恢复。ChatGPT 原生复制按钮可能删除加粗和图形信息；可选的浏览器复制扩展从网页原文保留这些信息，安装后需要刷新已打开的 ChatGPT 页面。该扩展不随 Obsidian 插件自动启用，不能把“安装插件”视为“完整复制已验证”。

左右分屏打开两篇笔记（可为同一文件），滚动锁入口自动出现。分别定位后点击，再次点击解除；可在快捷键设置中自行绑定切换命令。单页时不显示滚动锁。

表格保持 Obsidian 原生编辑。将指针放到表格列边界拖动，双击适应内容；边界获得焦点后可用左右方向键调整，Shift 微调。

## 范围

- [Issue #1：网页复制丢失加粗和图形](https://github.com/v-49/obsidian-49-notion-gpt/issues/1)：作为上游限制保留，当前接受剩余视觉差异，不再追加本地还原。配套浏览器扩展为实验性工具，尚未完成独立的端到端验证。
- [Issue #2：桌面交互验收](https://github.com/v-49/obsidian-49-notion-gpt/issues/2)：跟踪混合内容粘贴、图片菜单、滚动锁与插件重载的剩余实机验证，不代表这些功能已确认有故障。

1.1.2 已通过 24 项自动测试、ESLint 和隔离安装升级检查。实际剪贴板样本移除引用徽章后，其余正文及 4 张表格保持完整；用户反馈重启后引用残留已消失。自动测试不等于全部实机交互验收完成。

卡片和引用过滤针对已识别的网页语义结构，并非任意网站的像素级复制。嵌入图片与公式沿用 Obsidian 的导入处理。文件夹分组样式沿用当前 `1.1-主任务/work` 目录约定；其他仓库如需相同分组，应使用相同目录结构或修改对应 CSS。

Excalidraw、Quiet Outline、Blockier 和 Claudian 继续由各自插件管理；本包不包含这些第三方程序、账户配置或笔记内容。

## 开发

源码目录为 `49-notion-gpt`。执行 `npm ci`、`npm test`、`npm run build`；发布内容位于 `dist/fortynine-notion-gpt`。功能模块分别位于 `src/features`，样式位于 `styles`，最终构建为一个无外部运行依赖的插件。
