# Design: 数据口径准确性修复

## Day ledger 窗口切片

新增窗口贡献计算 helper，根据 day/week window 计算 session 对当前窗口的贡献。

- active seconds 使用 session active interval 与窗口的重叠秒数。
- prompting interval 使用 `started_at -> started_at + prompting_seconds`。
- waiting interval 使用 `started_at + prompting_seconds -> ended_at`。
- review / repair 优先使用实际 intervals；缺失 intervals 时沿用 `ended_at` 之后的启发式 interval。
- token、cost、tool call 使用 active overlap ratio 按比例分摊并四舍五入，避免跨天重复计入整条 session。

## Estimated / manual 拆分

保留现有 `promptingSecondsEstimated` 等字段，但只汇总 `timeFields` 标记为 `estimated` 的贡献；新增对应 manual 字段：

- `promptingSecondsManual`
- `waitingSecondsManual`
- `reviewSecondsManual`
- `repairSecondsManual`

前端展示总人工时间时使用 estimated + manual 的总和；hint 根据是否存在 manual 时间展示 `estimated` 或 `manual + estimated`。

## Project parallel seconds

`ProjectSummary` 新增 `parallelSeconds`。后端使用 overlap interval 的 `sessionIds` 与项目 session ids 相交来累计 project parallel seconds，并据此设置 `isParallel`，避免同名项目误判。

## Delivery attribution

`DeliveryLink` 新增来源拆分字段：

- `fileHints`
- `gitDirtyFiles`
- `commitFiles`

`changedFiles` 继续作为兼容聚合字段。自动 `absorbed` 调整为必须同时有 session file hint 与 commit file overlap，并且当前 repo 不 dirty；用户手动 absorbed 仍可覆盖。

## Codex message 去重

Codex parser 分别统计 `event_msg` 与 `response_item.message` 的 user / assistant count，最终取两类来源的最大值，而不是相加。这样可以避免同一消息在两种事件形态中重复计数，同时保留只有一种来源时的计数。

## Review / repair intervals

SQLite 为 sessions 增加：

- `review_intervals_json`
- `repair_intervals_json`

每次 finish review / repair 时追加 `{startedAt, endedAt, seconds}`。parallel review 计算 human intervals 时优先使用这些真实 interval；没有 interval 时继续用当前累计秒数的启发式 fallback。

## 验证

- `npm run openspec:validate`
- `npm run typecheck`
- `npm run build`
- `npm test`
