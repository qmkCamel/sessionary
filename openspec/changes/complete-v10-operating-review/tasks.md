## 1. OpenSpec

- [x] 1.1 创建 V1.0 operating-review change。
- [x] 1.2 定义 AI Dev Operating Review 需求。
- [x] 1.3 运行 OpenSpec 严格校验。

## 2. 分析层

- [x] 2.1 扩展 Rust / TypeScript 类型，新增 Operating Review Summary。
- [x] 2.2 实现 task type 启发式分类。
- [x] 2.3 计算 tool performance、task success rate、delivery absorption、parallel health。
- [x] 2.4 生成 workflow reuse suggestions 和 delegation playbook。

## 3. 产品体验

- [x] 3.1 新增 Operating Review 页面。
- [x] 3.2 Today / Report overview 接入 Operating Review 摘要。
- [x] 3.3 Weekly report 增加 AI Dev Operating Review 章节。
- [x] 3.4 补齐 fallback 数据、测试和中英文文案。

## 4. 验证

- [x] 4.1 运行 `npm run openspec:validate`。
- [x] 4.2 运行 `npm run typecheck`、`npm run build`、`npm test`。
- [x] 4.3 启动本地预览并做桌面/窄屏渲染验证。
