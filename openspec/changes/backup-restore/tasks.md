## 1. OpenSpec

- [x] 1.1 创建 backup-restore change。
- [x] 1.2 定义备份、恢复和隐私边界。
- [x] 1.3 运行 OpenSpec 校验。

## 2. 后端

- [x] 2.1 新增 BackupResult 类型。
- [x] 2.2 实现 `create_backup`。
- [x] 2.3 实现 `restore_backup`。
- [x] 2.4 注册 Tauri command。

## 3. 前端

- [x] 3.1 API wrapper 和 fallback。
- [x] 3.2 Settings 增加备份恢复 UI。

## 4. 验证

- [x] 4.1 运行 `npm run openspec:validate`。
- [x] 4.2 运行 `cargo test`、`npm run typecheck`、`npm test`。
