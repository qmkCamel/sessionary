# Sessionary 产品定位

日期：2026-05-19

## 产品一句话

Sessionary 是面向 AI 并行开发的本地 session 账本，帮助开发者复盘每天的 Codex、Claude Code、Cursor 等 AI coding sessions：做了哪些项目、跑了哪些会话、并行了多久、人类花了多少时间输入、等待、review 和 repair。

## 不是什么

Sessionary 不应该被定位成：

- 通用时间统计工具
- 专注时钟
- token/cost dashboard
- 企业 AI ROI BI
- 项目管理系统
- PR/CI/Jira 全链路度量平台

这些方向要么已有成熟产品，要么对第一版来说过重。

## 是什么

Sessionary 应该被定位成：

> AI Coding Session Inbox

每天开发者会产生很多 AI sessions。它们可能来自 Codex、Claude Code、Cursor、Gemini CLI 或其他 agent。每个 session 都有一个生命周期：被创建、接收 prompt、执行工具、修改文件、等待用户、被继续推进、被废弃、被 review、被修复、被吸收进最终代码。

Sessionary 把这些 session 从分散的日志、终端、worktree 和编辑器里整理出来，形成一个可复盘的个人工作账本。

## 核心用户

第一阶段用户应该非常窄：

- 高频使用 Codex / Claude Code / Cursor 的个人开发者
- 同时开多个 agent 或多个 worktree 的独立开发者
- 经常在多个项目之间并行推进的人
- 想知道 AI 是否真的提高交付效率，而不是只制造更多 review 工作的人

暂时不要优先做：

- 大企业管理层
- 传统时间统计用户
- 只偶尔使用 AI autocomplete 的开发者
- 需要完整工时计费、发票、客户账单的咨询团队

## 核心痛点

AI 并行开发之后，传统时间统计失效了。

过去的问题是：

- 我今天写了多久代码？
- 我在哪个项目上花了最多时间？
- 哪个语言/文件占比最高？

现在的问题变成：

- 我今天到底启动了几个 AI sessions？
- 哪些 session 是有产出的，哪些只是消耗 token？
- AI 跑的时候我在干什么？
- 我节省的时间有没有被 review 和 repair 吃掉？
- 多个项目并行跑时，我的注意力是不是被切碎了？
- 哪些任务适合交给 AI，哪些任务下次应该自己做？

Sessionary 的价值是把这些问题变成可见的时间线和日报。

## 核心差异化

### 1. 以 session 为基本工作单元

传统工具以项目、文件、编辑器输入为基本单位。Sessionary 以 AI coding session 为基本单位。

每个 session 至少包括：

- 项目 / repo / cwd
- 工具来源：Codex、Claude Code、Cursor 等
- 起止时间
- 对话轮数
- 工具调用
- 相关文件变化
- 用户标注状态
- 人工输入、等待、review、repair 的估算

### 2. 面向并行开发

Sessionary 不只列出 sessions，还要显示重叠区间：

- 哪些 sessions 同时运行？
- 哪些项目同时推进？
- 并行时间占总时间多少？
- 人类 review 是否成为瓶颈？

### 3. 关注人类调度成本

AI coding 的关键成本不只是 token，而是人类的注意力：

- 输入 prompt 的时间
- 等待 agent 的时间
- 检查 diff 的时间
- 修复 agent 结果的时间
- 在多个 session 之间切换的成本

Sessionary 要把这些成本显性化。

### 4. 本地优先与隐私

源码和 session 内容天然敏感。第一版应该坚持：

- 优先本地运行
- 默认不上传源码
- 默认不上传完整 prompt / response
- 可选上传匿名聚合指标
- 明确告诉用户读取了哪些本地日志

## 品牌语气

Sessionary 应该更像开发者自己的工作日记，而不是监控软件。

语气关键词：

- 清晰
- 克制
- 本地优先
- 可复盘
- 不审判用户
- 不制造焦虑

避免：

- 过度 KPI 化
- 过度管理者视角
- 用“效率焦虑”压迫用户
- 把 AI 生成代码行数当成主要价值

## 推荐定位文案

英文：

> Sessionary is your AI coding session ledger. It shows which projects you worked on, which agents ran, how sessions overlapped, and where your human time went: prompting, waiting, reviewing, and repairing.

中文：

> Sessionary 是你的 AI 开发会话账本。它记录每天做了哪些项目、跑了哪些 AI sessions、哪些项目并行推进，以及你的时间花在了输入、等待、review 还是修复上。

## 第一版核心承诺

用户打开 Sessionary，应该能在 30 秒内知道：

- 今天做了哪几个项目
- 每个项目跑了哪些 AI sessions
- 每个 session 多少轮、多久、是否有用
- 今天有多少时间在 AI 等待、人工输入、review、repair
- 哪些项目是并行开发的

## 定位边界

第一版不要承诺：

- 精确判断业务价值
- 精确识别每一行代码由人还是 AI 写
- 自动串起 PR、CI、Jira、Linear、GitHub Review 的完整链路
- 企业级团队绩效评估

第一版可以承诺：

- 自动整理本地 AI sessions
- 自动识别项目和时间线
- 自动发现并行开发区间
- 半自动记录人工 review/repair
- 生成每日复盘
