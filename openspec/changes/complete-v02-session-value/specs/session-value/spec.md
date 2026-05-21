## ADDED Requirements

### Requirement: Session 必须提供本地派生的价值分类

Sessionary 必须（MUST）为每个 session 提供本地派生的 value category、value score 和可解释 reasons。分类必须（MUST）至少覆盖低成本高产出、高成本低产出、待人工修复、废弃和待确认。分类不得（MUST NOT）依赖远程服务或上传 session 内容。

#### Scenario: 已标记有用且成本低的 session

- **WHEN** session 状态为 useful 或 repaired
- **AND** session 有 tool call、文件线索、token 或 cost 元数据中的任意产出信号
- **THEN** session 应归类为 high value 或 mixed value
- **AND** UI 必须显示对应分类和至少一个 reason

#### Scenario: 待修复 session

- **WHEN** session 状态为 needs_repair
- **THEN** session 必须归类为 needs_human_repair
- **AND** 周报的 waste section 必须优先考虑该 session

#### Scenario: 废弃或失败 session

- **WHEN** session 状态为 discarded 或 failed
- **THEN** session 必须归类为 discarded
- **AND** value score 必须低于 useful / repaired session

### Requirement: 人工时间必须可估算、可修正、可追踪来源

Sessionary 必须（MUST）区分 prompting、waiting、review、repair 四类时间，并为每个字段标记 estimated 或 manual。用户必须（MUST）可以手动修正四类时间归属。review 和 repair 必须（MUST）支持半自动开始 / 完成计时。

#### Scenario: Parser 生成估算时间

- **WHEN** 本地 session 日志被扫描入库
- **THEN** prompting、waiting、review、repair 时间必须标记为 estimated
- **AND** UI 必须显示 estimated 标记

#### Scenario: 用户手动修正时间

- **WHEN** 用户在 session detail 中保存任一时间字段
- **THEN** 对应字段必须标记为 manual
- **AND** 后续重新扫描不得覆盖该 manual 时间字段

#### Scenario: 用户半自动记录 repair

- **WHEN** 用户点击 Start Repair 并稍后点击 Mark Repaired
- **THEN** Sessionary 必须把经过时间累加到 repair time
- **AND** repair time 必须标记为 manual
- **AND** session 状态默认进入 repaired

### Requirement: Session 成本、token、tool call 与文件线索必须汇总展示

Sessionary 必须（MUST）在日级 ledger 中汇总 session cost、token、tool call 和文件线索相关信息。缺失 cost 或 token 的 session 不得（MUST NOT）被当作零价值或错误数据处理。

#### Scenario: 用户查看 Today

- **WHEN** 用户打开 Today
- **THEN** 页面必须显示当天 tool call、token、cost 和 value category 的汇总
- **AND** 所有汇总必须来自本地 ledger

#### Scenario: 用户查看 session detail

- **WHEN** 用户选择一个 session
- **THEN** detail 必须显示该 session 的 token、cost、tool call 和 changed files
- **AND** 没有文件线索时必须显示明确空状态

### Requirement: Report 必须支持日价值复盘和周价值复盘

Sessionary 必须（MUST）支持生成可编辑的 Daily Report 和 Weekly Report。Weekly Report 必须（MUST）列出最有价值 sessions 和最浪费 sessions，并总结 review / repair 是否影响 AI workflow。

#### Scenario: 用户生成周报

- **WHEN** 用户在 Report 中选择 Weekly
- **THEN** 应用必须生成包含本周区间、总 sessions、总 cost/token/tool call、Top value sessions 和 Most waste sessions 的 Markdown
- **AND** 用户必须可以复制或导出该 Markdown

#### Scenario: 周报为空

- **WHEN** 选中周区间没有 session
- **THEN** Weekly Report 必须显示空状态说明
- **AND** 不得报错或发起网络请求

### Requirement: V0.2 不得改变 local-first 隐私边界

Session value、人工时间、成本汇总和周报必须（MUST）全部在本地计算。实现不得（MUST NOT）新增账号、云同步、遥测、远程 API 或上传 prompt / response / source code / 文件路径。

#### Scenario: 用户生成 value dashboard 或 weekly report

- **WHEN** 用户查看 Today、Inbox、Detail 或 Report
- **THEN** 应用不得发起远程网络请求
- **AND** 所有数据必须来自本地 SQLite、settings、scan 结果和前端 fallback
