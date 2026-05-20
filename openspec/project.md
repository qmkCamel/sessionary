# Sessionary OpenSpec 项目约定

## 项目目标

Sessionary 是一个 local-first 桌面应用，用来整理、标注和复盘 Codex / Claude Code 等 AI 编程会话。它帮助用户看到当天 AI 协作的会话队列、项目时间线、并发工作和日报。

## 当前基线

- 桌面应用：Tauri 2。
- 前端：React + TypeScript + Vite。
- 本地后端：Rust commands。
- 持久化：SQLite，存储在系统应用数据目录 `Sessionary/sessionary.sqlite`。
- 数据来源：本地 Codex 与 Claude Code session JSONL，以及 Git 元数据。

## 工作流

较大变更放在 `openspec/changes/<change-id>/`：

- `proposal.md`：为什么做、做什么、不做什么。
- `design.md`：关键设计、数据流、风险和决策。
- `tasks.md`：可执行任务清单。
- `specs/<capability>/spec.md`：能力级需求变更，使用 `ADDED Requirements` / `MODIFIED Requirements`。

OpenSpec 文档默认使用中文。实现完成前必须运行 OpenSpec 校验和代码验证。

