# Release Readiness 计划归档

日期：2026-05-22

## 目标

把 Sessionary 从“功能完整的本地产品”推进到“可以交给真实用户每天使用的可发布版本”。

## 范围

本阶段包含四个独立能力：

1. 安全凭据：GitHub / Linear token 不再明文保存在 SQLite，改为 macOS Keychain。
2. 集成诊断：Settings 提供 GitHub / Linear 连接诊断，能解释凭据、权限、rate limit、repo 和 issue key 问题。
3. 备份恢复：用户可以创建本地 SQLite 备份，并从备份恢复数据。
4. 发布检查：应用内展示 release checklist，README 记录打包发布流程和限制。

## 非目标

- 不实现 auto-update。
- 不实现 OAuth。
- 不实现云同步或远端备份。
- 不把 Keychain 凭据包含进备份文件。
- 不承诺完成 Apple Developer ID 签名和公证，因为这需要真实证书。

## 验收

- OpenSpec 对四个能力分别建模并通过严格校验。
- Settings 中能完成 token 保存、诊断、备份/恢复、发布检查。
- 自动化验证通过：OpenSpec、TS typecheck、构建、Web/Rust 测试。
- UI 经本地渲染检查，不出现明显重叠或不可用控件。
