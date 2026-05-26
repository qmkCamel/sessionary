## 1. OpenSpec

- [x] 1.1 创建 `add-report-markdown-localization` proposal、design、tasks 和 spec delta。
- [x] 1.2 运行 `npm run openspec:validate`。

## 2. 前端 API

- [x] 2.1 将 `locale` 传入 `generate_report` 和 `generate_weekly_report` Tauri commands。
- [x] 2.2 保持 export commands 只写当前 Markdown，不重新生成报告。

## 3. Rust 报告生成

- [x] 3.1 增加 report locale 解析。
- [x] 3.2 将日报模板文案接入 report locale。
- [x] 3.3 将周报模板文案接入 report locale。
- [x] 3.4 保持用户数据和本地事实字段原文输出。

## 4. 测试与验证

- [x] 4.1 增加 Rust 测试覆盖中文日报。
- [x] 4.2 增加 Rust 测试覆盖中文周报。
- [x] 4.3 `npm run typecheck` 通过。
- [x] 4.4 `npm run build` 通过。
- [x] 4.5 `npm test` 通过。
