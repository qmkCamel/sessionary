## 1. OpenSpec

- [x] 1.1 创建 Sessionary OpenSpec 骨架。
- [x] 1.2 创建 `add-multilingual-ui` proposal、design、tasks 与 capability spec。
- [x] 1.3 运行 `openspec validate add-multilingual-ui --strict`。

## 2. i18n 基础能力

- [x] 2.1 新增 `src/i18n.ts`，提供语言类型、locale 解析和翻译表。
- [x] 2.2 新增 i18n 单元测试，覆盖系统语言和关键文案。
- [x] 2.3 前端 fallback settings/report 支持 language。

## 3. Settings 持久化

- [x] 3.1 TypeScript `AppSettings` 增加 `language`。
- [x] 3.2 Rust `AppSettings` 增加 `language`，旧本地 settings 默认 `system`。
- [x] 3.3 保存 settings 时持久化 language。
- [x] 3.4 增加 Rust settings 测试。

## 4. UI 接入

- [x] 4.1 App 主界面静态文案接入 translator。
- [x] 4.2 Settings/onboarding 增加语言选择器。
- [x] 4.3 状态标签、空状态、按钮 title、输入 placeholder 和详情面板文案支持英文/简中。

## 5. 验证

- [x] 5.1 `openspec validate add-multilingual-ui --strict` 通过。
- [x] 5.2 `npm run typecheck` 通过。
- [x] 5.3 `npm run build` 通过。
- [x] 5.4 `npm test` 通过。
- [x] 5.5 本地渲染验证：页面加载、Settings 语言切换、无明显运行时错误。
