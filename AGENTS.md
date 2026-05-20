# Sessionary Agents Guide

本仓库面向 AI agent 的工作约定。

## 工作流

- 非 trivial 改动必须先创建或更新 `openspec/changes/<change-id>/`，再进入实现。
- OpenSpec 文档默认使用中文，必要技术名词保留英文。
- 一个 OpenSpec change 只承载一个可独立验证的能力。
- `openspec/specs` 和 active changes 是行为真相源；实现代码应服从规格。

## 当前产品与技术栈

- 产品：local-first AI coding session ledger / inbox。
- 桌面壳：Tauri 2。
- 前端：React + TypeScript + Vite。
- 本地数据：SQLite + Rust parser/analytics/report commands。

## 验证

- 规格变更需通过 `npm run openspec:validate`。
- 前端改动至少运行 `npm run typecheck`、`npm run build`、`npm test`。
- 涉及 UI 的改动应做本地渲染验证，不只看构建输出。

