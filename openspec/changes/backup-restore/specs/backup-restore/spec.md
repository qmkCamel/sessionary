## ADDED Requirements

### Requirement: 用户必须能创建本地 SQLite 备份

Sessionary 必须（MUST）允许用户手动创建本地 SQLite 备份，并返回备份路径、大小和创建时间。

#### Scenario: 用户创建备份

- **WHEN** 用户点击 Create backup
- **THEN** 应用必须把当前 SQLite 复制到 app data backups 目录
- **AND** 备份结果必须显示文件路径和大小
- **AND** 备份不得包含 Keychain token

### Requirement: 用户必须能从有效备份恢复

Sessionary 必须（MUST）允许用户从有效 SQLite 备份恢复，并在恢复前做完整性校验。

#### Scenario: 用户恢复有效备份

- **WHEN** 用户提供一个通过 `PRAGMA integrity_check` 的 SQLite 文件路径
- **THEN** 应用必须先创建当前数据库的 safety backup
- **AND** 然后替换当前数据库并重新初始化 schema

#### Scenario: 用户恢复无效文件

- **WHEN** 用户提供不存在或 integrity check 失败的路径
- **THEN** 应用必须拒绝恢复
- **AND** 不得替换当前数据库
