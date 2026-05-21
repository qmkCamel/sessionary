## 1. OpenSpec

- [x] 1.1 创建 V0.4 delivery-linkage change。
- [x] 1.2 定义轻量交付关联需求。
- [x] 1.3 运行 OpenSpec 严格校验。

## 2. 后端与数据

- [x] 2.1 扩展 Rust / TypeScript 类型，新增 session delivery linkage。
- [x] 2.2 扩展 SQLite schema，保存 `delivery_json` 并保留手动 absorbed。
- [x] 2.3 从本地 git 提取 dirty diff、commit、文件线索。
- [x] 2.4 从 session 日志提取本地测试命令。
- [x] 2.5 生成日级 delivery review summary。

## 3. 前端与报告

- [x] 3.1 Today 展示 delivery metrics。
- [x] 3.2 Session detail 展示 delivery section 和 absorbed 操作。
- [x] 3.3 Daily / Weekly report 包含 Delivery Review。
- [x] 3.4 补齐 fallback 数据、测试和中英文文案。

## 4. 验证

- [x] 4.1 运行 `npm run openspec:validate`。
- [x] 4.2 运行 `npm run typecheck`、`npm run build`、`npm test`。
- [x] 4.3 启动本地预览并做桌面/窄屏渲染验证。
