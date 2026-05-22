# Design: GitHub / Linear 集成诊断

## 后端

- 新增 `diagnose_integrations` Tauri command。
- 返回 `IntegrationDiagnosticsResult`，包含 provider 级 `ok`、`message` 和 detail rows。
- GitHub：
  - 检查 provider enabled。
  - 检查 Keychain token 是否存在。
  - 请求 `/rate_limit` 获取连通性和 rate limit。
  - 从本地 sessions 解析 GitHub repo，统计成功/失败。
- Linear：
  - 检查 provider enabled。
  - 检查 Keychain token 是否存在。
  - 用 GraphQL `viewer` 检查 API 连通性。
  - 从本地 issue key 中抽样查询 issue。

## 前端

- Settings 新增 Run diagnostics 按钮。
- 展示 provider message 和 detail rows。
- 诊断只在用户点击时运行。

## 失败行为

- HTTP / GraphQL error 转成可读 message。
- 诊断不修改 delivery attribution。
- 没有本地 session 时给出 empty 状态。

## 验证

- fallback 支持诊断结果。
- Rust 单元测试覆盖 detail result 构造和 issue key 抽样逻辑。
