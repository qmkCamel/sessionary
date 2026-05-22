# Sessionary Release Readiness

日期：2026-05-22

本阶段把 Sessionary 的日用与发布风险收敛到四个方面：凭据安全、集成可诊断、数据可恢复、发布流程可复现。

## 发布前检查

- 运行 `npm run openspec:validate`
- 运行 `npm run typecheck`
- 运行 `npm run build`
- 运行 `npm test`
- 运行 `npm run tauri:build`
- 确认 GitHub / Linear token 已存入 macOS Keychain，而不是 SQLite。
- 确认 Settings 的集成诊断能解释 token 缺失、权限失败、repo 解析失败和 issue key 未命中。
- 创建一次本地备份，并验证备份文件可通过 SQLite integrity check。

## 打包命令

```bash
npm ci
npm run openspec:validate
npm run typecheck
npm run build
npm test
npm run tauri:build
```

## 当前限制

- 未配置 Apple Developer ID signing identity 时，产物只能作为本地未签名 app 使用。
- 当前备份只包含 SQLite 数据库，不包含 Keychain token。
- GitHub / Linear 同步仍是用户显式触发，不做后台自动联网。
- auto-update 不在本阶段范围内。

## 用户数据位置

- SQLite：`~/Library/Application Support/Sessionary/sessionary.sqlite`
- 备份：`~/Library/Application Support/Sessionary/backups/`
- 导出报告：`~/Library/Application Support/Sessionary/exports/`
- 凭据：macOS Keychain generic password，service 为 `Sessionary`
