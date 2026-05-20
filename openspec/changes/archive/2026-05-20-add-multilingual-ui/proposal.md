# Change: 多语言 UI 支持

## 背景

Sessionary 当前主界面文案固定为英文。产品面向中英文混合使用的 AI 编程工作流，后续也会沉淀中英文 README 和产品文档，因此 UI 需要具备可扩展的多语言基础，而不是继续把英文硬编码散落在 React 组件中。

## 目标

- 支持英文和简体中文两套 UI 文案。
- 默认跟随系统语言；当系统语言不是中文时使用英文。
- Settings 中提供语言选择：System、English、简体中文。
- 用户语言偏好保存到本地 settings，并在重启后保持。
- 主界面静态文案、状态标签、按钮、空状态、设置页、onboarding 和前端 fallback 日报文案走统一翻译表。

## 非目标

- 不翻译用户自己的项目名、路径、笔记、session summary 或源日志内容。
- 不引入远程翻译服务。
- 不做运行时语言包下载。
- 不改变 Rust 生成的 Markdown 日报语言；本轮只覆盖前端 UI 与前端 fallback 报告。
- 不支持英文/简中之外的更多语言。

## 用户价值

中文用户可以直接用中文理解 Sessionary 的核心操作；英文用户保留现有体验。语言设置本地保存，不需要账号或云同步。

## 成功标准

- 首次打开应用时语言默认跟随系统。
- 用户可在 Settings 切换英文或简体中文，界面立即更新。
- 语言设置保存后再次读取仍保持。
- 所有主界面静态文案不再散落硬编码为单一英文。
- `openspec validate add-multilingual-ui --strict`、`npm run typecheck`、`npm run build`、`npm test` 通过。

