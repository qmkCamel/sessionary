# Sessionary 后续规划

日期：2026-05-19

## 路线原则

Sessionary 的路线应该从轻到重，先把 session 层做准，再逐步接近交付链路。

不要第一天就做完整的 session -> PR -> CI -> review -> merge -> Jira/Linear 链路。这个链路价值很高，但跨平台集成多、兼容成本高、反馈周期长，容易在早期拖慢产品验证。

推荐路线：

1. 先做本地 session 账本。
2. 再做 session 价值判断。
3. 再做并行开发复盘。
4. 最后再扩展到 PR/CI/issue 等交付链路。

## V0.1 本地 Session Ledger

目标：把散落在 Codex / Claude Code 日志里的 sessions 整理成每日账本。

能力：

- 读取 Codex 本地 session 日志。
- 读取 Claude Code 本地 session 日志或 OpenTelemetry 数据。
- 自动识别项目路径。
- 展示每天项目列表。
- 展示每天 session 列表。
- 统计每个 session 的起止时间、持续时间、对话轮数。
- 识别 session 时间段重叠。
- 标出哪些项目并行开发。
- 提供 session 状态标注：有用、待 review、需要 repair、失败、废弃。
- 生成简单日报。

不做：

- PR/CI 集成
- 团队功能
- 云同步
- 精确人工时间统计

成功标准：

- 用户每天能打开 Sessionary 清理自己的 AI sessions。
- 用户能明显感知“今天 AI 并行开发到底发生了什么”。

## V0.2 人工时间与 Session 价值

目标：从“记录发生了什么”升级为“判断值不值”。

能力：

- Prompting time 估算。
- Waiting time 估算。
- Review time 手动/半自动记录。
- Repair time 手动/半自动记录。
- session 后相关文件变化线索。
- session 成本、token、tool call 汇总。
- 简单 session 评分：低成本高产出、高成本低产出、待人工修复、废弃。
- 周报：哪些 sessions 最值，哪些浪费最多。

关键设计：

- 所有估算指标明确标记 estimated。
- 用户可以修正时间归属。
- 不追求秒级准确，优先长期趋势。

成功标准：

- 用户能看出哪类任务适合继续交给 AI。
- 用户能看出自己的 AI workflow 是否因为 review/repair 变慢。

## V0.3 并行开发复盘

目标：让“并行开发”成为产品的核心差异点。

能力：

- 多项目并行时间线。
- 多 session 并行区间高亮。
- AI waiting 与 human review 的交叠分析。
- 并行度指标：同时运行 session 数、并行项目数、并行时长占比。
- Review bottleneck 提示：AI session 完成后堆积未处理。
- Context switching 提示：短时间内频繁切换项目/session。

成功标准：

- 用户能判断“开更多 agent 是否真的提高吞吐”。
- 用户能发现“review 队列过长”或“项目切换过碎”的问题。

## V0.4 轻量交付关联

目标：开始把 session 与真实代码结果挂钩，但仍避免重集成。

能力：

- session 前后 git diff 摘要。
- session 涉及文件列表。
- session 后是否产生 commit。
- session 后是否仍有 dirty changes。
- session 是否被标记为 absorbed。
- 本地测试命令记录，如果 session 日志中可得。

不做：

- 自动创建 PR
- 远程 GitHub API 深度集成
- CI 失败归因
- Jira/Linear 同步

成功标准：

- 用户能知道一个 session 是否至少进入了本地代码变化。
- 用户能区分“有输出但没吸收”和“已进入可提交状态”。

## V0.5 PR / CI / Issue 集成

目标：在 session 层验证成立后，再向完整交付链路扩展。

能力：

- GitHub PR 关联。
- commit -> PR -> merge 状态。
- CI 结果。
- review comment 数。
- Linear/Jira issue 关联。
- session 到 PR 的归因。

适合进入这一阶段的前提：

- session ledger 已经有稳定用户。
- 用户明确要求交付链路。
- 本地 session 状态和时间估算已经可信。

## V1.0 AI Dev Operating Review

目标：从工具升级为 AI 开发方式的复盘系统。

能力：

- 跨工具 session history。
- 跨项目并行开发分析。
- task type 与 AI 成功率关联。
- prompt/workflow 复用建议。
- 每周 AI 开发复盘。
- 哪些任务适合 Codex、Claude Code、Cursor 的经验沉淀。
- 用户自己的 AI delegation playbook。

长期定位：

> Sessionary becomes the personal operating review layer for AI-native development.

## 商业化假设

### 个人版

目标用户：

- 高频 AI coding 个人开发者
- 独立开发者
- consultant / freelancer

可能价格：

- Free：本地基础 session ledger，有限历史。
- Pro：$8-15/月，完整历史、日报/周报、跨工具、摘要、导出。

### 小团队版

目标用户：

- 2-20 人小团队
- AI-first engineering team
- dev agency

可能价格：

- $12-25/seat/月
- 支持团队聚合，但不做个人绩效排名。

团队版价值：

- 看 AI workflow 是否真的提效。
- 识别 review/repair bottleneck。
- 沉淀适合团队的 AI delegation patterns。

## 防守点

平台方会做基础统计，所以 Sessionary 的防守点不是数据采集，而是工作流解释。

可能防守点：

- 跨 Codex / Claude Code / Cursor 的中立视角。
- 本地优先和隐私信任。
- session inbox 工作流。
- 人类输入、等待、review、repair 的时间结构。
- 并行开发复盘。
- 个人 AI delegation 经验沉淀。

## 关键风险与应对

### 风险：平台方内置统计越来越强

应对：

- 不做单平台 dashboard。
- 不主打 token/cost。
- 坚持跨工具和人类调度视角。

### 风险：人工时间统计不准

应对：

- 标记 estimated。
- 提供手动确认。
- 关注趋势而非秒级准确。

### 风险：集成太多导致 MVP 过重

应对：

- 先只做 Codex + Claude Code。
- 先只做本地日志。
- 先只做 session，不做 PR/CI/Jira。

### 风险：产品变成又一个管理面板

应对：

- 以个人 session inbox 为核心。
- 先服务开发者本人，而不是 manager。
- 语气保持复盘、整理、帮助，而不是监控、考核、排名。

## 下一步建议

下一步可以进入产品原型阶段，优先画三个核心页面：

1. Today：今日项目与时间概览。
2. Session Inbox：待清理 sessions。
3. Project Timeline：多项目并行时间线。

原型确认后，再写技术方案：

- 本地日志数据模型。
- Codex parser。
- Claude Code parser。
- session overlap 算法。
- 人工时间估算规则。
- 本地数据库设计。
