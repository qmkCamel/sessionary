# Sessionary Agents Guide

本仓库面向 AI agent 的工作约定。

## 工作流

- 非 trivial 改动必须先创建或更新 `openspec/changes/<change-id>/`，再进入实现。
- OpenSpec 文档默认使用中文，必要技术名词保留英文。
- 一个 OpenSpec change 只承载一个可独立验证的能力。
- `openspec/specs` 和 active changes 是行为真相源；实现代码应服从规格。

## 代码设计原则

- 实现代码默认遵循 SOLID 原则：
  - Single Responsibility：模块、组件、函数应保持清晰单一职责。
  - Open/Closed：新增能力优先通过扩展现有抽象完成，避免无关重写。
  - Liskov Substitution：抽象、接口、trait、组件 props 的替换关系必须保持行为一致。
  - Interface Segregation：避免臃肿接口，按调用方需要拆分能力。
  - Dependency Inversion：高层逻辑依赖稳定抽象，避免直接耦合底层实现细节。
- 使用设计模式要服务于当前问题，不为了套模式而增加复杂度。
- 优先沿用仓库已有架构和模式；只有在能降低复杂度、隔离变化点或改善可测试性时才新增抽象。
- 新增 shared logic、parser、analytics、storage、UI state 等能力时，应主动考虑合适的模式，例如 Strategy、Adapter、Factory、Repository、Observer，但必须保持实现可读、可测试。
- 发现函数、组件或模块职责过多时，应先拆分职责，再实现新逻辑。

## 当前产品与技术栈

- 产品：local-first AI coding session ledger / inbox。
- 桌面壳：Tauri 2。
- 前端：React + TypeScript + Vite。
- 本地数据：SQLite + Rust parser/analytics/report commands。

## 验证

- 规格变更需通过 `npm run openspec:validate`。
- 前端改动至少运行 `npm run typecheck`、`npm run build`、`npm test`。
- 涉及 UI 的改动应做本地渲染验证，不只看构建输出。
