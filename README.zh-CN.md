# Sessionary

简体中文 | [English](README.md)

[![CI](https://github.com/qmkCamel/sessionary/actions/workflows/ci.yml/badge.svg)](https://github.com/qmkCamel/sessionary/actions/workflows/ci.yml)

面向 Codex 和 Claude Code 会话的 local-first AI 编程会话账本。

Sessionary 会把分散在本地的 AI 编程日志整理成每日账本：你做了哪些工作、哪些
session 跑过、哪些工作发生了重叠，以及哪些 session 还需要 review、repair 或后续处理。

> 状态：v1.0 本地 operating review。应用目前覆盖本地 session 价值复盘、人工时间修正、
> 并行 workflow 复盘、轻量交付关联、PR/CI/issue 归因，以及 AI delegation playbook。
> 发布准备工作覆盖 Keychain 凭据、备份/恢复、集成诊断和本地打包检查。签名、自动更新
> 和团队功能尚未就绪。

## 截图

![Today dashboard](docs/images/today-dashboard.png)

![Session inbox](docs/images/session-inbox.png)

![Project timeline](docs/images/project-timeline.png)

![Daily report](docs/images/daily-report.png)

## 功能

- 扫描本地 Codex 和 Claude Code session metadata。
- 构建每日 session inbox，用于 review 和清理。
- 展示项目时间线、session overlap 和并行工作。
- 基于本地价值信号对 session 分类，例如状态、文件线索、tool calls、token 使用、成本和人工 repair 时间。
- 复盘并行工作是否真的有效，包括 overlap、review backlog 和 context switching 信号。
- 将 session 关联到本地交付信号，例如 changed files、dirty changes、commit candidates、
  absorbed status、test commands、PR candidates、CI/local test signals 和 issue keys。
- 构建 AI Dev Operating Review，包含任务类型成功率、工具表现和个人 delegation playbook。
- 将可选 GitHub / Linear 凭据存储在 macOS Keychain，并提供显式 sync diagnostics。
- 创建和恢复本地 SQLite 备份。Keychain 凭据不会包含在备份中。
- 支持标注 session 状态、笔记、review time 和 repair time，包括轻量 review/repair timers。
- 生成可编辑的日报和周报，可复制或本地导出。
- 所有应用数据存储在本地 SQLite。

## 隐私模型

Sessionary 是 local-first 应用。它不包含账户、云同步、团队 analytics 或 telemetry。

应用会扫描这些本地 metadata 路径：

- `~/.codex/sessions`
- `~/.codex/archived_sessions`
- `~/.claude/projects`
- `~/.claude`

SQLite 数据存储在系统应用数据目录下的 `Sessionary/sessionary.sqlite`。

在敏感 session 日志上运行 Sessionary 前，请先阅读 [PRIVACY.md](PRIVACY.md)。

## 环境要求

- Node.js 20.19 或更新版本
- npm 10 或更新版本
- Rust 1.95.0
- 当前操作系统所需的 Tauri 2 system dependencies

可选：

- `mise`，用于通过 [mise.toml](mise.toml) 安装 pinned Rust toolchain
- `rustup`，用于让 Cargo 通过 [rust-toolchain.toml](rust-toolchain.toml) 安装 pinned toolchain

## 运行桌面应用

```bash
npm ci
npm run tauri:dev
```

如果使用 `mise`，先安装 pinned toolchain：

```bash
mise install
npm run tauri:dev
```

## 浏览器预览

仅开发前端时：

```bash
npm run dev:web
```

浏览器预览中无法使用 native Tauri commands，因此应用的部分区域会使用 fallback data。

## 验证

```bash
npm run openspec:validate
npm run typecheck
npm run build
npm test
```

## 当前能力

- Today dashboard，展示 session、project、estimated time 和 parallel metrics。
- First-run onboarding，以及可编辑 Codex / Claude 路径的 Settings / Data Sources。
- Session Inbox，支持 filters、keyboard cleanup、status annotation、brief auto-advance、
  notes 和 manual time correction。
- Project Timeline，支持 project tracks、session blocks、overlap bands、15m / 30m / 60m zoom、
  drag selection 和 overlap summaries。
- Daily Report 生成、编辑、复制到剪贴板和本地 Markdown 导出。
- Weekly AI Dev Operating Review，包含 delivery absorption、PR/CI/issue attribution、
  task-type success rates 和 playbook suggestions。
- Codex JSONL 和 Claude Code JSONL 的 Rust parsers。
- Claude Code parser fixture 覆盖 local project JSONL 和 OpenTelemetry-style JSONL。
- 本地 SQLite 持久化，并在 rescan 后保留用户标注。
- session overlap 和跨项目 parallel work 计算。

## 项目文档

- [产品定位](docs/product-positioning.md)
- [MVP 能力](docs/mvp-capabilities.md)
- [代码导览](docs/codebase-guide.md)
- [技术架构](docs/technical-architecture.md)
- [实现决策](docs/implementation-decisions.md)
- [发布准备](docs/release-readiness.md)
- [路线图](docs/roadmap.md)
- [OpenSpec 项目约定](openspec/project.md)

## 贡献

请先阅读 [CONTRIBUTING.md](CONTRIBUTING.md)。非 trivial 改动必须先在
`openspec/changes/<change-id>/` 下创建 OpenSpec change。

安全问题请按 [SECURITY.md](SECURITY.md) 处理。一般支持问题请参考 [SUPPORT.md](SUPPORT.md)。

## License

Sessionary 使用 [ISC License](LICENSE) 发布。
