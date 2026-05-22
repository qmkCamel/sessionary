# Change: 发布打包检查

## 背景

Sessionary 已具备主要产品能力，但 README 仍标记 packaged releases 未 ready。release-readiness 阶段需要让开发者可以在应用和文档中看到发布前检查项。

## 目标

- 应用内提供 Release Readiness checklist。
- 文档记录打包命令、签名限制和发布前验证。
- 检查 Tauri 配置、版本、bundle target、icon、签名环境等关键项。

## 不做

- 不自动签名或公证。
- 不实现 auto-update。
- 不发布 GitHub Release。

## 用户价值

维护者可以明确知道离可分发版本还差什么，不再依赖口头 checklist。

## 成功标准

- Settings 能展示 release checklist。
- README 链接 release readiness 文档。
- 未配置签名证书时显示 warning 而不是失败。
