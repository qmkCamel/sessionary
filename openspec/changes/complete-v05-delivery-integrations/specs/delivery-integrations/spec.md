## ADDED Requirements

### Requirement: Session 必须提供 PR / CI / Issue 轻量归因

Sessionary 必须（MUST）基于本地可得信息为 session 提供 delivery integration attribution，至少包含 GitHub PR link 或 candidate、CI/local test signal、review comment count unknown 态、Linear/Jira/GitHub issue 线索和归因置信度。

#### Scenario: 本地 git remote 指向 GitHub

- **WHEN** session 的项目仓库存在 GitHub origin remote
- **THEN** 应用必须尝试生成 PR link 或 branch compare candidate
- **AND** 如果没有 PR 编号，必须标记为 inferred / candidate

#### Scenario: 本地没有远程交付线索

- **WHEN** session 没有 remote、commit、issue key 或测试命令线索
- **THEN** integration attribution 必须返回 unknown / empty 状态
- **AND** UI 不得报错或声称已关联远程对象

### Requirement: Merge 状态必须来自本地 git graph 或保持 unknown

Sessionary 必须（MUST）只基于本地 git graph 判断 commit 是否已进入默认分支；无法判断时必须（MUST）保持 unknown。

#### Scenario: commit 可从默认分支到达

- **WHEN** session 后 commit 是本地默认分支的 ancestor
- **THEN** merge status 可标记为 merged
- **AND** 必须保留归因来源为 local_git

### Requirement: CI 结果必须区分 local test 与远程 CI

Sessionary 必须（MUST）把 session 日志中的测试命令记录为 local test signal。没有远程 API 的情况下，不得（MUST NOT）把 local test signal 声称为远程 CI result。

#### Scenario: session 日志包含测试命令

- **WHEN** parser 检测到 `npm test`、`cargo test` 或类似测试命令
- **THEN** session integration 必须显示 local test signal
- **AND** 如果无法确认 exit code，状态必须为 unknown

### Requirement: Report 必须包含交付集成归因

Daily Report 和 Weekly Report 必须（MUST）包含 PR / CI / Issue 归因摘要，展示已推断 PR、issue key、local test signal 和 unknown remote 状态。

#### Scenario: 用户生成报告

- **WHEN** 用户生成 Daily Report 或 Weekly Report
- **THEN** Markdown 必须包含 Delivery Integrations 或等价段落
- **AND** 不得发起远程 API 请求

### Requirement: V0.5 不得改变 local-first 隐私边界

PR / CI / Issue 轻量归因必须（MUST）全部在本地计算。实现不得（MUST NOT）新增账号、云同步、遥测、远程 API 或上传 prompt / response / source code。

#### Scenario: 用户查看 integration attribution

- **WHEN** 用户查看 Detail、Operating Review 或 Report
- **THEN** 应用不得发起远程网络请求
- **AND** 所有数据必须来自本地 SQLite、session 日志、settings、scan 结果、本地 git 和前端 fallback
