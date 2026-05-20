# 代码导览

这份文档给不熟悉 Tauri 技术栈的贡献者快速建立项目地图。

## Tauri 的基本模型

Sessionary 分成两半：

- 前端是 React 应用，运行在系统 WebView 里，负责界面和交互。
- 后端是 Rust 进程，负责本地文件扫描、SQLite、日志解析、指标聚合和报告导出。

常见调用链是：

```text
React UI
  -> src/api.ts
  -> Tauri invoke(...)
  -> src-tauri/src/main.rs command
  -> Rust 业务模块
  -> SQLite / 本地文件
```

和 Electron 不同，Tauri 前端不能直接使用 Node.js 访问本地文件。本地文件、Git、
SQLite、原生 app 能力都应该通过 Rust command 暴露给前端。

## 顶层目录

### `src`

前端 React 代码。

当前主要产品界面集中在 `src/App.tsx`，样式集中在 `src/styles.css`。

### `src-tauri`

Tauri 和 Rust 后端代码。

这里包含 native command、本地存储、日志 parser、指标聚合和 app 打包配置。

### `docs`

产品定位、MVP 范围、设计参考、技术架构、路线图和实现决策。

### `fixtures`

Codex 和 Claude 日志解析测试样例。

Rust parser 测试会读取这些 fixture，避免日志格式适配回退。

### `dist`

`npm run build` 生成的前端生产产物。

Tauri release build 会把这个目录打进桌面 app。

## 前端文件

### `src/main.tsx`

React 入口文件，把 App 挂载到页面。

### `src/App.tsx`

主 UI 文件，包含 MVP 的主要视图：

- 首次启动 onboarding
- Today dashboard
- Session Inbox
- Project Timeline
- Daily Report
- Settings / Data Sources
- 右侧详情面板

目前 MVP 规模还不大，所以这个文件会比较集中。后续功能变多时，可以再拆 view 和
shared components。

### `src/api.ts`

前端调用 Tauri commands 的封装层。

典型函数包括：

- `scanSources()`
- `getDay()`
- `patchSession()`
- `startReview()`
- `finishReview()`
- `getSettings()`
- `saveSettings()`

桌面模式下这些函数调用 Tauri `invoke(...)`。浏览器预览模式下没有 Rust 后端，
所以会走 fallback 数据。

### `src/shared/types.ts`

前后端共享数据结构的 TypeScript 版本。

重要类型包括：

- `SessionRecord`
- `DayLedger`
- `OverlapInterval`
- `AppSettings`
- `SourceConfig`

如果 Rust 返回给前端的数据结构变了，这里通常也要同步更新。

### `src/data/fallback.ts`

前端-only 开发时使用的 mock/fallback 数据。

`npm run dev:web` 下 native Tauri commands 不可用，所以浏览器预览会使用这里的数据。

### `src/styles.css`

全局样式文件。

## Rust / Tauri 文件

### `src-tauri/tauri.conf.json`

Tauri app 配置。

这里定义产品名、窗口尺寸、开发环境前端地址、生产构建目录和打包目标。

关键字段：

- `build.beforeDevCommand`：开发模式启动前端 dev server。
- `build.devUrl`：开发模式加载的前端地址。
- `build.beforeBuildCommand`：release 打包前先构建前端。
- `build.frontendDist`：Tauri 打包时读取的前端产物目录。

### `src-tauri/src/main.rs`

Rust 入口，也是 Tauri command 注册处。

前端能调用哪些 Rust 函数，基本都需要在这里注册。

当前 command 包括：

- `scan_sources`
- `source_status`
- `get_day`
- `latest_date`
- `update_session`
- `start_review`
- `finish_review`
- `get_settings`
- `save_settings`
- `generate_report`
- `export_report`

### `src-tauri/src/models.rs`

Rust 数据模型。

这些 struct 会序列化返回给前端，应和 `src/shared/types.ts` 保持一致。

### `src-tauri/src/db.rs`

SQLite 层。

职责包括：

- 建表和轻量迁移
- 打开 app 数据库
- 读写 sessions
- 跨 rescan 保留用户标注
- 存储 onboarding 状态
- 存储 source config
- 存储 review flow 状态

macOS 上数据库位于系统 app data 目录：

```text
~/Library/Application Support/Sessionary/sessionary.sqlite
```

### `src-tauri/src/ingest.rs`

扫描编排入口。

这个模块读取 Settings 里的 source paths，查找本地 JSONL 文件，调用对应 parser，
然后把解析出的 sessions 写入 SQLite。

### `src-tauri/src/parsers/codex.rs`

Codex JSONL parser。

负责提取 session 元数据，例如消息数量、tool calls、时间戳、token/cost 线索、
changed files 和 Git 上下文。

### `src-tauri/src/parsers/claude.rs`

Claude JSONL parser。

支持 Claude 本地 project JSONL 和 OpenTelemetry 风格事件日志。

### `src-tauri/src/analytics.rs`

每日 ledger 聚合逻辑。

负责计算 Today 指标、项目汇总和并行工作的 overlap intervals。

### `src-tauri/src/report.rs`

Markdown 日报生成和本地导出。

### `src-tauri/src/git.rs`

Git 元数据助手。

用于识别 repository root、branch、dirty 状态和 changed files。

### `src-tauri/src/util.rs`

小型共享工具，例如 stable id 和 local date helpers。

## 常见流程

### Rescan

```text
App.tsx button
  -> src/api.ts scanSources()
  -> invoke("scan_sources")
  -> main.rs
  -> ingest.rs
  -> parsers/codex.rs 或 parsers/claude.rs
  -> db.rs 写入 SQLite
  -> 前端重新 getDay()
  -> analytics.rs 聚合 day ledger
  -> UI 刷新
```

### 标记一个 session 为 Useful

```text
App.tsx
  -> src/api.ts patchSession()
  -> invoke("update_session")
  -> main.rs update_session
  -> db.rs update_session
  -> SQLite 更新 status
  -> 前端更新当前 ledger
```

### 完成 review flow

```text
App.tsx
  -> startReview() 或 finishReview()
  -> Tauri command
  -> db.rs 更新 review 状态
  -> 返回更新后的 SessionRecord
  -> 右侧详情面板和 Inbox 更新
```

## 改功能时看哪里

- 改 UI 行为：`src/App.tsx`
- 改视觉样式：`src/styles.css`
- 改前后端 API 调用：`src/api.ts`
- 改前端共享类型：`src/shared/types.ts`
- 注册或调整 Tauri command：`src-tauri/src/main.rs`
- 改 Rust 数据模型：`src-tauri/src/models.rs`
- 改 SQLite schema 或持久化：`src-tauri/src/db.rs`
- 改 Codex / Claude 解析：`src-tauri/src/parsers/`
- 改指标和 overlap 逻辑：`src-tauri/src/analytics.rs`
- 改日报输出：`src-tauri/src/report.rs`

## 常用命令

```bash
npm run dev
npm run dev:web
npm run typecheck
npm run build
npm test
npm run tauri:build
```

快速前端迭代用 `npm run dev:web`。需要真实 Tauri commands、本地文件、SQLite 或
Rust 行为时，用 `npm run dev`。
