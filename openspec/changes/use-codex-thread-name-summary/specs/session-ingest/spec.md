## ADDED Requirements

### Requirement: Codex 收件箱摘要必须优先使用会话标题

Sessionary 必须（MUST）在解析 Codex session 时优先使用 Codex 本地 session index 中的会话标题作为 `summary`。该标题必须（MUST）按 `sourceSessionId` 与 index 中的 `id` 匹配，并在同一 id 有多条记录时使用 `updated_at` 最新的 `thread_name`。

#### Scenario: Codex index 存在 thread name

- **WHEN** Codex session 的 `sourceSessionId` 在 `~/.codex/session_index.jsonl` 中存在 `thread_name`
- **THEN** Sessionary 的 session `summary` 必须使用最新 `thread_name`
- **AND** 收件箱卡片与详情标题应显示该标题

#### Scenario: Codex 日志以环境上下文开头

- **WHEN** Codex session 没有可用 `thread_name`
- **AND** 前几条 user message 是 `<environment_context>`、AGENTS instructions 或项目规则上下文
- **THEN** 这些上下文消息不得作为 `summary`
- **AND** parser 应继续寻找后续真实用户任务消息作为摘要
