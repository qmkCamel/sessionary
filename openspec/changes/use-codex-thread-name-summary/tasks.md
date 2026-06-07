## 1. OpenSpec

- [x] 1.1 创建 Codex thread name 摘要 change。
- [x] 1.2 定义收件箱标题应使用真实会话标题的需求。
- [x] 1.3 运行 OpenSpec 严格校验。

## 2. 实现

- [x] 2.1 读取 `~/.codex/session_index.jsonl` 中的最新 `thread_name`。
- [x] 2.2 Codex parser 优先用 thread name 生成 `summary`。
- [x] 2.3 无 thread name 时跳过环境上下文和 AGENTS instructions，回退到真实用户消息或 session id。

## 3. 验证

- [x] 3.1 增加 Rust parser 单元测试。
- [x] 3.2 运行 `npm run openspec:validate`。
- [x] 3.3 运行相关测试。
