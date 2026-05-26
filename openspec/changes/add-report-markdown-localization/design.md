# 报告 Markdown 多语言设计

## API 变更

前端 `generateReport(date, locale)` 和 `generateWeeklyReport(date, locale)` 已经接收 locale，但目前 invoke 未传给 Tauri。改为：

- `generate_report(date, locale)`
- `generate_weekly_report(date, locale)`

Rust command 接收 `locale: Option<String>` 或 `String`，解析为内部 report locale。未知值回退到英文，避免坏参数导致报告生成失败。

导出命令仍然只写入用户当前编辑的 Markdown，不重新生成报告，因此无需 locale 参数。

## Rust Report 文案层

在 `src-tauri/src/report.rs` 内增加轻量 `ReportLocale` 和 `ReportText`：

- `ReportLocale::from_str()` 支持 `en`、`zh-CN`、`system` 和未知值回退英文。
- `ReportText` 提供标题、小节、指标标签、空状态和 insight 文案方法。
- `markdown_for(date, locale)` 和 `weekly_markdown_for(date, locale)` 使用 `ReportText` 拼接。

选择 Rust 侧本地化，而不是把 report 搬到前端生成，原因：

- 当前真实报告数据聚合在 Rust 侧完成。
- 导出也在 Rust 侧写文件。
- 报告 generator 和对应测试集中在同一模块，改动边界更小。

## 不翻译的数据

以下内容保持原文：

- project name
- session summary
- 用户 note
- issue key / PR URL
- branch / file path
- tool/source 名称

状态、value category、task type、empty state、section heading 和指标 label 可以本地化。

## Fallback Behavior

- 浏览器 fallback 继续使用 TypeScript `createTranslator(locale)`。
- 如果前端传入 `system` 或未知 locale，Rust 报告回退英文。
- 如果之后需要严格跟随系统语言，应由前端继续负责 `resolveLocale()`，Rust 只接收 resolved locale。

## Validation

- Rust 单元测试覆盖英文日报、中文日报、中文周报。
- TypeScript 构建验证 command 参数类型。
- `npm run openspec:validate`
- `npm run typecheck`
- `npm run build`
- `npm test`
