# Sessionary 技术架构方案

日期：2026-05-19

## 结论

Sessionary 第一版推荐使用：

- 桌面框架：Tauri 2
- 前端：React + TypeScript + Vite
- UI：Tailwind CSS + shadcn/ui + Recharts 或 Visx
- 本地核心：Rust commands + parser modules
- 数据库：SQLite
- 数据访问：Drizzle ORM 或 Kysely
- 后台任务：Tauri sidecar / Rust async task
- 打包分发：Tauri bundler

这个栈的重点不是追求技术新鲜感，而是匹配产品约束：本地优先、隐私敏感、需要读取本地文件、需要长期稳定解析日志、需要桌面级体验。

## 为什么选 Tauri

Sessionary 需要读本地日志、项目路径和 git 状态。Tauri 比纯 Web 更适合本地权限模型，也比 Electron 更轻。

选择 Tauri 的理由：

- 应用体积小，适合个人工具。
- Rust 后端适合写本地 parser、文件扫描和 SQLite 任务。
- 权限配置可以显式收敛，利于建立用户信任。
- 前端仍然可以用 React 快速搭建复杂 UI。
- 后续可以支持菜单栏、后台扫描、文件监听和系统通知。

Electron 也是可行方案，但第一版不推荐作为首选：

- 体积更大。
- 本地安全面更宽。
- 对一个强调克制、隐私、本地优先的工具来说偏重。

纯 Web 不适合作为第一版主形态：

- 读取本地 Codex / Claude Code 日志体验差。
- 需要额外 daemon 或上传日志。
- 更容易让用户担心隐私。

## 系统分层

推荐分为五层：

1. Desktop shell
2. Ingestion
3. Normalization
4. Ledger store
5. Product UI

### Desktop Shell

职责：

- 应用窗口。
- 本地权限声明。
- 数据源设置。
- 后台扫描调度。
- 文件系统访问。

技术：

- Tauri window
- Rust commands
- Tauri filesystem capability allowlist
- macOS app bundle

### Ingestion

职责：

- 读取不同工具的本地日志。
- 识别新增或变化的 session。
- 记录扫描进度。
- 捕获解析错误但不中断主流程。

第一版数据源：

- Codex
- Claude Code
- Git

后续数据源：

- Cursor
- Gemini CLI
- GitHub PR metadata
- Linear / Jira

### Normalization

职责：

- 把不同来源的事件转成统一 session model。
- 计算 session 起止时间、轮数、tool calls、项目路径。
- 识别 overlap。
- 估算 prompting / waiting / review / repair。

原则：

- 原始日志只读。
- 解析结果可重建。
- 用户标注独立保存，不随重新解析丢失。
- 对不确定字段标记 confidence。

### Ledger Store

职责：

- 保存规范化后的 days、projects、sessions、events、annotations。
- 支持按日期快速查询。
- 保存用户手动修正。
- 支持后续导出。

推荐数据库：

- SQLite。

推荐本地路径：

- macOS：`~/Library/Application Support/Sessionary/sessionary.sqlite`

数据库不要保存完整源码内容。默认也不要保存完整 prompt / response。第一版只保存摘要级或元数据级信息。

### Product UI

职责：

- Today 总览。
- Session Inbox 清理。
- Project Timeline 并行视图。
- Daily Report 复盘。
- Settings / Data Sources。

技术：

- React
- TypeScript
- Vite
- Tailwind CSS
- shadcn/ui
- TanStack Query
- Zustand 或 Jotai
- Recharts 或 Visx

## 数据模型

### days

字段：

- id
- date
- project_count
- session_count
- ai_waiting_seconds_estimated
- prompting_seconds_estimated
- review_seconds_estimated
- repair_seconds_estimated
- parallel_seconds
- generated_at

### projects

字段：

- id
- name
- root_path
- repo_id
- primary_tool
- first_seen_at
- last_seen_at

### sessions

字段：

- id
- source
- source_session_id
- project_id
- cwd
- started_at
- ended_at
- duration_seconds
- user_message_count
- assistant_message_count
- tool_call_count
- token_count
- cost_amount
- status
- status_updated_at
- note
- confidence

### session_events

字段：

- id
- session_id
- event_type
- occurred_at
- duration_seconds
- source_payload_ref
- summary

event_type 示例：

- user_message
- assistant_message
- tool_call
- command_run
- file_changed
- waiting
- review
- repair

### annotations

字段：

- id
- session_id
- annotation_type
- value
- is_manual
- created_at
- updated_at

annotation_type 示例：

- status
- prompting_seconds
- waiting_seconds
- review_seconds
- repair_seconds
- note

### scan_runs

字段：

- id
- source
- started_at
- finished_at
- status
- files_scanned
- sessions_found
- error_count
- cursor

## Codex Parser

目标：

- 从 Codex 本地 session / rollout 日志提取 session ledger 需要的元数据。

第一版提取：

- session id
- cwd
- 时间戳
- user messages 数量
- assistant messages 数量
- tool calls 数量
- exec command 活动
- session 起止时间
- 相关文件路径线索

解析策略：

- 把 parser 做成纯函数：输入日志文件，输出 normalized events。
- 对未知字段保留 source reference，但不让 UI 依赖原始结构。
- 解析失败时记录 scan_runs error，不阻塞其他文件。

