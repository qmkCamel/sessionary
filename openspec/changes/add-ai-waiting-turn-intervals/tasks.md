## 1. OpenSpec

- [x] 1.1 创建 `add-ai-waiting-turn-intervals` change。
- [x] 1.2 定义事件级 AI waiting turn interval 范围，不包含首响应延迟和 AI 活跃区间。

## 2. 测试先行

- [x] 2.1 为 Codex 多轮 turn waiting interval 新增 parser fixture / Rust 测试。
- [x] 2.2 为 Claude 多轮 turn waiting interval 新增 parser fixture / Rust 测试。
- [x] 2.3 为 DayMetrics 优先使用 `ai_waiting_intervals` 新增 Rust 测试。
- [x] 2.4 为 parallel review waiting/human overlap 优先使用 `ai_waiting_intervals` 新增 Rust 测试。
- [x] 2.5 为缺失 intervals 的 fallback 继续可用新增或确认回归测试。

## 3. 实现

- [x] 3.1 新增 Rust / TypeScript AI waiting interval 类型。
- [x] 3.2 新增 SQLite `ai_waiting_intervals_json` 字段与读取/写入。
- [x] 3.3 Codex parser 生成 inferred AI waiting intervals。
- [x] 3.4 Claude parser 生成 inferred AI waiting intervals。
- [x] 3.5 Analytics 和 parallel review 优先使用 AI waiting intervals。
- [x] 3.6 同步 fallback、文档和用户侧说明。

## 4. 验证

- [x] 4.1 运行 `npm run openspec:validate`。
- [x] 4.2 运行 `cd src-tauri && cargo test`。
- [x] 4.3 运行 `npm run typecheck`。
- [x] 4.4 运行 `npm run build`。
- [x] 4.5 运行 `npm test`。
