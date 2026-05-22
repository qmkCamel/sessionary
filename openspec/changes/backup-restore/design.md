# Design: 本地备份与恢复

## 后端

- 新增 `backup` 模块。
- `create_backup`：
  - 复制当前 SQLite 到 app data `backups/`。
  - 文件名包含 UTC timestamp。
  - 返回 path、bytes、createdAt。
- `restore_backup(path)`：
  - 确认文件存在。
  - 用 SQLite `PRAGMA integrity_check` 校验。
  - 先为当前数据库创建 pre-restore safety backup。
  - 替换数据库文件并运行 `db::init()`。

## 前端

- Settings 新增 Backup & Restore 区域。
- 创建备份按钮显示结果。
- 恢复使用路径输入，用户显式点击 Restore。

## 隐私

- 备份只包含 SQLite。
- Keychain token 不在备份范围。

## 验证

- Rust 测试覆盖 backup 文件名、integrity check 行为。
- fallback 支持模拟备份/恢复结果。
