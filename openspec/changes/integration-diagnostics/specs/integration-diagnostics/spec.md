## ADDED Requirements

### Requirement: 用户必须能显式诊断远端集成

Sessionary 必须（MUST）提供手动触发的 GitHub / Linear 集成诊断，并返回 provider 级状态、消息和 detail rows。

#### Scenario: provider 缺少 token

- **WHEN** 用户运行诊断且 provider enabled 但 Keychain 中没有 token
- **THEN** 诊断必须返回 failed 状态
- **AND** message 必须说明 token missing

#### Scenario: GitHub API 可访问

- **WHEN** GitHub token 有效且 `/rate_limit` 请求成功
- **THEN** 诊断必须显示 API reachable
- **AND** 必须显示 rate limit remaining 或等价信息

#### Scenario: Linear issue key 不存在

- **WHEN** Linear API 可访问但本地 issue key 查询不到
- **THEN** 诊断必须说明 issue key not found
- **AND** 不得修改 session 的 issue attribution
