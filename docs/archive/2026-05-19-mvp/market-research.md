# Sessionary 市场调研

日期：2026-05-19

## 结论

Sessionary 所在方向不是空白市场。传统开发者时间统计、AI 编码工具用量统计、agent observability、团队 ROI 仪表盘都已经开始覆盖一部分需求。

但市场仍然有一个明确缝隙：面向个人开发者和小团队的 **AI coding session 复盘账本**。它不只回答“AI 花了多少钱、跑了多久”，而是回答“今天哪些 AI session 值得留下，哪些浪费了时间，哪些导致人工 review 或 repair 成本变高”。

因此，Sessionary 不应定位为通用时间统计工具，也不应从 token/cost dashboard 切入。更好的切入是本地优先的 session inbox：自动整理 Codex、Claude Code 等 AI coding sessions，展示每天项目、会话轮次、等待时间、人工输入/review/修复估算，以及并行开发时间段。

## 市场背景

AI coding 正在从单轮补全变成多 session、多 agent、跨项目并行执行。OpenAI Codex 已经明确强调 multi-agent workflows：内置 worktrees 和云环境，让 agents 可以在多个项目中并行工作。Claude Code 也已经提供 OpenTelemetry 监控能力，可导出 session、成本、token、tool activity、active time 等指标。

这意味着开发者面临的新问题不再只是“我今天写了多久代码”，而是：

- 今天同时跑了几个 AI session？
- 哪些项目是并行推进的？
- 哪些 session 真的有用？
- AI 执行时间、人类输入时间、review 时间、repair 时间分别占多少？
- 多开 agent 后，是提高吞吐，还是制造更多待 review 工作？

传统时间统计产品可以记录编辑器输入时间，但很难表达 AI 并行开发中的等待、审查、返工和 session 价值。

## 竞品与相邻产品

### WakaTime

WakaTime 是传统开发者时间统计领域的强产品。它自动跟踪项目、文件、分支、commit/PR、编辑器、语言等维度，并且已经开始收集 AI 相关元数据，包括 AI/human lines changed、AI input/output token usage、AI prompt length、AI subscription plan、AI session ids 等。

与 Sessionary 的重叠度：45%-60%。

重叠点：

- 项目级时间统计
- commit/PR 维度
- AI token 与 session 元数据
- AI 与人类代码改动统计

缺口：

- 不是以 AI coding session inbox 为中心
- 不强调 session 结束后的人工 review/repair 账本
- 不突出多个 AI sessions 同时运行时的并行开发视图
- 更偏“开发者时间统计平台”，而不是“AI 会话复盘工具”

### Parallel Hours

Parallel Hours 是当前最接近 Sessionary 方向的产品。它明确面向 AI developers，支持 human 和 AI work side-by-side，支持多个 concurrent timers，记录 prompt counts 和 AI-autonomous minutes，并提供 AI leverage ratio、velocity、defect rate、estimate accuracy 等 KPI。

与 Sessionary 的重叠度：65%-80%。

重叠点：

- 人类与 AI 工作并行计时
- 多个并发 timer
- AI autonomous minutes
- AI leverage ratio
- 项目/任务/KPI 维度

缺口：

- 更像任务/KPI/时间管理系统
- 可能依赖手动或半自动 timer
- 不一定以本地 AI session 日志解析为第一入口
- 不一定聚焦 Codex/Claude Code 本地 session 的复盘、状态标注和日报清理

### TokenScope

TokenScope 更偏 AI coding analytics，主要跟踪 tool usage、file changes、git operations、session patterns、code churn、time analytics。它的 VS Code 插件说明中明确支持从 Claude Code 和 OpenAI Codex CLI 本地日志统计 token 与成本。

与 Sessionary 的重叠度：25%-40%。

重叠点：

- AI coding sessions
- Claude Code / Codex CLI 本地日志
- token、成本、response/session 数
- workspace/project 维度

缺口：

- 更偏 token/cost analytics
- 不以人类输入、等待、review、repair 的时间结构为核心
- 不强调 session 状态：成功、失败、废弃、待修、已吸收
- 不强调每日 session inbox 和并行项目复盘

### Claude Code 内置监控

Claude Code 已经通过 OpenTelemetry 导出 usage、cost、tool activity、session count、lines of code、commits、pull requests、active time 等指标。它还支持把 prompt.id 与相关 API calls、tools events 串起来。

这说明平台方正在吃掉基础监控层。长期看，单一工具内部的 usage/cost/session metrics 会越来越平台内置。

Sessionary 的机会不在复制 Claude Code dashboard，而在：

- 跨 Codex、Claude Code、Cursor 等工具的中立视角
- 面向个人开发者的本地 session 整理
- 人类调度成本估算
- session 有用/无用/待修的复盘工作流

### Codex / GitHub Copilot 等平台方

OpenAI Codex 的公开定位已经包括多 agent、worktrees、parallel across projects。GitHub Copilot usage metrics 也覆盖 adoption、engagement、code generation、pull request lifecycle trends 等企业指标。

平台方会持续增强：

- token/cost 统计
- session usage
- agent activity
- PR lifecycle
- 企业 adoption 和 license ROI

但平台方天然不适合做完全中立的跨工具复盘层。Codex 会优先证明 Codex 的价值，Claude Code 会优先服务 Claude Code 的企业监控，GitHub 会优先站在 GitHub/Copilot/企业治理视角。

## 市场机会

Sessionary 的机会不是“AI 时间统计”，而是：

> 面向 AI 并行开发者的本地 session 账本，帮助用户每天清理、标注、复盘 Codex / Claude Code / Cursor sessions，理解自己的 AI 开发时间结构。

高价值问题：

- 今天做了哪几个项目？
- 每个项目用了哪些 AI sessions？
- 每个 session 有多少轮对话，持续多久？
- AI 在跑多久，人类在输入、review、repair 上花了多久？
- 哪些项目/会话是并行开发的？
- 哪些 session 成功、失败、废弃、待修？
- 哪些 session 值得复用为 prompt、skill、workflow？

## 风险

- 如果只做 token/cost dashboard，会被 TokenScope、ccusage、Claude Code 内置监控覆盖。
- 如果只做时间统计，会被 WakaTime 和 Parallel Hours 覆盖。
- 如果一开始做 PR/CI/Jira/Linear 全链路，会陷入集成复杂度。
- 人工 review/repair 时间很难纯自动精确统计，必须采用可信估算加轻量确认。

## 推荐切入

第一版只做 session 层，不做完整 PR/merge 链路。

核心判断：

- 自动统计“项目、session、轮次、起止、并行区间”。
- 半自动统计“成功/失败/废弃/待修、review/repair 时间”。
- 用本地日志和 git diff 估算，不上传源码。
- 产品体验做成每日 session inbox，而不是 BI dashboard。

## 参考来源

- WakaTime Features: https://wakatime.com/features
- Parallel Hours: https://www.parallelhours.io/
- TokenScope: https://tokenscope.dev/
- TokenScope VS Code Marketplace: https://marketplace.visualstudio.com/items?itemName=hooni.tokenscope
- Claude Code Monitoring: https://code.claude.com/docs/en/monitoring-usage
- OpenAI Codex: https://openai.com/codex/
- GitHub Copilot usage metrics: https://docs.github.com/en/copilot/concepts/copilot-usage-metrics
