## 1. OpenSpec

- [x] 1.1 创建 V0.5 delivery-integrations change。
- [x] 1.2 定义 PR / CI / Issue 轻量归因需求。
- [x] 1.3 运行 OpenSpec 严格校验。

## 2. 后端归因

- [x] 2.1 扩展 delivery 类型，新增 integration。
- [x] 2.2 从 git remote / branch / commit subject 推断 GitHub PR candidate。
- [x] 2.3 基于本地 git graph 推断 commit merged 状态。
- [x] 2.4 从日志和测试命令生成 CI/local test signal。
- [x] 2.5 从 branch、summary、commit、note 解析 Linear/Jira/GitHub issue 线索。

## 3. 前端与报告

- [x] 3.1 Detail 显示 PR / issue / CI / review comment count。
- [x] 3.2 Operating Review 显示交付链路矩阵。
- [x] 3.3 Daily / Weekly report 包含 Delivery Integrations。
- [x] 3.4 补齐 fallback 数据、测试和中英文文案。

## 4. 验证

- [x] 4.1 运行 `npm run openspec:validate`。
- [x] 4.2 运行 `npm run typecheck`、`npm run build`、`npm test`。
- [x] 4.3 启动本地预览并做桌面/窄屏渲染验证。
