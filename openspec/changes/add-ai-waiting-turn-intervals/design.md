# Design: AI 等待事件级 turn 区间

## 数据模型

新增通用 interval 记录：

```text
AiWaitingIntervalRecord {
  user_sent_at: String,
  ai_finished_at: String,
  seconds: i64,
  source: AiWaitingIntervalSource
}
```

`source` 取值：

- `event`：未来若日志存在明确 turn completion 事件时使用。
- `inferred`：从用户消息之后、下一条用户消息之前的最后一个 assistant/tool/token 事件推断。
- `estimated`：保留给回退数据，不由 parser 直接生成。

当前实现先使用 `inferred`。如果无法构造任何 interval，不写 interval，analytics 继续使用旧的 modeled waiting interval。

## Parser 规则

Parser 先把相关事件规范成：

```text
NormalizedAiEvent { at, kind }
```

`kind` 只需要：

- `user`
- `ai`

Codex:

- `event_msg.payload.type = user_message` 或 `response_item.message role=user` 记为 user。
- `event_msg.payload.type = agent_message/token_count`、`response_item.message role=assistant`、`response_item.function_call/function_call_output` 记为 ai。

Claude:

- role / event name 为 user 记为 user。
- role / event name 为 assistant、tool_use、tool_result 或含 tool 语义的事件记为 ai。

构造方式：

1. 按时间排序。
2. 遇到 user event 时开始新 turn。
3. turn 中记录用户事件之后的最后一个 ai event。
4. 下一条 user event 到来时，若上一 turn 有 ai event，则输出 `user_sent_at -> last_ai_event`。
5. 文件结束时，对最后一个 turn 做同样输出。

同一 timestamp 的 user 与镜像 response user 需要去重，避免生成重复 turn。

## Analytics 规则

Day/window 贡献：

- 如果 session 有 `ai_waiting_intervals`，waiting 贡献使用 interval 与窗口的 overlap seconds。
- 如果没有 interval，保留旧逻辑：`started_at + prompting_seconds -> ended_at`。
- `aiWaitingSecondsEstimated` 当前继续承载 parser 推断或回退的等待时间；manual 字段仍只用于用户手动修正 waiting 的数据。

Parallel review：

- waiting intervals 优先使用 `ai_waiting_intervals`。
- 缺失时保留旧 modeled interval。

## 存储

SQLite `sessions` 增加：

- `ai_waiting_intervals_json TEXT NOT NULL DEFAULT '[]'`

重新扫描时该字段来自 parser，和 `prompting_seconds` / `waiting_seconds` 一样，只有用户手动 waiting 时才不覆盖 `waiting_seconds` 数值；interval 本身可随扫描刷新。

## 验证

- parser 测试：Codex 多轮日志生成两个 inferred waiting intervals。
- parser 测试：Claude 多轮日志生成两个 inferred waiting intervals。
- analytics 测试：日级 waiting 优先使用 AI waiting intervals，而不是 modeled waiting。
- analytics 测试：parallel review waiting/human overlap 优先使用 AI waiting intervals。
- 回归：缺失 intervals 时旧 fallback 仍可用。
