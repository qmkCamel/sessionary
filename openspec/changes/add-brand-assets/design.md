# Design: Sessionary 品牌图标与 Logo

## 视觉方向

品牌图形采用“ledger card + session timeline blocks”的组合：

- ledger card 表示本地账本、可复盘和个人工作日记。
- 三段错位 timeline blocks 表示 Codex / Claude Code 等 AI sessions，以及并行工作和 overlap。
- 左侧轨道点表示 session inbox 中可处理、可归档的工作项。
- 外层圆角方形仅用于 app icon；紧凑 mark 保持透明背景，便于嵌入侧栏和文档。

## 色彩

使用现有 CSS token 对应颜色：

- paper: `#fbfbf8`
- ink: `#1d2527`
- sage: `#2f7770`
- blue: `#2d67b4`
- amber: `#a8671b`
- line: `#d9ddd5`

这组颜色与现有产品界面一致，避免新增品牌色导致视觉割裂。

## 资产结构

- `sessionary-icon.svg`：桌面 app icon / 大尺寸头像。
- `sessionary-mark.svg`：透明背景紧凑 mark，用于侧栏、按钮、文档。
- `sessionary-logo.svg`：横向 logo，用于 README、发布材料、站点头部。
- `sessionary-mark-mono.svg`：单色 mark，用于低色印刷、mask 或受限场景。
- `public/favicon.svg`：浏览器 favicon，使用 app icon 同源图形。
- `src-tauri/icons/icon.png`：从 SVG 方向导出的 256px Tauri icon。

## 接入

侧栏品牌从纯文字切换为 mark + wordmark 文本组合。窄侧栏只保留 mark，移动布局恢复 mark + 文本。

该变更不新增用户触发动作，不涉及超过 300ms 的前端 action。
