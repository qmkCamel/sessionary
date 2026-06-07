## 1. OpenSpec

- [x] 1.1 创建 timeline day slice 修复 change。
- [x] 1.2 定义跨天 session 的时间线展示口径。
- [x] 1.3 运行 OpenSpec 严格校验。

## 2. 前端实现

- [x] 2.1 基于 `ledger.metrics.date` 计算 +08 当天窗口。
- [x] 2.2 时间线 bounds 使用裁剪后的可见 session 区间。
- [x] 2.3 session block 位置、宽度和时长标签按可见区间计算。

## 3. 验证

- [x] 3.1 增加 timeline 单元测试覆盖跨天裁剪。
- [x] 3.2 运行 `npm run openspec:validate`。
- [x] 3.3 运行 `npm run typecheck`、`npm run build`、`npm test`。
- [x] 3.4 做本地渲染验证，确认时间线不再显示 500h+。
