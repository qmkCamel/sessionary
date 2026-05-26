## ADDED Requirements

### Requirement: 日报 Markdown 必须支持当前应用语言

Sessionary 必须（MUST）根据前端传入的 resolved locale 生成日报 Markdown。支持的 locale 必须（MUST）至少包含 `en` 和 `zh-CN`。报告中的标题、小节、指标标签、空状态和系统生成 insight 文案必须（MUST）使用对应语言。

#### Scenario: 用户用中文生成日报

- **WHEN** 当前应用 locale 为 `zh-CN`
- **AND** 用户点击 Daily Report 的生成按钮
- **THEN** 生成的日报 Markdown 必须包含中文标题、小节和指标标签
- **AND** project name、session summary、用户 note、PR URL、issue key 和 file path 必须保持原文

#### Scenario: 用户用英文生成日报

- **WHEN** 当前应用 locale 为 `en`
- **AND** 用户点击 Daily Report 的生成按钮
- **THEN** 生成的日报 Markdown 必须保持英文标题、小节和指标标签

### Requirement: 周报 Markdown 必须支持当前应用语言

Sessionary 必须（MUST）根据前端传入的 resolved locale 生成周报 Markdown。周报的标题、小节、指标标签、空状态和系统生成 workflow notes 必须（MUST）使用对应语言。

#### Scenario: 用户用中文生成周报

- **WHEN** 当前应用 locale 为 `zh-CN`
- **AND** 用户切换到 Weekly 并生成报告
- **THEN** 生成的周报 Markdown 必须包含中文标题、小节和指标标签
- **AND** 本地数据字段必须保持原文

### Requirement: 报告本地化不得改变 local-first 边界

报告多语言必须（MUST）只使用本地静态文案，不得（MUST NOT）调用远程翻译、LLM、账户系统、云同步或运行时语言包下载。

#### Scenario: 用户生成中文报告

- **WHEN** 用户生成或导出中文日报/周报
- **THEN** 应用不得因为报告本地化发起任何新的网络请求
- **AND** 导出命令必须只写入用户当前编辑的 Markdown
