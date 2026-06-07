# Sessionary 数据口径说明

日期：2026-05-25

## 结论

Sessionary 当前的数据口径是本地优先、session-first、估算优先。核心事实源不是单独的 `days` 或 `projects` 表，而是本地 SQLite 的 `sessions`、`scan_runs`、`source_configs` 和 `app_settings`；Today、Timeline、Report、Operating Review 等日级或周级指标均在读取时从 session records 实时聚合。

这套口径适合回答“今天有哪些 AI coding sessions、它们是否已经 review / repair / absorb、并行开发大概有没有产生收益”，但不适合当作精确工时、绩效排名、逐行代码归因或财务级成本统计。

时间统计拆成两份说明：面向用户的 PR 稿见 `docs/user-facing-time-metrics.md`，开发者实现口径见 `docs/developer-time-metrics.md`。本文档保留全局数据模型、聚合和跨模块口径。

本次修复后，几个关键边界已经收敛：

- 跨天 session 的日级时间、tool call、token、cost 会按日期窗口计算，不再把整条 session 重复计入相邻日期。
- `DayMetrics` 中 estimated 与 manual 时间已经拆分，前端展示总人工时间时会合并两者，并在存在 manual 时间时显示混合来源提示。
- Project summary 已提供 `parallelSeconds`，Today 项目表展示真实项目并行秒数，不再把 project active duration 当作并行时间。
- `ProjectSummary.isParallel` 改为基于 overlap session ids 与项目 session ids 判断，避免同名项目误判。
- Delivery 已拆分 `fileHints`、`gitDirtyFiles`、`commitFiles`，`changedFiles` 仍作为兼容聚合字段。
- Detail 文件展示按 `fileHints`、`gitDirtyFiles`、`commitFiles` 分组，避免把聚合字段误读成单一来源。
- 自动 `absorbed` 已保守化：必须有 session 文件线索与 commit 文件重叠，且当前 repo 不 dirty。
- Codex parser 不再把 `event_msg` 与 `response_item.message` 中的镜像消息重复计数。
- Review / repair flow 会保存实际 interval，parallel review 会优先使用真实 interval 计算 waiting/human overlap。

仍需注意：delivery、task type、value score 仍是启发式复盘信号，不是精确代码归因、绩效评价或财务审计。

## 数据来源

| 来源 | 当前用途 | 入口 | 可信度边界 |
| --- | --- | --- | --- |
| Codex JSONL | session id、cwd、时间戳、消息数、tool calls、token/cost、文件线索、测试命令线索 | `src-tauri/src/parsers/codex.rs` | 日志结构可能变化；消息数会分别统计 `event_msg` 与 `response_item.message` 后取较大值，避免镜像消息重复计数 |
| Claude JSONL / OTEL | session id、项目路径、时间戳、消息数、tool calls、token/cost、文件线索、测试命令线索 | `src-tauri/src/parsers/claude.rs` | token/cost 为事件累加；不同 Claude 日志形态字段覆盖不一致 |
| 本地 Git | repo root、branch、dirty state、dirty files、session 附近 commits、PR/issue 本地文本线索 | `src-tauri/src/git.rs` | 是归因线索，不是精确代码所有权；文件来源已拆为 file hints / dirty files / commit files |
| 用户手动标注 | status、note、prompting/waiting/review/repair 手动修正、absorbed 手动状态 | `src-tauri/src/db.rs` | 重新扫描时应保留 status、note、manual 时间和手动 absorbed |
| GitHub / Linear 可选同步 | PR state、merge status、review comments、issue title/state、CI | `src-tauri/src/integrations.rs` | 仅用户启用且保存 token 后访问远程；同步结果仍写回本地 delivery integration |
| 前端 fallback | 无 Tauri 后端时预览 UI | `src/data/fallback.ts` | demo 数据，不作为真实扫描和报表口径依据 |

## 存储模型

