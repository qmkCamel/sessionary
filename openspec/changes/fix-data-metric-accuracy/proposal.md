# Change: 修复数据口径准确性问题

## 背景

数据口径梳理发现当前实现中有几类指标容易重复、误读或过度自信：跨天 session 未切片、manual 时间仍被汇总到 estimated 字段、项目并行列使用 active duration、delivery absorbed 归因偏乐观、文件线索来源未拆分、Codex 消息计数可能重复，以及 review / repair 只保存累计秒数导致 overlap 只能启发式估算。

## 目标

- 让日级时间、token、cost、tool call 聚合按日期窗口切片，避免跨天重复计入整条 session。
- 将 estimated 与 manual 时间分开汇总，同时保持 UI 展示总人工时间。
- 为项目汇总提供真正的 project parallel seconds，并用 session ids 判断项目是否并行。
- 保守化 delivery absorbed 自动判断，并拆分文件线索来源。
- 避免 Codex 同一消息在不同日志事件形态中重复计数。
- 为 review / repair flow 保存实际 interval，并在 parallel overlap 中优先使用 interval。

## 不做

- 不改变 local-first 隐私边界。
- 不引入云端数据处理或远程遥测。
- 不重做完整数据仓库或历史 migration 框架。
- 不把 delivery linkage 升级成精确代码归因系统。

## 成功标准

- 新增测试覆盖跨天切片、manual/estimated 拆分、项目并行秒数、delivery absorbed 保守判断、Codex 消息去重和 review interval overlap。
- Rust / TypeScript 共享类型同步。
- Today 项目表展示真正的 project parallel seconds。
- OpenSpec、typecheck、build 和测试通过。
