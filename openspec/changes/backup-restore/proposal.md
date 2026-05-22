# Change: 本地备份与恢复

## 背景

Sessionary 的核心资产是本地 SQLite 账本和用户标注。release-readiness 阶段需要让用户可以在升级、迁移或试验前创建可恢复备份。

## 目标

- Settings 提供创建备份能力。
- Settings 支持从用户提供的 SQLite 备份路径恢复。
- 恢复前必须校验 SQLite integrity。
- 备份不得包含 Keychain token。

## 不做

- 不实现云备份。
- 不实现自动定时备份。
- 不备份 Keychain token。

## 用户价值

用户可以在真实使用前放心试用、升级和迁移数据。

## 成功标准

- 创建备份后返回路径、大小、时间。
- 恢复非法文件时拒绝并显示错误。
- 恢复成功后重新初始化数据库。
