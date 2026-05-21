# Change: 完成 V0.4 轻量交付关联

## 背景

V0.1 到 V0.3 已经把本地 session、价值判断和并行复盘串起来，但用户仍然难以回答一个更接近交付的问题：这个 session 是否真的进入代码结果，还是只留下了未吸收的工作痕迹。

Roadmap 中 V0.4 的目标是把 session 与真实代码变化挂钩，同时避免进入重集成。实现应继续 local-first，只使用本地 session 日志、本地 git 仓库和用户手动标记。

## 目标

- 为每个 session 提供 delivery linkage：diff 摘要、涉及文件、commit 线索、dirty 状态、absorbed 标记和本地测试命令记录。
- 在 Today / Inbox detail / Report 中展示交付吸收状态，让用户区分“有输出但没吸收”和“已进入可提交或已提交状态”。
- 支持用户手动标记 absorbed，且重新扫描不得覆盖该标记。

## 不做

- 不自动创建 commit、PR 或 issue。
- 不发起远程 GitHub API / CI API / Jira / Linear 请求。
- 不保存源码 diff 正文，只保存本地派生的摘要和文件名。

## 成功标准

- 用户能看到 session 后是否有 commit 或 dirty changes。
- 用户能看到 session 关联的文件、diff 摘要和测试命令。
- 用户能把 session 标记为 absorbed，并在后续扫描后保持该状态。