当前 SQLite schema 由 `src-tauri/src/db.rs` 内联维护。

### `sessions`

主表，保存每个 normalized session。关键字段包括：

- 身份：`id`、`source`、`source_session_id`。
- 项目：`project_name`、`project_path`、`cwd`。
- 时间：`started_at`、`ended_at`、`duration_seconds`。
- 活动计数：`user_message_count`、`assistant_message_count`、`tool_call_count`、`token_count`、`cost_amount`。
- 人工时间：`prompting_seconds`、`waiting_seconds`、`review_seconds`、`repair_seconds`。
- AI 等待区间：`ai_waiting_intervals_json`。
- 实际计时间隔：`review_intervals_json`、`repair_intervals_json`。
- 时间来源：`time_fields_json`，字段值为 `estimated` 或 `manual`。
- 用户标注：`status`、`status_updated_at`、`note`。
- 文件与交付：`changed_files_json`、`git_branch`、`git_dirty`、`delivery_json`、`delivery_absorbed_manual`。
- 本地线索：`summary`、`source_file`、`confidence`。

`id` 当前形如 `codex:<source_session_id>` 或 `claude:<source_session_id>`。如果日志没有明确 session id，parser 会基于文件路径生成稳定 hash。

### `scan_runs`

记录每次 source scan 的结果：

- `source`
- `started_at`
- `finished_at`
- `status`
- `files_scanned`
- `sessions_found`
- `error_count`
- `cursor`
- `error_message`

这些字段用于 Settings / Data Sources 的 source health，而不是 Today 的 session 指标。

### `source_configs`

保存每个 source 是否启用，以及扫描路径列表。默认路径为：

- Codex：`~/.codex/sessions`、`~/.codex/archived_sessions`
- Claude：`~/.claude/projects`、`~/.claude`

### `app_settings`

保存 onboarding、project roots、语言偏好、integration settings 等应用设置。GitHub / Linear token 不应保存在 SQLite 中；当前 token 走本机 Keychain。

## 时间与日期

所有 parser 时间戳会通过 `normalize_timestamp` 转为 UTC RFC3339，精度到毫秒。前端展示时使用浏览器本地时间格式。

日窗口使用固定 `+08:00` 边界：

- day start：`YYYY-MM-DDT00:00:00+08:00`
- day end：下一天 `00:00:00+08:00`

周报使用周一到周日，同样按 `+08:00` 日边界。

`duration_seconds = max(0, ended_at - started_at)`。当前 parser 只要有时间戳就会取最早时间为开始、最晚时间为结束；没有结束事件的 session 不会用“当前时间”扩展 duration。

## Parser 口径

### Codex

Codex parser 读取 JSONL，每行解析为 JSON value。

字段口径：

- `source_session_id`：优先取 `session_meta.payload.id`，否则用文件路径稳定 hash。
- `cwd`：优先取 `session_meta.payload.cwd`，否则回退到日志文件父目录。
- `started_at` / `ended_at`：所有顶层 `timestamp` 与 `session_meta.payload.timestamp` 的最早 / 最晚值。
- `user_message_count`：分别统计 `event_msg.payload.type = user_message` 与 `response_item.payload.type = message && role = user`，最终取两者较大值。
- `assistant_message_count`：分别统计 `event_msg.payload.type = agent_message` 与 `response_item.payload.type = message && role = assistant`，最终取两者较大值。
- `tool_call_count`：`response_item.payload.type = function_call` 的数量。
- `token_count`：从 `event_msg.payload.type = token_count` 里读取 total usage，取最大值。
- `cost_amount`：同 token，从 usage/cost 字段取最大值。
- `summary`：第一条用户消息压缩空白后截断到 180 字符。
- `changed_files`：从 function call arguments/output 中提取文件路径，再与 local git delivery changed files 合并后的结果。
- `test_commands`：从日志文本中正则识别 `npm/pnpm/yarn/bun test/build/typecheck/lint`、`cargo test/clippy/fmt`、`pytest`、`go test`、`make test/check/lint` 等命令。

