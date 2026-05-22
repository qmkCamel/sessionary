## ADDED Requirements

### Requirement: Settings 必须支持 GitHub / Linear 本地凭据配置

Sessionary 必须（MUST）允许用户在 Settings 中配置 GitHub 与 Linear 的启用状态和本地访问凭据，并且默认保持禁用。

#### Scenario: 用户尚未配置远端集成

- **WHEN** 用户首次打开 Settings
- **THEN** GitHub 与 Linear 集成必须处于 disabled 状态
- **AND** 应用不得自动发起远端请求

#### Scenario: 用户保存远端凭据

- **WHEN** 用户输入 GitHub token 或 Linear API key 并保存 settings
- **THEN** 凭据必须只保存在本机 settings 存储中
- **AND** 报告、session 摘要和导出内容不得包含凭据原文

### Requirement: 用户必须显式触发远端同步

Sessionary 必须（MUST）只在用户启用 provider 并触发 sync action 后请求 GitHub / Linear；常规 scan、report、review 和应用启动不得自动联网。

#### Scenario: 用户点击同步按钮

- **WHEN** 至少一个 provider 已启用且用户点击 GitHub / Linear sync
- **THEN** 应用必须运行一次远端同步
- **AND** 必须返回每个 provider 的 attempted、linked、errors 和 message

#### Scenario: provider 未启用或缺少凭据

- **WHEN** 用户触发同步但 provider disabled 或 token 为空
- **THEN** 应用不得请求该 provider
- **AND** 同步结果必须说明 provider 被跳过

### Requirement: GitHub 同步必须确认 PR / CI / review 状态

Sessionary 必须（MUST）基于本地 GitHub remote、branch、PR number 和 commit SHA 查询 GitHub API，并更新本地 delivery attribution。

#### Scenario: GitHub API 找到匹配 PR

- **WHEN** session 可解析出 GitHub owner/repo 且远端存在匹配 PR
- **THEN** PR link 必须标记为 confirmed
- **AND** 必须保存 PR URL、PR state、merge status 与 source=`github_api`

#### Scenario: GitHub API 找到 workflow run

- **WHEN** session 有 commit SHA 且 GitHub Actions 返回关联 workflow run
- **THEN** CI signal 必须标记为 remote GitHub Actions 来源
- **AND** 必须把 success/failure/in_progress 等远端状态映射为 passed/failed/running/unknown

#### Scenario: GitHub API 找不到对象或权限不足

- **WHEN** GitHub 返回 not found、forbidden 或网络错误
- **THEN** 同步必须记录 provider error
- **AND** 不得删除已有本地 inferred attribution

### Requirement: Linear 同步必须确认 issue key

Sessionary 必须（MUST）用 Linear GraphQL API 根据 issue key 查询 Linear issue，并把命中的 issue 标记为 confirmed。

#### Scenario: Linear API 找到匹配 issue

- **WHEN** session delivery attribution 中存在 `ABC-123` 形式的 issue key
- **THEN** issue provider 必须更新为 `linear`
- **AND** 必须保存 issue URL、title、state、status=confirmed 与 source=`linear_api`

#### Scenario: Linear API 返回 GraphQL error

- **WHEN** Linear 返回 errors array 或网络失败
- **THEN** 同步结果必须记录 provider error
- **AND** 现有 issue key 线索必须保留为 inferred / unknown

## MODIFIED Requirements

### Requirement: V0.5 不得改变 local-first 隐私边界

PR / CI / Issue 轻量归因默认必须（MUST）全部在本地计算。除用户显式启用 provider 并点击同步动作外，实现不得（MUST NOT）新增自动账号、云同步、遥测、远程 API 或上传 prompt / response / source code。

#### Scenario: 用户查看 integration attribution

- **WHEN** 用户查看 Detail、Operating Review 或 Report
- **THEN** 应用不得因为渲染页面或生成报告而发起远程网络请求
- **AND** 所有展示数据必须来自本地 SQLite、session 日志、settings、scan 结果、本地 git、已保存的远端同步结果和前端 fallback

#### Scenario: 用户主动触发 GitHub / Linear sync

- **WHEN** 用户已启用 provider 并点击同步
- **THEN** 应用可以请求对应 provider 的官方 API
- **AND** 请求参数必须限制为 repo owner/name、branch、PR number、commit SHA 或 issue key 等交付元数据
