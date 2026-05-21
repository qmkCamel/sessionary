## 1. OpenSpec

- [x] 1.1 创建 V0.3 parallel-review change。
- [x] 1.2 定义并行复盘能力需求。
- [x] 1.3 运行 OpenSpec 严格校验。

## 2. 后端分析

- [x] 2.1 扩展 Rust / TypeScript ledger 类型，新增 Parallel Review Summary。
- [x] 2.2 计算 active union、parallel ratio、session overlap、waiting/review overlap。
- [x] 2.3 计算 review backlog 与 context switching。
- [x] 2.4 在 daily / weekly report 中加入并行复盘段落。

## 3. 前端体验

- [x] 3.1 Today 展示 v0.3 并行复盘指标与 insights。
- [x] 3.2 Timeline canvas 同时高亮 project overlap 与 session overlap。
- [x] 3.3 Timeline 增加 parallel review rail 和 session overlap list。
- [x] 3.4 补齐英文和简体中文文案。

## 4. 验证

- [x] 4.1 补充 Rust 与前端测试。
- [x] 4.2 运行 `npm run openspec:validate`。
- [x] 4.3 运行 `npm run typecheck`、`npm run build`、`npm test`。
- [x] 4.4 启动本地预览并做桌面/窄屏渲染验证。
