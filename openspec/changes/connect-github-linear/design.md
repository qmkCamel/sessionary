# Design: GitHub / Linear 远端交付同步

## 数据模型影响

- `AppSettings` 新增 `integration_settings`，包含 `github.enabled/token` 与 `linear.enabled/token`。
- `IssueLink` 新增可选 `title`、`state` 字段，用于保存 Linear / GitHub issue 的远端摘要。
- 新增 `IntegrationSyncResult` 与 provider-level summary，供 UI 显示同步时间、更新数量、错误数量和提示。
- session 的 `delivery_json` 仍是归因事实的本地存储位置；远端同步只更新 delivery attribution，不重写 session 原文。

## 后端行为

- 新增 `sync_integrations` Tauri command。
- GitHub:
  - 从 session `project_path` 的 origin remote 解析 `owner/repo`。
  - 优先使用已有 PR number；没有 number 时用 branch 作为 head filter 查询 PR。
  - 通过 GitHub REST API 确认 PR URL、state、merge 状态。
  - 通过 workflow runs API 按 commit SHA 查询 GitHub Actions 状态。
  - 通过 pull request review comments API 读取 review comment count。
- Linear:
  - 从已有 issue key 中筛选 `ABC-123` 形式的 identifier。
  - 通过 Linear GraphQL `issue(id:)` 查询 issue title、url、state。
  - 命中后把 provider 标记为 `linear`，status 标记为 `confirmed`。

## UI 行为

- Settings 中新增 GitHub / Linear 集成区域，使用本地 password input 保存 token。
- 用户点击同步按钮后，UI 显示同步中、完成时间、provider 更新数量和错误数量。
- Detail / Operating Review 复用现有 delivery attribution 展示，并展示 issue title / state。

## Fallback 行为

- 非 Tauri / 测试环境中，fallback settings 包含 disabled integration settings。
- fallback sync 不发起网络请求，但会返回模拟同步结果并更新 demo session 的 confirmed 标记，便于浏览器 QA。

## Local-first 与隐私边界

- 默认状态不联网；只有用户开启 provider 且点击同步按钮时才请求 GitHub / Linear。
- 请求只包含 repo owner/name、PR number、branch、commit SHA 或 issue key，不发送 prompt、response 或 source code。
- token 存储在本机 SQLite settings 中；UI 必须明确提示这是本地保存的访问凭据。

## 验证

- `npm run openspec:validate`
- `npm run typecheck`
- `npm run build`
- `npm test`
- Rust 单元测试覆盖 remote URL 解析、issue key 识别和 disabled sync。
- 本地预览渲染 Settings 集成区域并检查桌面 / 窄屏布局。
