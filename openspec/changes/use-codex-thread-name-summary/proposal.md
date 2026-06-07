# Change: 使用 Codex 会话标题作为收件箱摘要

## 背景

Codex session JSONL 的第一条 user message 可能是 `<environment_context>`、AGENTS instructions 或项目规则，而不是用户真实任务。当前收件箱直接展示 parser 得到的 `summary`，导致标题出现环境上下文。

Codex 同时维护 `~/.codex/session_index.jsonl`，其中记录 `id` 与 `thread_name`。该标题更接近 Codex UI 中展示的会话任务名称。

## 目标

- Codex session 摘要优先使用 `session_index.jsonl` 中对应 id 的最新 `thread_name`。
- 当没有 thread name 时，摘要回退到第一条真实用户任务消息。
- 环境上下文、AGENTS instructions 等上下文消息不得作为收件箱标题。

## 不做

- 不为 Claude 额外引入外部索引。
- 不新增远程请求或 AI 二次总结。
- 不改变统计口径、时间计算或状态标注行为。

## 成功标准

- 重新扫描后，Codex 收件箱卡片优先显示“功能迭代”“生成产品图标和Logo”等 Codex thread name。
- 没有 thread name 的 Codex session 不再把 `<environment_context>` 作为摘要。
