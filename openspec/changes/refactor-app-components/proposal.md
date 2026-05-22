# Change: 拆分 App.tsx 前端组件边界

## 背景

`src/App.tsx` 已超过 2600 行，同时包含应用状态、页面视图、Settings、Detail、Timeline、Report、格式化 helper 和翻译上下文。继续在单文件中扩展会降低 review 质量并增加回归风险。

## 目标

- 将 `App.tsx` 拆成按职责命名的组件、视图和工具模块。
- 保持现有 UI 行为、文案、API 调用和样式不变。
- 让 `App.tsx` 只负责顶层状态编排和视图路由。
- 通过构建、测试和本地渲染验证确认无行为回归。

## 不做

- 不重新设计 UI。
- 不改变 SQLite、Tauri command 或业务模型。
- 不引入新的前端状态管理库。

## 用户价值

后续继续做 release、诊断、报告和新数据源时，可以在更小的文件边界里修改，降低冲突和回归概率。

## 成功标准

- `src/App.tsx` 行数显著下降。
- 页面级组件移动到 `src/views/`。
- 通用 helper / shared UI 移动到 `src/app/` 或 `src/components/`。
- 自动化验证和本地渲染验证通过。
