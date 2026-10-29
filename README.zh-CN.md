# 49 · Notion / GPT 细节优化

统一的 Obsidian 桌面插件，公开发布版本 1.0.1，适用于 Obsidian 1.14.0 及以上。插件列表中的名称为「49 Notion GPT Style」。

包含：

- 阅读和编辑布局：行宽、标题比例、段距、列表、引用、加粗和表格。
- 文件列表：项目文件夹的缩进、分组底色和展开引导线。
- 网页粘贴：识别 ChatGPT 的加粗标记，去除引用按钮残留，保留正常链接，收紧简单列表，转换边框卡片。
- 提示词代码块与项目推进台样式，分别沿用 `prompt-handbook`、`project-progress-dashboard` 的作用范围。
- 原生表格列宽拖动、双击适应内容、键盘微调和本地记忆；包含 Windows 标题栏拖动修复。
- 双栏滚动锁：左右分别定位后同步相对滚动，按住 Alt 可单独调整。启动无通知，单页、上下分栏或非两栏布局隐藏入口；关闭分栏、切换文件或显示模式时自动解除。

## 安装与更新

先退出 Obsidian，然后运行包内 `install.ps1 -VaultPath "你的仓库路径"`。安装器只改 `.obsidian` 下的相关插件与启用配置，不修改笔记。

也可从 [GitHub Releases](https://github.com/v-49/obsidian-49-notion-gpt/releases) 下载同一版本的三个插件文件，放入 `.obsidian/plugins/49-notion-gpt/`，然后在第三方插件中启用「49 Notion GPT Style」。手动安装时须停用三个旧插件 `compact-rich-paste`、`relative-scroll-lock`、`native-table-resize`，以及 `wider-note`、`prompt-handbook-code`、`project-progress-dashboard` 三份旧 CSS 片段，以免重复处理。

以后只更新此插件的 `main.js`、`manifest.json`、`styles.css`。保留本地 `data.json`；安装器会自动保留它。无需安装 Node.js 或其他依赖。

首次运行会从当前仓库的旧表格插件导入列宽记录。安装器在 `.obsidian/backups/49-notion-gpt-时间戳/` 备份原配置和自制插件，旧文件不删除。需要恢复时，退出 Obsidian，将备份中的 `appearance.json` 与 `community-plugins.json` 放回 `.obsidian`，再启动。回退到旧表格插件时将使用旧列宽记录。

## 使用

照常复制网页并用 Ctrl+V 粘贴。粘贴为纯文本时不带网页结构；已经丢失的格式不能凭空恢复。

左右分屏打开两篇笔记（可为同一文件），滚动锁入口自动出现。分别定位后点击，再次点击解除；可在快捷键设置中自行绑定切换命令。单页时不显示滚动锁。

表格保持 Obsidian 原生编辑。将指针放到表格列边界拖动，双击适应内容；边界获得焦点后可用左右方向键调整，Shift 微调。

## 范围

卡片和引用过滤针对已识别的网页语义结构，并非任意网站的像素级复制。嵌入图片与公式沿用 Obsidian 的导入处理。文件夹分组样式沿用当前 `1.1-主任务/work` 目录约定；其他仓库如需相同分组，应使用相同目录结构或修改对应 CSS。

Excalidraw、Quiet Outline、Blockier 和 Claudian 继续由各自插件管理；本包不包含这些第三方程序、账户配置或笔记内容。

## 开发

源码目录为 `49-notion-gpt`。执行 `npm ci`、`npm test`、`npm run build`；发布内容位于 `dist/49-notion-gpt`。功能模块分别位于 `src/features`，样式位于 `styles`，最终构建为一个无外部运行依赖的插件。
