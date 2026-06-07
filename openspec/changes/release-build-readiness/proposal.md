# Change: 发布打包流程文档化

## 背景

Sessionary 已具备主要产品能力，但 Tauri 打包配置检查属于维护者发布操作，不是用户通用能力。将这类项目专用检查放进 Settings 会让产品边界变得混乱，也会把当前仓库的发布前置条件误呈现为普通用户可用功能。

release-readiness 阶段应保留可复现的维护者文档，同时从产品界面和可调用命令中移除项目专用打包检查。

## 目标

- 文档记录打包命令、签名限制和发布前验证。
- README 保留维护者可找到的 release readiness 文档入口。
- Settings 不展示 release readiness、本地打包检查或等价的项目专用检查。
- 前端和 Tauri command 不暴露项目专用打包检查 API。

## 不做

- 不自动签名或公证。
- 不实现 auto-update。
- 不发布 GitHub Release。
- 不把当前 Tauri 项目的打包配置检查包装成通用产品发布流程能力。

## 用户价值

用户只看到与 Sessionary 日常使用相关的能力；维护者仍可通过仓库文档复现发布前验证流程。

## 成功标准

- README 链接 release readiness 文档。
- Settings 不展示 release readiness、本地打包检查或 `npm run tauri:build` 检查结果。
- 应用不注册 `get_release_readiness` Tauri command，前端不保留对应 API wrapper 或 fallback。
