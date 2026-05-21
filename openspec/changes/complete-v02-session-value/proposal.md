# Change: 完成 V0.2 人工时间与 Session 价值

## 背景

V0.1 已经把 Codex / Claude Code 本地 session 整理成每日账本，并提供状态标注、时间线、并行区间和日报。Roadmap 中 V0.2 的目标是从“记录发生了什么”升级为“判断值不值”：用户不只要知道今天跑了哪些 AI sessions，还要知道哪些 session 值得继续复用，哪些因为 review / repair / 成本过高拖慢了 workflow。

当前实现已经有 prompting / waiting / review / repair 的估算字段、review 计时入口、文件变化线索、token / cost / tool call 元数据和日报基础能力，但缺少统一的 session 价值分类、repair 半自动计时、成本/产出汇总的首屏呈现，以及周报中“最值 / 最浪费 sessions”的闭环。

## 目标

- 为每个 session 计算本地派生的 value category 和 value score，覆盖低成本高产出、高成本低产出、待人工修复、废弃、待确认等状态。
- 在 Today、Inbox、Detail 和 Report 中展示 session 价值、成本、token、tool call 与文件线索汇总。
- 保持所有 prompting / waiting / review / repair 时间默认明确标记为 estimated，用户编辑后标记为 manual。
- 增加 repair 的半自动开始 / 完成计时流，与现有 review 计时流保持一致。
- 生成周报，列出本周最有价值和最浪费的 sessions，并总结 review / repair 是否吞掉 AI workflow 收益。
- 保持 local-first：所有分类和报告都来自本地 SQLite 与扫描元数据，不新增网络请求。

## 非目标

- 不做 PR / CI / issue / Linear / Jira 集成。
- 不自动判断业务结果或代码质量。
- 不把 session value 作为团队绩效排名。
- 不追求秒级人工时间准确性；V0.2 仍然以估算、轻量修正和长期趋势为核心。
- 不引入云同步、账号、远程遥测或外部 API。

## 用户价值

用户每天清理 session 时能快速区分“值得复用的 AI 工作”和“需要人工补救或应丢弃的工作”。周报能帮助用户判断哪些任务类型适合继续交给 AI，以及自己的 review / repair 是否正在成为瓶颈。

## 成功标准

- OpenSpec 严格校验通过。
- 前端 typecheck、build、测试通过，Rust 测试通过。
- 每个 session 有可解释的 value category / score。
- 用户可以手动修正四类时间，并可以半自动记录 review 和 repair。
- Daily Report 和 Weekly Report 都能本地生成、编辑、复制和导出。
- UI 中所有估算时间都明确标记 estimated，手动修正后标记 manual。
- 渲染验证覆盖 Today、Inbox、Report 周报切换和 session detail 的价值/repair 控件。
