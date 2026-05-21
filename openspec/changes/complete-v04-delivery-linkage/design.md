# Design: V0.4 轻量交付关联

## 数据来源

V0.4 只使用本地信息：

- parser 从 Codex / Claude Code JSONL 中提取文件线索和测试命令线索。
- `git status` / `git diff --shortstat` 提供当前 dirty changes 摘要。
- `git log` 在 session 时间窗之后寻找本地 commit 线索。
- 用户可手动标记 `absorbed`。

## 数据模型

每个 `SessionRecord` 新增 `delivery`：

- `diffSummary`：短文本摘要，描述 dirty 文件数、diff shortstat、是否有 commit。
- `changedFiles`：交付视角的文件列表，合并 parser hints、dirty files 和 commit files。
- `commits`：session 时间窗附近的本地 commit 线索。
- `committedAfterSession`：是否存在 session 后 commit。
- `dirtyAfterSession`：当前仓库是否仍有 dirty changes。
- `absorbed`：是否已吸收，支持用户手动标记。
- `testCommands`：从 session 日志提取到的本地测试命令。
- `confidence`：本地归因置信度。

SQLite 使用 `delivery_json` 保存结构化 delivery 元数据。扫描 upsert 时必须保留既有 `absorbed=true`。

## 归因规则

- 如果 commit 时间在 session start 到 session end 后 12 小时之间，视作候选 commit。
- 如果 commit files 与 session 文件线索相交，置信度提高。
- 如果存在 commit 且当前没有 dirty changes，可默认视作 absorbed。
- 如果用户手动标记 absorbed，该值优先于后续估算。

## UI

- Today 增加 delivery strip，显示 absorbed、committed、dirty、tests。
- Session detail 增加 Delivery section，展示 absorbed toggle、diff summary、commit、test commands。
- Report 增加 Delivery Review section。

## 风险

- 没有 session 前快照时，diff summary 是“当前本地状态”而非精确前后 diff。UI 和报告必须把它作为本地派生线索表达。
- commit 归因可能把同一时间窗内的人工 commit 计入 session，因此需要 confidence。