注意：如果某版 Codex 日志只写入其中一种消息形态，取较大值仍会保留该来源的计数；如果两种形态是完全不同的增量来源，计数会偏保守。

### Claude

Claude parser 支持本地 projects JSONL 与 OpenTelemetry 风格事件。

字段口径：

- `source_session_id`：优先取 `sessionId/session_id/conversationId/uuid/session.id/claude.session.id/prompt.id`，否则用文件路径稳定 hash。
- 分组：同一文件内按 `source_session_id` 分组，每组生成一个 `SessionRecord`。
- `cwd`：优先取事件中的 `cwd/projectPath/project_path/project.path`；否则从 `.claude/projects/<encoded-path>` 推断。
- `started_at` / `ended_at`：组内事件 timestamp 的最早 / 最晚值。
- `user_message_count` / `assistant_message_count`：按 role/type/name 判断。
- `tool_call_count`：role 包含 `tool`，或存在 `toolUseResult/tool_use_id`。
- `token_count`：组内 usage token 字段累加。
- `cost_amount`：组内 usage cost 字段累加。
- `changed_files`：结构化 path 字段、本地 git dirty/commit 文件线索合并后的结果。

## 人工时间口径

当前自动估算不是精确计时。

| 字段 | Parser 默认算法 | 含义 |
| --- | --- | --- |
| `prompting_seconds` | `clamp(user_message_count * 90, 0, duration * 0.35)` | 用户输入/指令整理的估算时间 |
| `waiting_seconds` | 优先为 `ai_waiting_intervals` 合计；缺失时回退为 `duration_seconds - prompting_seconds` | 用户发送指令后等待 AI 本轮完成的可感知等待时间，或旧估算等待窗口 |
| `review_seconds` | 如果有结束时间，则 `clamp(duration * 0.12, 60, 900)` | session 结束后的默认人工复盘估算 |
| `repair_seconds` | 0 | 默认无修复时间，除非用户标记或手动录入 |

如果没有事件级 AI waiting interval，`prompting + waiting` 约等于 session duration。存在事件级 interval 时，`waiting` 只统计用户发送后到本轮 AI 最后事件的可感知等待区间，不再保证覆盖完整 session active window。`review` 和 `repair` 是 session 后置人工时间，因此 `prompting + waiting + review + repair` 可以大于 `duration_seconds`。

用户在 Detail 里保存时间后，对应字段标记为 `manual`，后续重新扫描不会覆盖该字段。`Start Review / Done` 会累加实际经过时间到 `review_seconds`、写入 `review_intervals_json`，并标记 manual；`Start Repair / Mark Repaired` 会累加到 `repair_seconds`、写入 `repair_intervals_json`，并标记 manual。

日级汇总会把 estimated 与 manual 拆开：`promptingSecondsEstimated` 只包含 estimated prompting 贡献，`promptingSecondsManual` 只包含 manual prompting 贡献，其他时间字段同理。

## Session Value 口径

Session value 在读取 session row 后本地派生，不直接存储为 SQLite 列。

基础分：45。

状态影响：

- `discarded`：直接归类 `discarded`，score 5。
- `failed`：直接归类 `discarded`，score 10。
- `needs_repair`：减 12，reason `needs_repair`。
- `unknown` / `needs_review`：减 6，reason `needs_review`。
- `useful`：加 24，reason `marked_useful`。
- `repaired`：加 16，reason `marked_repaired`。

产出信号：

- 有文件线索：加 14。
- 有 tool calls：加 `clamp(tool_call_count / 3, 3, 12)`。
- 有 token usage：加 4。
- 文件、tool、token 都没有：减 12。

成本信号：

- `cost_amount <= 1.0`：加 5。
- `cost_amount >= 2.0`：减 9。
- `cost_amount >= 5.0`：减 18。

