# app-localization Specification

## Purpose
TBD - created by archiving change add-multilingual-ui. Update Purpose after archive.
## Requirements
### Requirement: 应用必须支持本地 UI 语言偏好

Sessionary 必须（MUST）支持 `system`、`en`、`zh-CN` 三种语言设置。默认设置必须（MUST）为 `system`。当设置为 `system` 时，系统语言以 `zh` 开头必须（MUST）解析为 `zh-CN`，其他系统语言必须（MUST）解析为 `en`。

#### Scenario: 首次加载默认语言

- **WHEN** 用户没有保存过语言偏好
- **THEN** 应用 settings 返回 `language = "system"`
- **AND** 前端根据系统语言解析实际 locale

#### Scenario: 用户选择固定语言

- **WHEN** 用户在 Settings 选择 English 或 简体中文并保存
- **THEN** 应用必须保存该语言偏好
- **AND** 下次读取 settings 时必须返回同一语言偏好

### Requirement: 主界面静态文案必须可切换语言

Sessionary 必须（MUST）将主界面静态 UI 文案通过统一翻译表渲染。翻译范围必须（MUST）覆盖导航、Today、Session Inbox、Project Timeline、Daily Report、Settings、onboarding、详情面板、状态标签、按钮 title、输入 placeholder、空状态和前端 fallback 报告。

#### Scenario: 用户切换为简体中文

- **WHEN** 用户在 Settings 将语言切换为 `zh-CN`
- **THEN** 导航、页面标题、按钮、状态标签和设置项必须显示为简体中文
- **AND** 项目名、路径、session summary、用户笔记和源日志内容不得被机器翻译或改写

#### Scenario: 用户切换为英文

- **WHEN** 用户在 Settings 将语言切换为 `en`
- **THEN** 导航、页面标题、按钮、状态标签和设置项必须显示为英文

### Requirement: 多语言不得破坏 local-first 数据边界

语言偏好必须（MUST）作为本地 settings 保存，不得（MUST NOT）引入远程翻译、账户系统、云同步或运行时语言包下载。

#### Scenario: 保存语言偏好

- **WHEN** 用户保存语言偏好
- **THEN** 应用只写入本地 settings 存储
- **AND** 不发起任何新的网络请求
