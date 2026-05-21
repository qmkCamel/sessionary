# Design: V0.3 并行开发复盘

## Parallel Review Summary

在 `DayLedger` 中新增 `parallelReview`：

- `totalActiveSeconds`：当天 session 活跃区间的 union 时长。
- `parallelProjectSeconds`：跨项目并行时长。
- `parallelSessionSeconds`：多 session 并行时长，包含同项目多 session。
- `parallelProjectRatio`：`parallelProjectSeconds / totalActiveSeconds`。
- `parallelSessionRatio`：`parallelSessionSeconds / totalActiveSeconds`。
- `maxConcurrentSessions`、`maxConcurrentProjects`：复用已有 overlap 计算。
- `aiWaitingHumanOverlapSeconds`：估算 AI waiting 与 human review/repair 交叠时长。
- `reviewBacklogSessionCount`、`reviewBacklogSeconds`：已结束但仍 unknown / needs_review / needs_repair 的 session 积压。
- `contextSwitchCount`、`shortContextSwitchCount`：按 session start 顺序计算项目切换，20 分钟内切换记为 short switch。
- `insights`：有限枚举 insight，用于 UI 和 report。

## AI waiting 与 human review/repair overlap

V0.3 不具备事件级人工行为日志，因此 overlap 是估算：

- AI waiting interval：`started_at + prompting_seconds` 到 `ended_at`。
- Human review/repair interval：`ended_at` 后连续分配 `review_seconds + repair_seconds`。
- 对不同 session 的 waiting interval 与 human interval 求交集。

所有 UI 文案必须标记为 estimated，避免给出秒级准确性的错觉。

## Review bottleneck

Review backlog 使用 session 结束时间到评估时间的滞留时长：

- 对历史日期，评估时间为该日结束。
- 对当天，评估时间为 `now` 与该日结束的较早值。
- 状态为 unknown / needs_review / needs_repair 的已结束 session 进入 backlog。

## Context switching

按 session `started_at` 排序：

- 相邻 session 项目不同，计为一次 context switch。
- 如果两次 start 间隔小于等于 20 分钟，计为 short context switch。

该指标只提示“切换碎片化风险”，不判断用户行为好坏。

## UI

- Today 增加 Parallel Review strip：并行占比、waiting/review overlap、review backlog、short switches。
- Project Timeline 增加 Parallel Review rail：指标、insights、session overlap list。
- Timeline canvas 使用两层 band：project overlap 更强，session overlap 更轻。
- Detail 的 overlap summary 继续可点选，session overlap 和 project overlap 都能触发 inspector。
- Report overview 与 markdown 加入并行复盘。

## 风险与取舍

- overlap 是估算：UI 与 report 明确标记 estimated。
- 过多指标会变成 dashboard 噪音：只展示能指导行动的四个 v0.3 指标。
- context switching 可能来自合理工作流：只做提示，不做负面评价。
- weekly report 先复用同一分析函数对周区间 sessions 计算 summary，不新增页面。