## Claude Code Parser

目标：

- 从 Claude Code 本地 projects 日志或 OpenTelemetry 数据中提取 session activity。

第一版提取：

- session id 或可稳定聚合的 run id。
- project path。
- active time。
- user / assistant / tool event。
- token / cost，如果日志可得。
- tool activity。

解析策略：

- 优先使用结构化日志或 OTEL 事件。
- 对路径做规范化，避免同一项目因 symlink / worktree 命名产生重复。
- token / cost 字段作为可选字段，不作为核心体验依赖。

## Git Adapter

MVP 中 Git 只做轻量读取。

能力：

- 识别 repo root。
- 读取 branch。
- 判断 dirty state。
- 读取 session 前后是否有文件变化。
- 生成文件变化摘要。

不做：

- 自动 commit。
- 自动创建 PR。
- CI 归因。
- Jira / Linear 关联。

## Overlap 算法

输入：

- 当天所有 session 的 started_at 和 ended_at。
- session 所属 project。

输出：

- session overlap intervals。
- project overlap intervals。
- parallel_seconds。
- max_concurrent_sessions。
- max_concurrent_projects。

算法：

1. 把每个 session 转成 start / end 两个事件。
2. 按时间排序。
3. 扫描事件流，维护 active sessions 和 active projects。
4. 当 active sessions 数量大于 1 时，记录 session overlap。
5. 当 active projects 数量大于 1 时，记录 project overlap。
6. 合并相邻或重叠的 interval。

注意：

- ended_at 缺失的 session 标记为 open，不参与最终日报的精确统计。
- 跨午夜 session 按日期切片。
- overlap 区间要保留参与的 session ids，便于 UI 点击查看。

## 人工时间估算

第一版采用估算，不做精确计时。

Prompting：

- 根据 user message 时间戳和相邻事件间隔估算。
- 对单次间隔设置上限，例如 5 分钟。

Waiting：

- 根据 assistant response、tool call、command run 区间估算。
- 如果缺少细粒度 duration，用 session active interval 回退估算。

Review：

- 优先使用用户手动 Start Review / Done。
- 如果没有手动数据，用 session 结束后同项目下一次操作前的短间隔估算。

Repair：

- 优先使用 Needs repair / Repaired 状态流。
- 结合 session 后项目文件变化作为线索。

所有估算字段必须带 estimated 标记。用户手动修改后标记为 manual。

## 隐私与安全

默认策略：

- 不上传源码。
- 不上传完整 prompt。
- 不上传完整 response。
- 本地 SQLite 加用户主目录权限保护。
- Settings 中明确显示读取路径。
- 数据源可以逐个关闭。

后续如果做云同步，需要单独设计：

- 同步哪些字段。
- 是否端到端加密。
- 如何排除敏感路径和 prompt。
- 用户如何导出和删除数据。

## 前端页面结构

推荐目录：

```text
src/
  app/
    App.tsx
    routes.tsx
  features/
    today/
    inbox/
    timeline/
    report/
    settings/
  components/
    layout/
    timeline/
    session/
    metrics/
  data/
    api.ts
    queries.ts
    types.ts
  styles/
    globals.css
src-tauri/
  src/
    commands/
    parsers/
    ingestion/
    db/
    git/
```

## 验证策略

Parser 测试：

- 使用 fixture 日志验证 Codex parser。
- 使用 fixture 日志验证 Claude Code parser。
- 覆盖字段缺失、跨天 session、解析错误。

算法测试：

- overlap interval。
- project overlap。
- open session。
- 跨午夜切片。

前端测试：

- Today 有数据 / 空数据 / 扫描中。
- Inbox 状态切换。
- Timeline overlap 高亮。
- Daily Report 复制 Markdown。

端到端验证：

- 准备一组本地 fixture。
- 运行首次扫描。
- 验证 Today 指标。
- 标注 session 状态。
- 生成日报。

## 开发阶段建议

### Phase 1：原型与静态数据

- 建 Tauri + React 框架。
- 使用 mock sessions 驱动 Today / Inbox / Timeline / Report。
- 验证信息架构和视觉密度。

### Phase 2：本地数据库

- 接入 SQLite。
- 定义 schema。
- 完成 session CRUD 和 annotation。
- UI 从本地数据库读取。

### Phase 3：Codex Parser

- 读取 Codex 日志 fixture。
- 写入 normalized sessions。
- Today / Inbox 展示真实解析结果。

### Phase 4：Claude Code Parser

- 接入 Claude Code 日志或 OTEL fixture。
- 统一 source model。
- 增加 source filter。

### Phase 5：日报与估算

- 实现人工时间估算。
- 实现 Daily Report Markdown。
- 增加手动修正。

## 技术风险

### 日志格式不稳定

应对：

- parser 与 UI 解耦。
- 保存 scan_runs 和 parser version。
- fixture 覆盖常见版本。

### 人工时间估算不准

应对：

- 明确 estimated。
- 支持手动修正。
- 聚焦趋势而不是秒级准确。

### 本地权限过宽

应对：

- 首次启动明确展示路径。
- 数据源逐项授权。
- 避免扫描整个磁盘。

### 产品过早变重

应对：

- 第一版只做 session ledger。
- PR/CI/Issue 集成放到后续阶段。
- token/cost 作为附属信息，不做主体验。
