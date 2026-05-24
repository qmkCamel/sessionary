## 1. OpenSpec

- [x] 1.1 创建启动扫描性能 change。
- [x] 1.2 定义首屏加载与后台扫描要求。

## 2. 实现

- [x] 2.1 将首次加载改为先渲染缓存 ledger，再后台扫描刷新。
- [x] 2.2 保持手动 rescan 阻塞式刷新语义和扫描状态。
- [x] 2.3 缓存 Codex parser 的 regex 并减少无候选事件的递归扫描。
- [x] 2.4 增加 parser 覆盖，确认测试命令和文件提取不回退。

## 3. 验证

- [x] 3.1 运行 `npm run openspec:validate`。
- [x] 3.2 运行 `npm run typecheck`、`npm run build`、`npm test`。
- [x] 3.3 启动本地应用并做渲染验证。
