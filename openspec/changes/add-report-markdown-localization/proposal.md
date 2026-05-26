# 报告 Markdown 多语言

## Background

Sessionary 的主界面已经支持 `system`、`en`、`zh-CN` 三种语言设置，但真实桌面模式下的日报和周报 Markdown 由 Rust 侧 `report.rs` 生成，当前所有标题、指标标签、空状态和 insight 文案都硬编码为英文。

前端 API 虽然把 `locale` 参数传入 `generateReport()` 和 `generateWeeklyReport()`，但 Tauri command 当前只接收 `date`，导致 locale 只在浏览器 fallback report 中生效，桌面真实报告不生效。

## Goals

- 日报和周报 Markdown 根据当前 UI locale 输出英文或简体中文。
- 前端将 resolved locale 传递给 Tauri report commands。
- Rust report generator 提供明确的 report 文案层，避免继续散落硬编码英文。
- 用户输入和本地事实数据保持原文，不做机器翻译。

## Non-goals

- 不引入运行时远程翻译、LLM 翻译或语言包下载。
- 不翻译 project name、session summary、用户 note、PR URL、issue key、file path、branch 等用户/本地数据。
- 不改变报告的数据计算、筛选逻辑、导出路径或 SQLite schema。
- 不新增第三种语言。

## User Value

中文用户在 UI 设置为简体中文后，生成和导出的日报/周报也能用中文阅读；英文用户保持现有报告体验。报告仍然是本地生成、本地编辑、本地导出。

## Success Criteria

- `zh-CN` locale 下生成的日报包含中文标题、小节和指标标签。
- `zh-CN` locale 下生成的周报包含中文标题、小节和指标标签。
- `en` locale 下报告保持英文。
- 浏览器 fallback report 与 Tauri report command 的 locale 行为一致。
- `npm run openspec:validate`、`npm run typecheck`、`npm run build`、`npm test` 通过。
