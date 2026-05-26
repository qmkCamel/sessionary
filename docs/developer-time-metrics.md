# Sessionary 时间统计开发者口径

日期：2026-05-26

## 文档关系

时间统计拆成两份文档：

- `docs/user-facing-time-metrics.md`：面向用户的 PR 稿，只讲用户如何理解这些时间。
- `docs/developer-time-metrics.md`：面向开发者的实现口径，记录字段、公式、来源边界和后续演进。

完整数据口径仍以 `docs/data-metric-definitions.md` 为总入口。本文只聚焦时间统计。

## 当前目标

Sessionary 的时间统计不是精确工时系统。开发侧要保证两件事：

1. UI 不把估算时间包装成精确事实。
2. 聚合逻辑能区分 estimated、manual 和 timer 记录，避免用户误读来源。

当前产品核心问题是“AI 协作里的注意力花在哪里”，不是“用户精确工作了多少分钟”。

## 字段映射

### SessionRecord

| 字段 | 用户侧名称 | 含义 |
| --- | --- | --- |
| `prompting_seconds` | 指令时间 | 用户表达需求、补充上下文、纠正方向的时间估算或手动值 |
| `waiting_seconds` | AI 等待时间 | 优先为 AI waiting turn interval 的合计；缺失 interval 时回退为 session active 期间扣除 prompting 后的等待窗口 |
| `review_seconds` | 复盘时间 | 用户检查 AI 产物是否可用的时间 |
| `repair_seconds` | 修复时间 | 用户为了让 AI 产物可用而补救的时间 |
| `ai_waiting_intervals` | AI 等待区间 | 从用户发送指令到该轮 AI 最后事件的 inferred interval |
| `review_intervals` | 复盘计时间隔 | Start Review / Done 形成的真实 interval |
| `repair_intervals` | 修复计时间隔 | Start Repair / Mark Repaired 形成的真实 interval |
| `time_fields` | 时间来源 | 每个时间字段是 `estimated` 还是 `manual` |

### DayMetrics

日级汇总必须保留 estimated/manual 拆分：

| 字段组 | 含义 |
| --- | --- |
| `promptingSecondsEstimated` / `promptingSecondsManual` | 指令时间按来源拆分 |
| `aiWaitingSecondsEstimated` / `aiWaitingSecondsManual` | AI 等待时间按来源拆分 |
| `reviewSecondsEstimated` / `reviewSecondsManual` | 复盘时间按来源拆分 |
| `repairSecondsEstimated` / `repairSecondsManual` | 修复时间按来源拆分 |

前端展示“人工投入”时使用：

```text
prompting + review + repair
```

如果任一字段有 manual 贡献，UI 应提示用户这是混合来源。

## Parser 默认估算

Codex 和 Claude 当前使用同一套默认估算。

### 指令时间

```text
prompting_seconds = clamp(user_message_count * 90, 0, duration_seconds * 0.35)
```

含义：

- 每条用户消息按 90 秒估算。
- 最多不超过 session 总时长的 35%。
- 这是指令准备成本的代理指标，不是精确输入框耗时。

主要误差：

| 场景 | 误差方向 |
| --- | --- |
| 很多短消息，例如“继续”“修一下” | 可能高估，因此需要 35% 上限 |
| 一条很长、准备很久的 prompt | 可能低估 |
| 用户在外部编辑器写好后粘贴发送 | 明显低估 |
| 用户边等待边思考下一步指令 | 当前不会单独识别 |

### AI 等待时间

优先使用事件级 turn interval：

```text
waiting_seconds = sum(user_sent_at -> ai_finished_at)
```

当前 parser 会从日志中推断：

- user event：用户发送消息。
- ai event：assistant message、tool call、tool output、token count 等 AI 侧事件。
- interval：同一轮 user event 到下一条 user event 前最后一个 ai event。

如果无法构造任何 interval，才回退为旧估算：

```text
waiting_seconds = max(0, duration_seconds - prompting_seconds)
```

- 这是用户可感知等待时间，不是模型服务端真实运行时长。
- 它主要用于判断等待窗口是否被其他 review/repair/session 复用。

### 复盘时间

默认估算：

```text
review_seconds = clamp(duration_seconds * 0.12, 60, 900)
```

前提：

- session 有 `ended_at`。
- 用户没有通过 timer 或手动输入覆盖。

如果用户使用 Start Review / Done：

- 累加真实 elapsed seconds 到 `review_seconds`。
- 写入 `review_intervals_json`。
- 将 `time_fields.review` 标记为 `manual`。

### 修复时间

默认值：

```text
repair_seconds = 0
```

只有用户手动标记或使用 repair timer 时才记录。

如果用户使用 Start Repair / Mark Repaired：

- 累加真实 elapsed seconds 到 `repair_seconds`。
- 写入 `repair_intervals_json`。
- 将 `time_fields.repair` 标记为 `manual`。

## 日级窗口切片

Day ledger 查询所有与日期窗口相交的 session：

```text
started_at < day_end AND COALESCE(ended_at, started_at) >= day_start
```

