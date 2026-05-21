# Design: V1.0 AI Dev Operating Review

## 汇总范围

Day ledger 提供当天 operating review。Weekly Report 使用同一算法覆盖周范围。

## 任务类型分类

V1.0 使用本地启发式分类：

- UI / frontend：前端文件、组件、样式或 UI 关键词。
- docs：Markdown、文档或 roadmap 关键词。
- tests：测试文件或测试命令。
- backend：Rust、SQL、API、parser、analytics。
- delivery：git、PR、CI、release、issue。
- repair：bug、fix、repair、failure 等关键词。
- unknown：无法判断。

分类只作为 review hint，不作为强事实。

## 成功率

成功 session 包含：

- value category 为 high / mixed。
- 或状态为 useful / repaired。
- 且不是 discarded / failed。

任务类型成功率按本地 session 标记和 value score 估算。

## Playbook

Playbook 由本地规则生成：

- 如果某工具在某任务类型上成功率高，建议继续复用。
- 如果 repair/review backlog 高，建议先收敛 review 队列。
- 如果 delivery dirty 多，建议在开新 agent 前吸收或提交。
- 如果并行收益明显，建议保留并行模式但限制短切换。

## UI

新增 Operating Review view：

- 关键 operating metrics。
- Tool x task type 表。
- Delivery chain 矩阵。
- Playbook 和 workflow reuse 建议。

## 风险

- 启发式分类会有误差，所以 UI 必须使用 review / recommendation 语气。
- V1.0 不应变成 manager dashboard，仍服务个人复盘。
