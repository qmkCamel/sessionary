# Design: 发布打包检查

## 后端

- 新增 `release` 模块。
- 新增 `get_release_readiness` Tauri command。
- 检查项：
  - package version 与 Tauri version 是否一致。
  - bundle 是否 active。
  - bundle targets 是否配置。
  - icon 是否配置。
  - beforeBuildCommand / frontendDist 是否配置。
  - Apple signing identity 环境变量是否存在。
- 返回 `ReleaseReadinessResult`。

## 前端

- Settings 新增 Release Readiness 区域。
- 显示 pass/warning/fail checklist。
- 显示推荐命令 `npm run tauri:build`。

## 文档

- 新增 `docs/release-readiness.md`。
- README 链接该文档，并更新状态说明。

## 验证

- Rust 单元测试覆盖 checker。
- 前端 fallback 显示 checklist。
