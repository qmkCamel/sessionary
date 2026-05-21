# Design: V0.2 Session 价值与人工时间

## 数据模型

### Session value

`SessionRecord` 增加派生字段：

- `value.category`：`high_value`、`mixed_value`、`low_value`、`needs_human_repair`、`discarded`、`unreviewed`。
- `value.score`：0-100 的本地评分，只用于排序和分组。
- `value.reasons`：有限枚举原因，例如 low cost、file hints、high repair time、discarded。

Value 不作为用户手动字段持久化，而是在读取 session 时根据本地字段即时计算。这样 status、time、cost、token、tool call 或 changed files 更新后，分类立即随之变化，也避免与用户标注产生第二套真相源。

### 时间字段

现有 `timeFields` 保留 estimated / manual 状态：

- parser 写入的 prompting / waiting / review / repair 都是 estimated。
- 用户手动编辑某个字段后，该字段变成 manual。
- review / repair 半自动计时完成后，对应字段变成 manual。
- 重新扫描时 manual 字段继续保留，estimated 字段可由 parser 重新计算。

新增 `repairStartedAt`，用于与 `reviewStartedAt` 对称记录 repair 计时开始点。

### 汇总指标

`DayMetrics` 增加：

- `toolCallCount`
- `tokenCount`
- `costAmount`
- `highValueCount`
- `lowValueCount`
- `needsRepairValueCount`
- `discardedValueCount`

这些指标都来自当天本地 sessions 的派生值，用于 Today 与 Report overview。

## 价值分类规则

规则必须简单、可解释、可迭代：

- `discarded` 或 `failed` 状态直接进入 discarded / low score。
- `needs_repair` 直接进入 `needs_human_repair`。
- `unknown` / `needs_review` 进入 `unreviewed`，但仍给出初步 score。
- 成本和 token 不存在时不惩罚；存在且偏高时降低分数。
- 文件变化线索、tool call、完成状态会提升分数。
- review / repair 人工时间占比过高会降低分数。

V0.2 不把 value score 当作绝对价值判断，只用于 inbox、dashboard 和 report 排序。

## Repair 计时流

新增 Tauri commands：

- `start_repair(id)`：设置 `repair_started_at=now`，状态进入 `needs_repair`。
- `finish_repair(id, status)`：累加开始以来的秒数到 `repair_seconds`，清空 `repair_started_at`，默认状态进入 `repaired`，`repair` time field 变为 manual。

UI 在 detail panel 中把 review 和 repair 都作为人工工作流展示。

## 周报

新增 `generate_weekly_report(date)` 和 `export_weekly_report(date, markdown)`。日期用于定位包含该日期的本地周区间。周报内容：

- 本周 sessions / projects / prompting / waiting / review / repair / cost / token / tool call 总览。
- Top value sessions：按 value score 降序。
- Most waste sessions：discarded、needs repair、low value 和高人工时间 sessions 优先。
- Workflow notes：提示 review / repair 是否占比过高。

## 前端

- Today：增加 value / cost / token / tool call 汇总，让用户一眼看到 V0.2 的判断层。
- Inbox：每张 session card 显示 value chip、cost / token / file hints。
- Detail：展示 value score、reasons、time field estimated/manual 状态，并提供 repair start / finish 动作。
- Report：提供 Daily / Weekly 分段切换，复用编辑、复制、导出流程。

## 风险与取舍

- 价值评分可能显得过度自信：UI 使用 category + reasons，不把 score 写成“真理”。
- cost / token 不同工具字段不稳定：缺失数据按 unknown 处理，不惩罚。
- weekly report 不引入新页面，先放在 Report 内切换，避免扩大信息架构。
- repair 计时不自动推断真实人工修复，只提供低摩擦计时和手动修正。
