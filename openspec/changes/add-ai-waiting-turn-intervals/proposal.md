# Proposal: 增加 AI 等待事件级 turn 区间

## 背景

当前 `waiting_seconds` 默认来自 `duration_seconds - prompting_seconds`，只能表达 session active 期间的非指令窗口。这个口径无法区分用户发送指令后 AI 本轮响应/工具执行实际持续了多久，也会把 session 中的空档一并混入 AI 等待。

用户侧更需要的是“发送指令后等到 AI 本轮完成”的可感知等待时间。该时间可以优先从 Codex / Claude 日志事件时间戳推断；如果日志不足，再回退到原估算。

## 范围

- 新增 session 级 `aiWaitingIntervals`，记录每轮 `userSentAt -> aiFinishedAt` 的等待区间。
- Codex / Claude parser 从事件级时间戳推断 AI 等待 turn interval。
- DayMetrics 和 parallel review 优先使用 `aiWaitingIntervals` 计算 AI waiting；缺失时保留旧回退。
- 文档更新为“事件级统计优先，估算回退”。

暂不实现：

- 首响应延迟。
- AI 活跃区间。
- 模型服务端真实推理时间。
- 实时 tail 日志或 CLI wrapper。

## 影响

- UI 现有字段名可继续使用 `AI waiting`。
- 统计准确性提升，但需要通过来源字段明确 event / inferred / estimated。
- 旧数据和无法识别 turn 的日志继续可用。