人工成本信号：

- `(prompting + review + repair) / duration > 55%`：减 10。
- `repair_seconds > 0`：减 `clamp(repair_seconds / 300, 4, 16)`。

最终 score 限制在 0-100。

分类：

- `needs_repair` -> `needs_human_repair`
- `unknown` / `needs_review` -> `unreviewed`
- `useful` / `repaired` 且 score >= 72 -> `high_value`
- `useful` / `repaired` 且 score >= 42 -> `mixed_value`
- 其他 useful/repaired -> `low_value`
- `failed` / `discarded` -> `discarded`

缺失 token/cost 不视为错误，也不应直接降低 value；聚合展示时缺失值按 0 参与总和。

## Day Ledger 口径

`build_day_ledger(date)` 会先用 `sessions_between(day_start, day_end)` 查询所有与日窗口相交的 sessions：

```text
started_at < day_end AND COALESCE(ended_at, started_at) >= day_start
```

然后构建：

- `metrics`
- `projects`
- `sessions`
- `overlaps`
- `sessionOverlaps`
- `parallelReview`
- `deliveryReview`
- `operatingReview`
- `sourceStatus`

### DayMetrics

| 字段 | 当前口径 |
| --- | --- |
| `date` | 请求日期字符串 |
| `projectCount` | 当天 sessions 的唯一 `project_path` 数 |
| `sessionCount` | 当天 sessions 数 |
| `aiWaitingSecondsEstimated` | day window 内 estimated waiting 贡献 |
| `aiWaitingSecondsManual` | day window 内 manual waiting 贡献 |
| `promptingSecondsEstimated` | day window 内 estimated prompting 贡献 |
| `promptingSecondsManual` | day window 内 manual prompting 贡献 |
| `reviewSecondsEstimated` | day window 内 estimated review 贡献 |
| `reviewSecondsManual` | day window 内 manual review 贡献 |
| `repairSecondsEstimated` | day window 内 estimated repair 贡献 |
| `repairSecondsManual` | day window 内 manual repair 贡献 |
| `toolCallCount` | 按 active overlap ratio 分摊后的 tool call 数，四舍五入 |
| `tokenCount` | 按 active overlap ratio 分摊后的 token 数，缺失按 0 |
| `costAmount` | 按 active overlap ratio 分摊后的 cost，单位按日志里的 USD 线索展示 |
| `highValueCount` | value category 为 `high_value` 的 session 数 |
| `lowValueCount` | value category 为 `low_value` 的 session 数 |
| `needsRepairValueCount` | value category 为 `needs_human_repair` 的 session 数 |
| `discardedValueCount` | value category 为 `discarded` 的 session 数 |
| `parallelSeconds` | 跨项目并行 wall-clock 秒数 |
| `parallelSessionSeconds` | 多 session 并行 wall-clock 秒数 |
| `parallelProjectRatio` | `parallelSeconds / totalActiveSeconds` |
| `aiWaitingHumanOverlapSeconds` | AI waiting 与其他 session human review/repair 的 pairwise overlap 秒数 |
| `reviewBacklogSessionCount` | ended 且状态为 unknown/needs_review/needs_repair 的 session 数 |
| `contextSwitchCount` | 按 started_at 排序后相邻 session 的 project_path 变化次数 |
| `absorbedSessionCount` | delivery absorbed 的 session 数 |
| `committedSessionCount` | delivery committedAfterSession 为 true 的 session 数 |
| `dirtyDeliverySessionCount` | delivery dirtyAfterSession 或 gitDirty 为 true 的 session 数 |
| `prLinkedSessionCount` | delivery integration 有 PR 的 session 数 |
| `ciSignalSessionCount` | delivery integration CI status 不是 `not_recorded` 的 session 数 |
| `maxConcurrentSessions` | 日窗口内最大同时 active sessions 数 |
| `maxConcurrentProjects` | 日窗口内最大同时 active projects 数 |
| `unknownCount` | status 为 unknown 的 session 数 |
| `needsReviewCount` | status 为 needs_review 的 session 数 |
| `needsRepairCount` | status 为 needs_repair 的 session 数 |
| `generatedAt` | 聚合生成时间，UTC |

