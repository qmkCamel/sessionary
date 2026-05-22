## ADDED Requirements

### Requirement: 集成 token 必须存入系统安全存储

Sessionary 必须（MUST）把 GitHub / Linear token 存入 macOS Keychain，并且不得把 token 明文持久化到 SQLite settings。

#### Scenario: 用户保存 GitHub token

- **WHEN** 用户在 Settings 输入 GitHub token 并保存
- **THEN** 后端必须把 token 写入 Keychain
- **AND** SQLite 中的 `integration_settings` 不得包含 token 明文
- **AND** 后续 `get_settings` 不得返回 token 明文

#### Scenario: 用户清除 token

- **WHEN** 用户请求清除某个 provider 的 token
- **THEN** 后端必须删除对应 Keychain entry
- **AND** settings 必须显示 token 未保存

### Requirement: 旧明文 token 必须安全迁移

Sessionary 必须（MUST）兼容旧版本 SQLite 中可能存在的明文 token。

#### Scenario: 读取到旧明文 token

- **WHEN** 后端读取 `integration_settings` 时发现 token 非空
- **THEN** 必须尝试迁移到 Keychain
- **AND** 只有迁移成功后才能清空 SQLite 中的 token
- **AND** 迁移失败不得静默丢失 token
