# Design: 安全集成凭据存储

## 数据模型

- `RemoteIntegrationConfig` 新增 `token_saved` 和 `clear_token`。
- `token` 字段只作为一次性输入值，不持久化到 SQLite。
- SQLite 中 `integration_settings` 只存非敏感状态。

## 后端

- 新增 `credentials` 模块封装 Keychain 读写。
- macOS 使用系统 `security` 命令写入 generic password：
  - service: `Sessionary`
  - account: `github-token` / `linear-token`
- 非 macOS 环境返回 unsupported 状态，不伪装成安全存储。
- `save_settings`：
  - token 非空时写入 Keychain。
  - `clear_token=true` 时删除 Keychain token。
  - 保存到 SQLite 前清空 token。
- `sync_integrations` 从 Keychain 读取 token。

## 前端

- token input 不回显已保存 token。
- 已保存时展示 saved 状态。
- 提供清除 token 操作。

## 迁移

- 如果旧 SQLite settings 中存在 token，后端尝试迁移到 Keychain。
- 迁移成功后清空 SQLite token。
- 迁移失败时不得静默丢失 token。

## 验证

- Rust 单元测试覆盖配置清洗和 Keychain account name。
- TS fallback 覆盖 tokenSaved 状态。