时间贡献必须按日窗口裁剪，避免跨天 session 在相邻日期重复计算。

当前逻辑：

- prompting 使用 session 内 modeled interval 与 day window 的重叠秒数。
- waiting 在 `time_fields.waiting=estimated` 且存在 `ai_waiting_intervals` 时，使用这些 interval 与 day window 的重叠秒数；否则回退到 modeled waiting interval。
- review/repair 优先使用真实 interval。
- 没有真实 interval 时，review/repair 回退到 `ended_at` 后的启发式区间。
- tool/token/cost 按 active overlap ratio 分摊。

## Parallel review 口径

AI waiting interval 当前优先级：

```text
1. ai_waiting_intervals: user_sent_at -> ai_finished_at
2. fallback: started_at + prompting_seconds -> ended_at
```

Human interval 优先级：

1. `review_intervals` / `repair_intervals`
2. 回退到 `ended_at -> ended_at + review_seconds + repair_seconds`

`aiWaitingHumanOverlapSeconds` 是 pairwise session-seconds。一个 review 同时覆盖两个 waiting sessions，会计入两份 overlap。它不是唯一 wall-clock 秒数。

## 来源标签设计

面向用户不应只显示一个裸时间。开发上建议支持以下来源标签：

| 标签 | 当前支持 | 含义 |
| --- | --- | --- |
| `estimated` | 已支持 | Parser 根据消息数、duration 等启发式估算 |
| `inferred` | 已支持于 AI waiting interval | Parser 根据用户消息和后续 AI/tool/token 事件推断 |
| `manual` | 已支持 | 用户在 Detail 中手动保存时间 |
| `timer` | 部分支持 | review/repair 由 Start/Done interval 得到；当前存储上仍归入 manual |
| `input_recorded` | 未支持 | 未来如果 Sessionary 自己记录输入框编辑过程，可用于 prompting |

注意：当前 `time_fields` 只有 `estimated` / `manual` 两态。若要在 UI 中明确区分 timer 和手动输入，需要扩展模型。

## 输入框计时的演进方案

用户提出的“开始在输入框中输入到发送”可以提升 prompting 精度，但只能覆盖输入框内发生的事。

建议未来设计 Prompt Composer 或输入事件接入时记录：

| 字段 | 含义 |
| --- | --- |
| `first_input_at` | 输入框从空变为非空的时间，或用户首次编辑时间 |
| `last_edit_at` | 最后一次编辑时间 |
| `send_at` | 发送时间 |
| `paste_at` | 粘贴事件时间 |
| `typed_chars` | 用户键入字符数 |
| `pasted_chars` | 粘贴字符数 |
| `source` | composer / external_tool / manual |

可派生：

```text
input_edit_seconds = send_at - first_input_at
```

但不要把它等同于完整 prompting seconds：

- 如果用户在外部编辑器准备 prompt 后粘贴，`input_edit_seconds` 会偏低。
- 如果用户在输入框里停顿去查资料，`input_edit_seconds` 可能偏高。
- 如果用户边等 AI 边构思下一条指令，输入框事件无法覆盖这段思考时间。

因此未来更稳妥的模型是：

```text
prompting_seconds = best available instruction-preparation signal
prompting_source = estimated | manual | timer | input_recorded
```

## UI 文案约束

开发 UI 时避免这些表达：

- “精确工时”
- “真实工作时间”
- “AI 节省了 X 小时”
- “用户输入耗时”，除非来源确实是 input_recorded

推荐表达：

- “指令时间”
- “AI 等待”
- “人工投入”
- “来源：估算 / 手动 / 计时”
- “这些时间用于复盘 AI 协作方式，不用于精确工时或绩效评价”

## 典型测试场景

### 跨天 session

一个 session 从 23:30 到 00:30。两个日期都应只计算窗口内贡献，不得各自记完整 session。

### 多轮短消息

12 分钟 session 中有 6 条用户消息。prompting 应被 35% duration cap 限制，避免明显高估。

### 外部编辑器粘贴

用户实际花 20 分钟写 prompt，但工具日志只有 1 条用户消息。当前估算会低估，UI 必须允许用户手动修正。

### 实际 review interval

用户 10:10 Start Review，10:25 Done。parallel review 必须优先使用 10:10-10:25，而不是 session ended_at 后的模拟 interval。

### 同时 review 两个 waiting sessions

一个 human review 同时覆盖两个 AI waiting sessions。`aiWaitingHumanOverlapSeconds` 应按 pairwise overlap 计入两份，文案不得解释成唯一 wall-clock 秒数。

## 后续实现建议

1. 扩展 `TimeFieldState`，从二态 `estimated/manual` 变成包含 `timer/input_recorded` 的多来源枚举。
2. 为 prompting 增加可选 interval 记录，支持未来 Prompt Composer。
3. UI 中所有时间指标展示来源标签，尤其是 prompting 和 human time 汇总。
4. 报告生成时继续使用用户语言，但可以在附注里说明“估算/手动混合”。
5. 保持 `docs/user-facing-time-metrics.md` 无公式、无字段名、无实现细节。
