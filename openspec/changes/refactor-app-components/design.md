# Design: 拆分 App.tsx 前端组件边界

## 模块边界

- `src/app/types.ts`：顶层 view/filter/range/report 类型。
- `src/app/translation.tsx`：Translation context 和 hook。
- `src/app/labels.ts`：状态、value、insight、task type、nav label 映射。
- `src/app/format.ts`：时间、数字、百分比、成本等展示格式化。
- `src/app/delivery.ts`：PR/CI/Issue 展示 helper。
- `src/components/`：跨页面复用的 header/sidebar/cards/detail/timeline/review 组件。
- `src/views/`：Today、Inbox、Project Timeline、Operating Review、Report、Settings、Onboarding 页面。
- `src/App.tsx`：保留应用状态、数据加载、API action、视图路由。

## 行为约束

- 拆分不改变 props、状态流和 API 调用语义。
- 样式 className 维持原值，避免 CSS 行为变化。
- 组件移动后仍使用同一翻译上下文。

## 验证

- `npm run openspec:validate`
- `npm run typecheck`
- `npm run build`
- `npm test`
- 本地预览验证 Settings / Today / Inbox 等主入口正常渲染。

## 风险

- 大规模移动容易引入 import 漏项。用 TypeScript typecheck 作为主要保护。
- React 组件拆分可能遗漏 helper export。通过页面渲染和 tests 兜底。
