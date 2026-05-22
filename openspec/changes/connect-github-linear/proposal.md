# Change: 接入 GitHub / Linear 远端交付同步

## 背景

V0.5 已经能基于本地 git、branch、commit、session 文本推断 PR / CI / Issue 线索，但这些仍是 candidate 或 unknown。用户现在需要在保留 local-first 默认边界的前提下，主动连接 GitHub 和 Linear，把本地线索补全为可验证的远端事实。

## 目标

- 在 Settings 中提供 GitHub token 与 Linear API key 的本地配置入口。
- 新增显式触发的 GitHub / Linear 同步命令，默认不自动联网。
- GitHub 同步必须能确认 PR、merge 状态、GitHub Actions CI 状态和 PR review comment count。
- Linear 同步必须能用 issue key（如 `ABC-123`）确认 issue、标题、状态和 URL。
- 同步结果必须回写本地 session delivery attribution，并在 UI 中展示 confirmed / failed / unknown 等状态。

## 不做

- 不实现 OAuth browser flow。
- 不自动创建、修改、关闭 PR 或 Linear issue。
- 不上传 prompt、response、source code 或未必要的 session 内容。
- 不把远端 token 同步到云端或写入报告正文。

## 用户价值

用户可以从本地 session ledger 直接看到某次 AI coding session 交付到哪个 PR、是否合并、CI 是否通过、关联 Linear issue 当前处于什么状态，从而把 inbox / review 从“推断记录”推进到“可验证的交付账本”。

## 成功标准

- 用户保存 GitHub / Linear 凭据后，可以手动触发一次同步。
- 对可解析的 GitHub remote / PR / branch / commit，应用能更新 PR、CI 和 review comment count。
- 对可解析的 Linear issue key，应用能更新 issue URL、标题和状态。
- 凭据缺失、权限不足、网络失败或远端对象不存在时，应用给出同步结果，不破坏已有本地归因。