跨天口径：查询仍会纳入与当天窗口相交的 session；日级 time 会按 modeled interval 与窗口的重叠秒数计算，tool/token/cost 会按 active overlap ratio 分摊。因此跨午夜 session 不会在相邻两天重复计入完整消耗。

### ProjectSummary

按 `project_path` 分组。

- `sessionCount`：该 project 当天 sessions 数。
- `startedAt`：该 project 当天最早 session start。
- `endedAt`：该 project 当天最晚 session end。
- `activeSeconds`：该 project sessions 的 `duration_seconds` 总和，不去重、不按 overlap 裁剪。
- `parallelSeconds`：该 project 实际参与 project overlap 的 wall-clock 秒数。
- `sources`：出现过的 source 去重。
- `isParallel`：基于 project overlap 的 `sessionIds` 与该 project session ids 是否相交判断。
- `gitBranch`：该 project sessions 中第一个非空 branch。
- `gitDirty`：任一 session git dirty 即 true。

注意：`activeSeconds` 是 session duration 总和，不是该项目的并行时长；Today 的并行列使用 `parallelSeconds`。

## Parallel Review 口径

### Overlap

`compute_overlaps` 把每个有 `ended_at` 的 session 裁剪到分析窗口内，再生成 start/end 事件扫描 active sessions。

- Project overlap：同一时间 active project 数大于 1。
- Session overlap：同一时间 active session 数大于 1。
- `seconds` 是 wall-clock 秒数，不按并发数量倍增。三个 sessions 同时 overlap 10 分钟，仍记 10 分钟，而不是 20 或 30 分钟。
- interval 会保留 `sessionIds` 和 `projectNames`，用于 UI 点击查看。

### ParallelReviewSummary

| 字段 | 当前口径 |
| --- | --- |
| `totalActiveSeconds` | 所有 session active intervals 的 union 秒数 |
| `parallelProjectSeconds` | project overlaps 秒数总和 |
| `parallelSessionSeconds` | session overlaps 秒数总和 |
| `parallelProjectRatio` | `parallelProjectSeconds / totalActiveSeconds` |
| `parallelSessionRatio` | `parallelSessionSeconds / totalActiveSeconds` |
| `maxConcurrentSessions` | 最大 active sessions 数 |
| `maxConcurrentProjects` | 最大 active projects 数 |
| `aiWaitingHumanOverlapSeconds` | AI waiting intervals 与其他 sessions 的 human intervals 的 pairwise overlap 秒数 |
| `reviewBacklogSessionCount` | 待 review/repair 的已结束 sessions 数 |
| `reviewBacklogSeconds` | 待处理 session 从 ended_at 到评估时间的等待秒数总和 |
| `contextSwitchCount` | 相邻 session start 的跨项目切换次数 |
| `shortContextSwitchCount` | 相邻 session start 间隔 <= 20 分钟的跨项目切换次数 |

AI waiting interval 当前优先级：

```text
1. ai_waiting_intervals: user_sent_at -> ai_finished_at
2. fallback: started_at + prompting_seconds -> ended_at
```

Human interval 当前定义为：

```text
ended_at -> ended_at + review_seconds + repair_seconds
```

如果用户使用 Start/Done 记录 review 或 repair，Sessionary 会保存实际 interval，并优先用该 interval 计算 overlap。只有历史数据或手动直接编辑累计秒数而没有 interval 时，才回退到 `ended_at` 之后的启发式区间。

`aiWaitingHumanOverlapSeconds` 是 pairwise session-seconds。如果一个 human review 同时覆盖两个 AI waiting sessions，会计入两份 overlap；它不是唯一 wall-clock 秒数。

