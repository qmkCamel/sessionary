# Change: GitHub / Linear 集成诊断

## 背景

远端同步失败时，用户需要知道是 token 缺失、权限不足、rate limit、repo remote 解析失败，还是 Linear issue key 不存在。只有同步结果计数不足以支撑真实日用。

## 目标

- 新增显式诊断命令。
- Settings 展示 GitHub / Linear provider 级诊断。
- 诊断包含凭据状态、API 连通性、rate limit、repo 解析、issue key 检查。
- 诊断失败不得修改 session delivery attribution。

## 不做

- 不自动修复权限。
- 不创建远端对象。
- 不在页面渲染时自动联网。

## 用户价值

用户可以在同步前快速确认集成是否可用，并定位失败原因。

## 成功标准

- provider disabled / missing token / HTTP error / GraphQL error 都有明确消息。
- GitHub 诊断能显示 rate limit 和可解析 repo 数。
- Linear 诊断能显示 issue key 样本检查结果。
