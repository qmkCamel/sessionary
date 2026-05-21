# Change: 完成 V0.5 PR / CI / Issue 轻量归因

## 背景

V0.4 将 session 与本地代码结果关联起来。V0.5 需要继续向交付链路靠近：让用户看到 session 与 PR、CI、Issue 的关系。但项目仍处于 local-first 产品阶段，不应引入远程账号授权或 API 依赖。

## 目标

- 基于本地 git remote、branch、commit message、session summary 和测试命令，生成 PR / CI / Issue 的轻量归因。
- 支持 GitHub PR candidate、commit -> PR -> merge 本地状态、CI/local test 信号、review comment count 的未知态、Linear/Jira/GitHub issue key 线索。
- 在 UI 和 Report 中展示归因置信度，避免把推断当成权威远程事实。

## 不做

- 不调用 GitHub / Linear / Jira / CI 远程 API。
- 不自动创建、修改或关闭 PR / issue。
- 不把未知远程状态伪装成已确认状态。

## 成功标准

- 用户能看到一个 session 是否能归因到 GitHub PR candidate 或本地 merged commit。
- 用户能看到 CI/local test 信号是否存在。
- 用户能看到 Linear/Jira/GitHub issue key 线索和归因置信度。
