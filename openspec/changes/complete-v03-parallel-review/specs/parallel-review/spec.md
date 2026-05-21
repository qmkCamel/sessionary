## ADDED Requirements

### Requirement: 应用必须提供并行开发复盘摘要

Sessionary 必须（MUST）为 day ledger 提供 Parallel Review Summary，至少包含总活跃时长、跨项目并行时长、多 session 并行时长、并行占比、最大并发 session 数、最大并发项目数、AI waiting 与 human review/repair overlap、review backlog 和 context switching 指标。

#### Scenario: 用户查看 Today

- **WHEN** 用户打开 Today
- **THEN** 页面必须显示并行占比、waiting/review overlap、review backlog 和 short context switch 指标
- **AND** overlap 类指标必须标记为 estimated

#### Scenario: 当天没有 session

- **WHEN** day ledger 没有 sessions
- **THEN** Parallel Review Summary 必须返回零值
- **AND** UI 不得报错

### Requirement: Timeline 必须区分 project overlap 与 session overlap

Project Timeline 必须（MUST）同时展示跨项目并行区间和多 session 并行区间。跨项目并行区间必须（MUST）保持可点击并展示 overlap summary，多 session 并行区间必须（MUST）作为独立视觉线索或列表出现。

#### Scenario: 同一项目或不同项目存在多个 session 并行

- **WHEN** 两个或更多 session 时间段重叠
- **THEN** Timeline 必须显示 session overlap 线索
- **AND** 该线索不得遮挡具体 session block

#### Scenario: 多个项目并行

- **WHEN** 两个或更多项目在同一时间段有 active session
- **THEN** Timeline 必须显示 project overlap band
- **AND** 点击 band 必须展示项目、session 和时长摘要

### Requirement: 应用必须提示 review bottleneck

Sessionary 必须（MUST）检测已结束但仍 unknown、needs_review 或 needs_repair 的 session 积压，并生成 review bottleneck insight。积压时长必须（MUST）基于本地 session 结束时间与评估时间估算。

#### Scenario: 多个 session 完成后未处理

- **WHEN** 当天至少两个已结束 sessions 仍处于 unknown、needs_review 或 needs_repair
- **THEN** 应用必须显示 review bottleneck insight
- **AND** insight 必须包含积压 session 数和估算 backlog 时长

### Requirement: 应用必须提示 context switching 风险

Sessionary 必须（MUST）按 session start 顺序检测项目切换。相邻 session 属于不同项目时必须计为 context switch；如果两次 start 间隔小于或等于 20 分钟，必须计为 short context switch。

#### Scenario: 用户短时间内切换多个项目

- **WHEN** 当天存在两个或更多 short context switches
- **THEN** 应用必须显示 context switching insight
- **AND** 该 insight 必须表达为 workflow 提示，不得作为负面绩效评价

### Requirement: Report 必须包含并行开发复盘

Daily Report 和 Weekly Report 必须（MUST）包含并行开发复盘段落，展示并行占比、waiting/review overlap、review backlog、context switching 和关键 insights。

#### Scenario: 用户生成报告

- **WHEN** 用户生成 Daily Report 或 Weekly Report
- **THEN** Markdown 必须包含 Parallel Review 或等价段落
- **AND** 不得发起网络请求

### Requirement: V0.3 不得改变 local-first 隐私边界

并行复盘必须（MUST）全部在本地计算。实现不得（MUST NOT）新增账号、云同步、遥测、远程 API 或上传 prompt / response / source code / 文件路径。

#### Scenario: 用户查看 Timeline 或 Report

- **WHEN** 用户查看并行复盘、Timeline 或 Report
- **THEN** 应用不得发起远程网络请求
- **AND** 所有数据必须来自本地 SQLite、settings、scan 结果和前端 fallback
