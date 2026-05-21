## ADDED Requirements

### Requirement: 应用必须提供 AI Dev Operating Review

Sessionary 必须（MUST）提供 Operating Review Summary，至少包含跨工具 session history、跨项目并行健康、任务类型分布、任务类型成功率、工具表现、delivery absorption 和 delegation playbook。

#### Scenario: 用户打开 Operating Review

- **WHEN** 当天存在 sessions
- **THEN** 页面必须显示工具表现、任务类型成功率、交付吸收状态和 playbook
- **AND** 所有成功率和建议必须基于本地 session 元数据估算

#### Scenario: 当天没有 session

- **WHEN** day ledger 没有 sessions
- **THEN** Operating Review 必须显示空状态
- **AND** UI 不得报错

### Requirement: 应用必须按任务类型沉淀 AI 成功率

Sessionary 必须（MUST）为每个 session 推断 task type，并按 task type 汇总 session 数、成功 session 数、平均 value score、repair session 数和推荐工具。

#### Scenario: session 修改前端文件

- **WHEN** session changed files 包含 `.tsx`、`.css` 或 UI 关键词
- **THEN** task type 应推断为 UI / frontend
- **AND** summary 必须把它计入对应 task type bucket

### Requirement: 应用必须生成 prompt/workflow 复用建议

Sessionary 必须（MUST）基于工具表现、任务类型成功率、review/repair backlog、delivery absorption 和 parallel health 生成 workflow reuse suggestions。建议必须（MUST）面向个人复盘，不得作为团队绩效评价。

#### Scenario: 某工具在某任务类型上表现稳定

- **WHEN** 某 source 在某 task type 下有多个 high / mixed value sessions
- **THEN** playbook 必须包含继续复用该 delegation pattern 的建议

### Requirement: Weekly Report 必须包含 AI Dev Operating Review

Weekly Report 必须（MUST）包含 AI Dev Operating Review 章节，覆盖本周工具表现、任务类型成功率、交付吸收、并行健康和 delegation playbook。

#### Scenario: 用户生成周报

- **WHEN** 用户生成 Weekly Report
- **THEN** Markdown 必须包含 AI Dev Operating Review 或等价段落
- **AND** 不得发起网络请求

### Requirement: V1.0 不得改变 local-first 隐私边界

Operating Review 必须（MUST）全部在本地计算。实现不得（MUST NOT）新增账号、云同步、遥测、远程 API、团队绩效排名或上传 prompt / response / source code。

#### Scenario: 用户查看 Operating Review

- **WHEN** 用户查看 Operating Review 或 Weekly Report
- **THEN** 应用不得发起远程网络请求
- **AND** 所有数据必须来自本地 SQLite、session 日志、settings、scan 结果、本地 git 和前端 fallback
