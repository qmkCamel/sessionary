## ADDED Requirements

### Requirement: 日级指标必须按窗口计算并区分时间来源

Sessionary 必须（MUST）在 day ledger 中按日期窗口计算 session 贡献，避免跨天 session 在相邻日期重复计入完整时间、token、cost 或 tool call。人工时间汇总必须（MUST）区分 estimated 与 manual 来源。

#### Scenario: session 跨越日期边界

- **WHEN** 一个 session 与目标日期窗口只部分重叠
- **THEN** day ledger 的 active time、prompting、waiting、review、repair、token、cost 和 tool call 汇总必须只计入窗口内贡献
- **AND** overlap 类指标仍必须使用裁剪后的 wall-clock interval

#### Scenario: 用户手动修正时间字段

- **WHEN** session 的某个 time field 标记为 manual
- **THEN** day ledger 必须把该字段贡献计入 manual 汇总
- **AND** 不得继续把该字段计入 estimated 汇总

### Requirement: 项目并行指标必须基于参与 session 计算

Project summary 必须（MUST）提供 project-level parallel seconds，并用 overlap session ids 与项目 session ids 的关系判断项目是否并行。不得（MUST NOT）仅凭项目名称匹配并行状态。

#### Scenario: 两个项目同名但路径不同

- **WHEN** 两个不同 `project_path` 的项目有相同 `project_name`
- **THEN** 只有实际参与 overlap session 的项目应被标记为 parallel
- **AND** UI 必须展示该项目实际 parallel seconds，而不是 active duration

### Requirement: Delivery 归因必须保守并保留文件来源

Delivery linkage 必须（MUST）把 parser file hints、git dirty files 和 commit files 分开保存，同时保留兼容的聚合 changed files。自动 absorbed 判断必须（MUST）要求 session 文件线索与 commit 文件有重叠，且当前 repo 不 dirty。

#### Scenario: session 附近有不相关 commit

- **WHEN** session 文件线索与附近 commit 文件没有重叠
- **THEN** delivery 可以记录 commit 线索
- **AND** 自动 absorbed 不得标为 true

### Requirement: Codex parser 必须避免重复计算镜像消息

Codex parser 必须（MUST）避免把同一条用户或助手消息在 `event_msg` 与 `response_item.message` 两种日志形态中重复计数。

#### Scenario: 同一消息同时出现在 event_msg 和 response_item

- **WHEN** Codex 日志同时包含同一轮 user/assistant 的 event_msg 和 response_item message
- **THEN** user message count 和 assistant message count 必须按一轮计算

### Requirement: Review / repair 必须保留实际计时间隔

Sessionary 必须（MUST）在用户完成 review 或 repair timer 时保存实际 interval，并在 parallel review 的 human overlap 计算中优先使用实际 interval。

#### Scenario: 用户完成 review timer

- **WHEN** 用户点击 Start Review 后再点击 Done
- **THEN** session 必须保存 review interval 的 startedAt、endedAt 和 seconds
- **AND** waiting/review overlap 必须优先使用该 interval，而不是仅用 session ended_at 后的启发式区间
