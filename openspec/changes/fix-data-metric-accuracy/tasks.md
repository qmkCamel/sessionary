## 1. OpenSpec

- [x] 1.1 创建 `fix-data-metric-accuracy` change。
- [x] 1.2 定义数据口径修复范围、设计和验收标准。

## 2. 测试先行

- [x] 2.1 为日级窗口切片与 estimated/manual 拆分新增 Rust 测试。
- [x] 2.2 为 project parallel seconds 与同名项目误判新增 Rust 测试。
- [x] 2.3 为 delivery absorbed 保守判断与文件来源拆分新增 Rust 测试。
- [x] 2.4 为 Codex 消息去重新增 parser fixture / Rust 测试。
- [x] 2.5 为 review interval overlap 新增 Rust 测试。

## 3. 实现

- [x] 3.1 实现窗口贡献计算与 DayMetrics manual 字段。
- [x] 3.2 实现 ProjectSummary `parallelSeconds` 和 UI 展示修复。
- [x] 3.3 实现 DeliveryLink 文件来源拆分与 absorbed 保守判断。
- [x] 3.4 实现 Codex message count 去重。
- [x] 3.5 实现 review / repair interval 持久化和 overlap 优先使用 interval。
- [x] 3.6 同步 TypeScript 类型、fallback 数据、报告和文档。

## 4. 验证

- [x] 4.1 运行 `npm run openspec:validate`。
- [x] 4.2 运行 `npm run typecheck`。
- [x] 4.3 运行 `npm run build`。
- [x] 4.4 运行 `npm test`。