## Delivery 口径

Delivery 是轻量归因，不是精确交付审计。

### GitInfo

`git_info(cwd)` 读取：

- repo root：`git rev-parse --show-toplevel`
- branch：`git branch --show-current`
- dirty state：`git status --porcelain` 是否有输出
- changed files：`git status --porcelain` 每行第 4 个字符之后的路径

如果 cwd 不存在，则使用 cwd 自身作为 root，branch 为空，dirty 为 false。

### DeliveryLink

`delivery_link` 输入 session cwd、时间、file hints、test commands、summary、note，输出：

- `fileHints`：parser 从 session 日志提取的文件线索。
- `gitDirtyFiles`：扫描时本地 git dirty files。
- `commitFiles`：session 窗口附近 commits 涉及的文件。
- `changedFiles`：`fileHints + gitDirtyFiles + commitFiles` 去重后的兼容聚合字段，最多 60 个。
- `commits`：`git log` 中 session start 到 `ended_at + 12h` 的最多 20 个 commits；如果没有 ended_at，则使用 `started_at + 13h`。
- `committedAfterSession`：commit 列表非空。
- `dirtyAfterSession`：扫描时 repo dirty。
- `absorbed`：自动判断为 `committedAfterSession && file_overlap && !git.dirty`；用户手动 absorbed 标记可覆盖自动判断。
- `diffSummary`：dirty files、shortstat、commit 数的短摘要。
- `testCommands`：parser 从日志文本识别出的测试命令。
- `confidence`：按 commit/file overlap/dirty/changed files 估算。
- `integration`：PR、issue、CI、review comment 等交付集成信号。

需要注意：自动 absorbed 已要求 commit 文件与 session file hints 重叠，因此比早期口径更保守；但它仍然只是本地线索推断，不是精确代码归属证明。

### DeliveryReviewSummary

| 字段 | 当前口径 |
| --- | --- |
| `sessionsWithFileChanges` | `delivery.changedFiles` 或 `session.changedFiles` 非空 |
| `sessionsWithCommits` | `delivery.committedAfterSession` |
| `sessionsWithDirtyChanges` | `delivery.dirtyAfterSession || session.gitDirty` |
| `absorbedSessions` | `delivery.absorbed` |
| `sessionsWithTests` | `delivery.testCommands` 非空 |
| `sessionsWithPr` | `delivery.integration.pullRequest` 非空 |
| `sessionsWithCiSignal` | `delivery.integration.ci.status != not_recorded` |
| `sessionsWithIssues` | `delivery.integration.issues` 非空 |
| `mergedSessions` | PR merged 或任一 commit 已进入 default branch |
| `reviewCommentKnownSessions` | `reviewCommentCount` 非空 |

Insights：

- `unabsorbed_output`：有 changed files 或 commit，但未 absorbed。
- `dirty_after_session`：session 后仍有 dirty changes。
- `missing_tests`：有文件变化但没有记录到测试命令。
- `linked_delivery`：有 PR 或 issue 线索。

## Integration 口径

集成默认关闭。只有用户启用 provider 且 Keychain 中存在 token 时，`sync_integrations` 才会请求远程 API。

GitHub：

- repo 从 `project_path` 或 `cwd` 的 origin remote 解析。
- PR 优先按本地已有 PR number 查；否则按当前 branch 查。
- review comment count 读取 PR review comments。
- CI 读取首个匹配 commit hash 的 workflow run。
- issues 只确认本地已经推断出的 GitHub issue key。

Linear：

- 只确认本地已有的 Linear/Jira 风格 issue key。
- 成功后填充 url/title/state，并把 status 标为 confirmed。

远程同步不会上传 prompt、response 或源码正文，但会向 provider API 发送 repo、branch、PR/issue/commit hash 等必要元数据。

## Operating Review 口径

### 成功 session

当前成功定义：

