## 1. OpenSpec

- [x] 1.1 创建 refactor-app-components change。
- [x] 1.2 定义模块边界和无行为变化约束。
- [x] 1.3 运行 OpenSpec 校验。

## 2. 拆分模块

- [x] 2.1 提取 app types、translation、labels、format helpers。
- [x] 2.2 提取 shared components。
- [x] 2.3 提取页面 views。
- [x] 2.4 收敛 `App.tsx` 为状态编排和路由。

## 3. 验证

- [x] 3.1 运行 `npm run openspec:validate`。
- [x] 3.2 运行 `npm run typecheck`、`npm run build`、`npm test`。
- [x] 3.3 启动本地预览并做渲染验证。
