## ADDED Requirements

### Requirement: 产品不得提供项目专用发布打包检查

Sessionary 不得（MUST NOT）在产品界面、前端 API 或 Tauri command 中提供只服务当前仓库维护者的 release readiness / 本地打包检查能力。Tauri 打包配置、版本一致性、bundle target、icon 和签名环境检查属于维护者流程，而不是普通用户能力。

#### Scenario: 用户打开 Settings

- **WHEN** 用户打开 Settings
- **THEN** 页面不得展示 release readiness、本地打包检查或等价的项目专用打包检查区域
- **AND** 页面不得显示 `npm run tauri:build`、Apple signing identity 或 Tauri bundle 检查结果

#### Scenario: 前端调用产品 API

- **WHEN** 前端加载产品 API wrapper
- **THEN** 不得暴露 `getReleaseReadiness` 或等价方法
- **AND** fallback 数据不得包含 release readiness checklist

### Requirement: 发布流程必须文档化

Sessionary 仓库必须（MUST）记录维护者发布前验证命令、打包命令和当前限制。该文档必须（MUST）作为仓库维护流程存在，而不得（MUST NOT）暗示产品内存在通用发布检查能力。

#### Scenario: 维护者查看项目文档

- **WHEN** 维护者打开 README
- **THEN** 必须能找到 release readiness 文档链接
- **AND** 链接不得被列为 Sessionary 的用户产品能力
