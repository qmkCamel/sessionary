# Design: 数据口径文档

## 文档位置

新增：

- `docs/data-metric-definitions.md`

该文档作为当前实现的数据口径基线，优先描述已经落地的 Rust / TypeScript 代码，而不是早期技术架构文档里的理想模型。

## 覆盖范围

文档覆盖：

- 数据来源：Codex、Claude、Git、用户标注、GitHub / Linear、fallback。
- SQLite 存储：sessions、scan_runs、source_configs、app_settings。
- Parser 口径：session identity、时间戳、消息数、tool calls、token/cost、summary、changed files、test commands。
- 人工时间：prompting、waiting、review、repair 的估算和 manual 边界。
- Session value：score、category、reasons。
- Day ledger：DayMetrics、ProjectSummary。
- Parallel review：overlap、parallel ratio、backlog、context switching。
- Delivery review：commit、dirty、absorbed、test command、PR/issue/CI。
- Operating review：success rate、task type、tool performance、playbook。
- Report：Daily / Weekly Markdown。
- 非 session ledger 数据：backup、restore、release readiness、diagnostics。

## 审计方式

以以下实现文件为主要依据：

- `src-tauri/src/models.rs`
- `src-tauri/src/db.rs`
- `src-tauri/src/parsers/codex.rs`
- `src-tauri/src/parsers/claude.rs`
- `src-tauri/src/analytics.rs`
- `src-tauri/src/git.rs`
- `src-tauri/src/integrations.rs`
- `src-tauri/src/report.rs`
- `src/shared/types.ts`
- `src/data/fallback.ts`
- `src/views/*.tsx`

## 风险

- 这是文档沉淀，不直接修正算法。若文档列出的 P1/P2 问题不进入后续实现任务，用户仍可能在 UI 中看到有歧义的指标名称。
- 早期技术架构文档仍包含理想化表结构，后续应补一小段链接到本数据口径文档，避免新贡献者误读。

## 验证

- `npm run openspec:validate`
