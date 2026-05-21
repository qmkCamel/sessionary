# Change: 完成 V0.3 并行开发复盘

## 背景

V0.1 解决了本地 session ledger，V0.2 让用户看到人工时间和 session 价值。Roadmap 中 V0.3 的目标是把“并行开发”做成 Sessionary 的核心差异点：用户不只看见有多个 agent 同时跑，还要判断并行是否真的提高吞吐，review / repair 是否成为后置瓶颈，以及项目切换是否过碎。

当前应用已有项目时间线、跨项目 overlap 和最大并发指标，但还缺少 session-level overlap 高亮、AI waiting 与 human review/repair 的交叠分析、并行时长占比、review backlog 提示和 context switching 提示。

## 目标

- 生成 day-level Parallel Review Summary，包含并行项目时长、并行 session 时长、并行占比、最大并发、AI waiting 与 human review/repair overlap、review backlog 和 context switching。
- 在 Project Timeline 中同时高亮跨项目并行区间和多 session 并行区间。
- 在 Today 与 Timeline 中展示并行复盘 insight：parallel payoff、review bottleneck、context switching、low parallelism。
- 在 Daily / Weekly Report 中加入并行开发复盘段落。
- 保持 local-first：所有分析只来自本地 session metadata、用户标注和 SQLite。

## 非目标

- 不做 PR / CI / issue / Linear / Jira 集成。
- 不自动判定真实业务交付质量。
- 不做团队绩效排名。
- 不追求精确秒级人工行为追踪；AI waiting 与 review/repair overlap 是估算，并必须作为 estimated 呈现。
- 不引入云同步、账号、遥测或远程 API。

## 用户价值

用户能回答三个核心问题：

- 多开 agent 是否真的让今天更并行？
- AI session 完成后是否堆在 review / repair 队列里？
- 自己是否在短时间内频繁切换项目，导致注意力被切碎？

## 成功标准

- OpenSpec 严格校验通过。
- 前端 typecheck、build、测试通过，Rust 测试通过。
- Timeline 同时展示 project overlap 和 session overlap。
- Today / Timeline 能展示并行占比、AI waiting 与 review overlap、review backlog、context switch 指标。
- Report Markdown 包含并行复盘和瓶颈提示。
- 渲染验证覆盖桌面 Timeline、Today 和窄屏 Timeline，无页面级横向溢出。
