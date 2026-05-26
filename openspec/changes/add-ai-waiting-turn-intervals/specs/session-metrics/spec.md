## ADDED Requirements

### Requirement: AI 等待必须优先使用事件级 turn interval

Sessionary 必须（MUST）在日志可推断时记录 AI waiting turn interval，并在 day ledger 和 parallel review 中优先使用这些 interval 计算 AI 等待。首响应延迟和 AI 活跃区间不属于本需求范围。

#### Scenario: 日志包含多轮用户指令和 AI 事件

- **WHEN** parser 读取到 `user_message -> ai event -> user_message -> ai event` 形态的日志
- **THEN** session 必须生成每轮 `userSentAt -> aiFinishedAt` 的 AI waiting interval
- **AND** interval source 必须标记为 `inferred`

#### Scenario: 日级聚合存在 AI waiting intervals

- **WHEN** session 有 `aiWaitingIntervals`
- **THEN** day ledger 的 AI waiting seconds 必须使用 interval 与 day window 的重叠秒数
- **AND** 不得继续用 `started_at + prompting_seconds -> ended_at` 的 modeled waiting 区间覆盖该结果

#### Scenario: Parallel review 存在 AI waiting intervals

- **WHEN** session 有 `aiWaitingIntervals`
- **THEN** waiting/human overlap 必须使用这些 interval 与 review/repair intervals 计算
- **AND** 缺失 `aiWaitingIntervals` 的 session 仍必须回退到旧 modeled waiting 区间

#### Scenario: 日志缺少可推断 turn

- **WHEN** parser 无法从日志构造 AI waiting interval
- **THEN** Sessionary 必须保留现有 waiting fallback
- **AND** 不得丢弃该 session 的 AI waiting 估算能力
