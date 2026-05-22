# Change: 安全集成凭据存储

## 背景

GitHub / Linear 接入已经提供 token 配置和同步能力，但 release-readiness 阶段不能继续把访问凭据作为普通 settings JSON 明文保存。Sessionary 的隐私承诺要求敏感凭据进入操作系统安全存储。

## 目标

- GitHub / Linear token 保存到 macOS Keychain。
- SQLite settings 只保存 enabled、tokenSaved 等非敏感状态。
- 读取 settings 时不得把 token 明文返回给前端。
- 支持清除已保存 token。
- 兼容旧版本 settings 中已有明文 token 的迁移。

## 不做

- 不实现 OAuth。
- 不把 token 加入备份。
- 不实现跨设备凭据同步。

## 用户价值

用户可以放心连接 GitHub / Linear；即使导出或备份 SQLite，也不会泄露远端访问 token。

## 成功标准

- 保存 token 后，settings 显示 token 已保存但不回显明文。
- 同步和诊断能从 Keychain 读取 token。
- 清除 token 后 provider 不再能发起远端请求。
