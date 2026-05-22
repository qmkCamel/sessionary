## 1. OpenSpec

- [x] 1.1 创建安全凭据 change。
- [x] 1.2 定义 Keychain、迁移、清除行为。
- [x] 1.3 运行 OpenSpec 校验。

## 2. 后端

- [x] 2.1 新增 Keychain credentials 模块。
- [x] 2.2 settings 保存时迁移/清洗 token。
- [x] 2.3 sync 从 Keychain 读取 token。
- [x] 2.4 增加测试。

## 3. 前端

- [x] 3.1 Settings 显示 token saved 状态。
- [x] 3.2 Settings 支持清除 token。
- [x] 3.3 fallback 支持 tokenSaved。

## 4. 验证

- [x] 4.1 运行 `npm run openspec:validate`。
- [x] 4.2 运行 `cargo test`、`npm run typecheck`、`npm test`。
