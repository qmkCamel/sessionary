## ADDED Requirements

### Requirement: 应用必须提供发布打包检查清单

Sessionary 必须（MUST）提供 release readiness checklist，覆盖 Tauri 打包配置、版本一致性、bundle target、icon 和签名环境。

#### Scenario: 配置可打包但缺少签名

- **WHEN** bundle active 且 build command 存在，但 Apple signing identity 未配置
- **THEN** checklist 必须显示 warning
- **AND** 不得把缺少签名当作本地打包失败

#### Scenario: 关键 Tauri 配置缺失

- **WHEN** bundle 未启用或 frontendDist 缺失
- **THEN** checklist 必须显示 fail
- **AND** UI 必须显示需要修复的检查项

### Requirement: 发布流程必须文档化

Sessionary 必须（MUST）记录发布前验证命令、打包命令和当前限制。

#### Scenario: 维护者查看项目文档

- **WHEN** 维护者打开 README
- **THEN** 必须能找到 release readiness 文档链接
