# Design: 发布打包流程文档化

## 产品边界

- 发布打包检查只服务维护者，不属于 Sessionary 用户的通用产品能力。
- Settings 只保留用户日常需要的语言、数据来源、项目根目录、集成、备份/恢复等能力。
- 任何 `package.json`、`tauri.conf.json`、签名环境变量检查都不在产品 UI 中展示。

## 前端

- 移除 Settings 中的 release readiness / 本地打包检查区域。
- 移除 `releaseChecking`、`releaseReadiness`、`runReleaseCheck` 等 UI 状态和事件链路。
- 移除前端 `getReleaseReadiness` API wrapper、fallback 数据和 release readiness 类型。

## 后端

- 移除 `release` 模块。
- 移除 `get_release_readiness` Tauri command 注册。
- 移除 `ReleaseReadinessResult` / `ReleaseCheck` 等仅服务该产品入口的模型。

## 文档

- 保留 `docs/release-readiness.md` 作为维护者发布流程文档。
- README 链接该文档，但不把它列为产品能力。

## 验证

- OpenSpec 严格校验通过。
- TypeScript typecheck、前端 build、测试通过。
- 本地渲染 Settings，确认不再出现 release readiness / 本地打包检查区域。
