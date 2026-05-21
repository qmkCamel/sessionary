## 1. OpenSpec

- [x] 1.1 创建 V0.2 session value change。
- [x] 1.2 定义 session-value 能力需求。
- [x] 1.3 运行 OpenSpec 严格校验。

## 2. 数据模型与后端

- [x] 2.1 扩展 Rust / TypeScript session、metrics 和 report 类型。
- [x] 2.2 增加本地 value category / score / reasons 派生逻辑。
- [x] 2.3 增加 repair 半自动计时命令与 SQLite migration。
- [x] 2.4 增加 weekly report 生成与导出命令。

## 3. 前端体验

- [x] 3.1 Today 展示 value、成本、token、tool call 汇总。
- [x] 3.2 Inbox 和 Detail 展示 value chip、reasons、文件线索和人工时间状态。
- [x] 3.3 Detail 增加 repair start / finish 流程。
- [x] 3.4 Report 增加 Daily / Weekly 切换。
- [x] 3.5 补齐英文和简体中文文案。

## 4. 测试与验证

- [x] 4.1 补充 value 分类、fallback、report 和 Rust 测试。
- [x] 4.2 运行 `npm run openspec:validate`。
- [x] 4.3 运行 `npm run typecheck`、`npm run build`、`npm test`。
- [x] 4.4 启动本地预览并做 UI 渲染验证。
