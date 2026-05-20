# Design: 多语言 UI 支持

## 范围

本轮建立前端 i18n 基础能力，并把 Sessionary 当前主界面静态文案接入翻译表。语言偏好作为 settings 的一部分本地持久化。

## 语言模型

新增语言设置：

- `system`：默认值，跟随 `navigator.language`。中文系统使用 `zh-CN`，其他语言使用 `en`。
- `en`：强制英文。
- `zh-CN`：强制简体中文。

前端 TypeScript 与 Rust `AppSettings` 都增加 `language` 字段。Rust 读取旧 settings 时，如果没有该字段，返回 `system`。

## 前端结构

新增 `src/i18n.ts`：

- 定义 `LanguageSetting`、`Locale`。
- 提供 `resolveLocale(language, systemLanguage)`。
- 提供 `createTranslator(locale)`。
- 集中维护英文和简体中文翻译表。

`App.tsx` 不引入第三方 i18n 依赖，使用当前 settings 派生 `locale` 和 `t`。这样 bundle 小，且适合当前单页桌面应用。

## UI 行为

Settings 和 onboarding 中都显示语言选择器。用户切换时：

1. 更新 React state。
2. 如果用户点击 Save 或 Save and Scan，则写入后端 settings。
3. 文案根据当前 state 立即切换。

报告编辑器中的用户可编辑内容不自动重写，避免覆盖用户手动编辑。用户点击 Generate report 后，前端 fallback 报告会按当前语言生成。

## 兜底行为

- settings 中缺少 `language` 时按 `system` 处理。
- `navigator.language` 不可用时按英文处理。
- 未翻译 key 在开发期由测试覆盖；运行时翻译表使用显式 key，避免动态拼接。

## 验证

- `resolveLocale` 与 translator 的单元测试覆盖系统语言、强制语言和关键文案。
- fallback settings/report 测试覆盖 `language` 往返和中文报告。
- Rust settings 测试覆盖默认 language 与保存读取。
- 浏览器/本地渲染验证覆盖页面加载、Settings 语言切换和无 console error。