```text
status in useful/repaired
OR value.category in high_value/mixed_value
```

由于 `unknown/needs_review` 的 value category 当前固定为 `unreviewed`，后半段主要服务于已标记 useful/repaired 后的 value 派生。

### Task Type

任务类型是启发式分类，优先级如下：

1. `repair`：status 为 needs_repair、repairSeconds > 0，或 summary/note/branch/test command 包含 repair/bug/fix/failed。
2. `tests`：文件或文本包含 test/spec/typecheck。
3. `docs`：文件为 `.md`、包含 docs/roadmap，或文本包含 docs/roadmap。
4. `ui_frontend`：文件为 `.tsx/.jsx/.css`、包含 `src/app` 或 `views/`，或文本包含 ui/frontend/layout。
5. `delivery`：文本包含 pr/ci/commit/release，或文件包含 `.github/`/workflow。
6. `backend`：文件为 `.rs/.sql`、包含 `src-tauri/parser/analytics/api`，或文本包含 backend/parser/analytics。
7. `unknown`。

同一个 session 只会进入第一个命中的 bucket。这个分类只能作为复盘提示，不应当用于绩效评价。

### OperatingReviewSummary

- `totalSessions`：session 数。
- `successfulSessions`：成功 session 数。
- `successRate`：成功数 / session 数。
- `crossToolSourceCount`：source 去重数量。
- `crossProjectCount`：project_path 去重数量。
- `taskTypes`：按 task type 统计 session 数、成功数、repair 数、平均 value score、推荐 source。
- `toolPerformance`：按 source 统计 session 数、成功数、平均 value score、top task type。
- `playbook`：基于可复用模式、review backlog、delivery absorption、parallel ratio、missing test loop 生成的建议。

## Report 口径

Daily Report 使用 `build_day_ledger(date)` 的结果生成 Markdown。

Weekly Report 使用 `week_range(date)` 取周一到周日窗口，直接查询该周 sessions 并复用 parallel、delivery、operating 算法。周报中的：

- Most Valuable Sessions：value category 为 high/mixed，按 score 和 tool count 排序。
- Most Wasteful Sessions：low/needs_human_repair/discarded，或 review+repair 大于 waiting 的 sessions。
- Workflow note：比较 review+repair 与 waiting，给出瓶颈提示。

报告输出是可编辑 Markdown，导出到本地 app data exports 目录。

## 非 session ledger 数据

- Backup：复制 SQLite 到 app data backups；Keychain token 不包含在 SQLite 备份中。
- Restore：先跑 SQLite `PRAGMA integrity_check`，恢复前创建 safety backup。
- Integration diagnostics：检查 token 是否存在、API 是否可达、repo/issue 能否解析；这是操作诊断，不属于 DayMetrics。

## 剩余限制或容易误读的地方

| 优先级 | 问题 | 影响 | 建议 |
| --- | --- | --- | --- |
| P2 | token/cost/tool call 跨天分摊按 active overlap ratio 估算 | 如果真实 token 消耗集中在某一半 session，按比例分摊会有误差 | 等 parser 有事件级 usage 时改用事件级 attribution |
| P2 | 直接手动编辑 review/repair 累计秒数时没有真实 interval | waiting/human overlap 仍会回退启发式模拟 | 如需精确 overlap，应鼓励使用 Start/Done timer，或在手动编辑时支持 interval 输入 |
| P3 | fallback metrics 有硬编码样例 | 浏览器预览与真实后端可能表现不同 | 在 fallback 文件或文档中继续标注 demo-only |

## 后续修正建议

1. 后续优先把 token/cost/tool call 的比例分摊升级为事件级 attribution。
2. 为手动时间编辑增加 interval 输入或时间段选择，减少 overlap fallback。

只要这些边界被明确，当前数据模型作为 MVP 复盘工具是成立的；它应该被理解为个人 AI coding workflow 复盘系统，而不是精确工时或代码所有权系统。
