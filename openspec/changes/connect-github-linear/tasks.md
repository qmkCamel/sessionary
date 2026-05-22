## 1. OpenSpec

- [x] 1.1 创建 GitHub / Linear 远端同步 change。
- [x] 1.2 定义 opt-in sync、失败行为与隐私边界。
- [x] 1.3 运行 OpenSpec 校验。

## 2. 后端

- [x] 2.1 扩展 settings、delivery 和 sync result 类型。
- [x] 2.2 持久化 integration settings。
- [x] 2.3 新增 GitHub REST 同步逻辑。
- [x] 2.4 新增 Linear GraphQL 同步逻辑。
- [x] 2.5 新增 `sync_integrations` Tauri command。

## 3. 前端

- [x] 3.1 扩展共享类型和 API wrapper。
- [x] 3.2 Settings 增加 GitHub / Linear 凭据与同步入口。
- [x] 3.3 Detail / Operating Review 展示 issue title / state 和同步结果。
- [x] 3.4 补齐 fallback 数据与中英文文案。

## 4. 验证

- [x] 4.1 运行 `npm run openspec:validate`。
- [x] 4.2 运行 Rust / TS 测试、`npm run typecheck`、`npm run build`、`npm test`。
- [x] 4.3 启动本地预览并做桌面/窄屏渲染验证。
