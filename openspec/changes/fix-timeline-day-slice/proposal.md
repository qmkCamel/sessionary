# Change: 修正项目时间线跨天 session 展示口径

## 背景

Project Timeline 当前会纳入与当天窗口相交的 session，但前端块宽和标签使用原始 session `startedAt` / `endedAt` / `durationSeconds`。当 Codex 日志跨多天持续追加时，时间线会显示 500 多小时的块，误导用户以为当天项目投入了数百小时。

## 目标

- 项目时间线展示当天可见的 session 时间片。
- 块位置、宽度和块内时长标签按当天窗口裁剪后的区间计算。
- 原始 session 总时长继续保留在详情面板，不改变底层数据与统计。

## 不做

- 不改变 session 解析的原始 started / ended / duration。
- 不改变日级统计、并行统计或 report 口径。
- 不自动拆分数据库中的跨天 session 记录。

## 成功标准

- 跨多天 session 在当天项目时间线上不再显示 500h+ 标签。
- 2026-06-07 的跨天 PeopleLens session 应显示为当天可见时长，而不是原始完整跨度。
