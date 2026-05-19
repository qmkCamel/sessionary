# Sessionary 产品形态与交互设计

日期：2026-05-19

## 结论

Sessionary 第一版应做成本地优先的桌面应用，而不是 Web SaaS、CLI 或浏览器插件。

核心形态是：

> AI Coding Session Inbox

用户每天打开 Sessionary，不是为了被统计或被考核，而是为了把散落在 Codex、Claude Code、Cursor、worktree 和本地日志里的 AI coding sessions 清理成一份可信的工作账本。

## 为什么是桌面应用

Sessionary 的第一性价值来自本地数据：

- Codex 本地 session / rollout 日志。
- Claude Code 本地 projects 日志或 OpenTelemetry 数据。
- 本地 repo / worktree 路径。
- git branch、dirty state、session 前后文件变化。
- 用户对 session 的轻量标注。

这些数据天然敏感，也天然在本机。桌面应用比 Web SaaS 更适合建立信任：

- 默认不上传源码、prompt、response。
- 权限边界可以明确展示给用户。
- 本地文件读取、后台扫描、菜单栏状态更自然。
- 可以在不依赖云端账号的情况下先验证产品价值。

CLI 适合做 parser 和导出，但不适合承载 Sessionary 的主体验。这个产品需要可视化时间线、inbox 清理、状态标注和日报复盘。

## 产品气质

Sessionary 应该像开发者自己的工作日记，而不是管理层 dashboard。

设计关键词：

- 克制
- 清晰
- 本地优先
- 可复盘
- 不制造焦虑
- 不做效率审判

界面应该偏向安静的专业工具：信息密度高、层级清楚、状态可扫读。避免营销式大卡片、夸张渐变、游戏化排行榜和 KPI 压迫感。

## 应用结构

第一版采用桌面三栏结构：

- 左侧导航：日期、核心页面、数据源状态。
- 中间主工作区：Today / Inbox / Timeline / Report。
- 右侧详情栏：选中 session 的摘要、状态、估算时间、相关文件和备注。

默认打开 Today。用户每天的核心路径是：

1. 打开 Today，看到今天跑了哪些项目和 sessions。
2. 进入 Session Inbox，把未知状态的 sessions 清理掉。
3. 查看 Project Timeline，判断并行开发是否有效。
4. 生成 Daily Report，留下当天复盘。

## 核心页面

### 1. Today

Today 是每日总览，也是应用首页。

目标：

- 让用户在 30 秒内知道今天 AI 开发发生了什么。
- 把项目、session、人类时间、AI waiting 和并行区间放在同一张工作台上。

主要模块：

- 顶部日期与数据新鲜度。
- 今日核心指标：Projects、Sessions、AI Waiting、Human Review、Repair、Parallel Time。
- 一条跨日时间轴，按时间展示 session blocks。
- 并行区间高亮。
- 项目摘要列表。
- 待处理 session 提醒。

交互：

- 点击 session block，在右侧打开详情。
- 点击项目名，筛选当天该项目的 sessions。
- 点击 Needs review / Needs repair，进入 Inbox 的对应过滤视图。
- 时间轴支持按 15 分钟、30 分钟、1 小时粒度缩放。

### 2. Session Inbox

Session Inbox 是产品的行为核心。

目标：

- 让用户像清邮件一样清理 AI sessions。
- 用最低成本把 session 从 unknown 变成明确状态。

主要模块：

- 左上过滤器：All、Unknown、Useful、Needs review、Needs repair、Discarded。
- session 列表：来源工具、项目、持续时间、轮数、tool calls、状态、估算人工时间。
- 快速动作：Useful、Review done、Needs repair、Discard、Add note。
- 右侧详情：时间线、主要 prompt 摘要、工具调用摘要、文件变化线索、备注。

交互：

- 支持键盘快速清理：J/K 上下移动，1 Useful，2 Needs review，3 Needs repair，4 Discarded。
- 状态改变后 session 留在当前列表中短暂显示，再进入下一个待处理项。
- 用户可以为 session 添加一句备注，用于日报。

### 3. Project Timeline

Project Timeline 是差异化最强的页面。

目标：

- 一眼看出多项目、多 session 是否真的并行。
- 判断 human review 是否成为瓶颈。

主要模块：

- 每个项目一条横向轨道。
- 不同 AI 工具用不同小标识区分。
- session block 显示持续时间、轮数和状态。
- 跨项目并行区间用竖向淡色带标出。
- review / repair 作为 session 后续段落显示。

交互：

- 悬停 session block 显示来源、起止、轮数、tool calls。
- 拖选时间区间，查看该区间内的并行项目和 session 数。
- 点击并行区间，右侧显示 overlap summary。
- 支持切换 Day / Week 视角，但 MVP 默认先做 Day。

### 4. Daily Report

Daily Report 是复盘出口。

目标：

- 把当天 session 账本转成可读总结。
- 帮助用户沉淀哪些任务适合 AI、哪些任务造成了 repair 成本。

主要模块：

- 今日摘要：项目、session、并行时间、人类时间估算。
- Useful sessions。
- Needs follow-up。
- Failed / discarded sessions。
- Parallel development notes。
- Tomorrow carry-over。

交互：

- 用户可以编辑摘要段落。
- 支持复制 Markdown。
- 支持导出本地 `.md` 文件。
- 报告中的 session 可以回跳到详情。

## 状态模型

Session 状态保持少而明确：

- Unknown：未清理。
- Useful：有价值，结果可吸收。
- Needs review：还需要检查。
- Needs repair：需要人工修复。
- Repaired：已修复。
- Failed：执行失败。
- Discarded：废弃。

状态不应该被设计成绩效标签。它只是帮助用户整理当天工作。

## 人工时间交互

第一版不追求精确秒表，而是可信估算加手动修正。

页面里所有自动估算都显示 `estimated`：

- Prompting time estimated
- Waiting time estimated
- Review time estimated
- Repair time estimated

用户可以在 session 详情里修正：

- Prompting
- Waiting
- Review
- Repair

修正行为应轻量：点击时间数值即可编辑，保存后标记为 manual。

## 数据源引导

首次启动需要一个短 onboarding，但不做营销页。

推荐流程：

1. 选择要扫描的数据源：Codex、Claude Code。
2. 展示将读取的本地路径。
3. 选择项目根目录或允许从日志自动识别。
4. 执行首次扫描。
5. 进入 Today。

Onboarding 文案要明确：

- Sessionary 默认本地运行。
- 不上传源码。
- 不上传完整 prompt / response。
- 用户可以随时关闭某个数据源。

## MVP 范围

第一版必须做：

- Today
- Session Inbox
- Project Timeline
- Daily Report
- Codex parser
- Claude Code parser
- 本地数据库
- session 状态标注
- session overlap 计算

第一版不做：

- 团队 dashboard
- 云同步
- PR/CI/Jira/Linear 深度集成
- 精确自动判断代码价值
- 自动判断每一行代码归属
- 工时计费与发票

## 高保真图清单

本次原型已生成四张桌面高保真图：

1. `today-dashboard.png`
2. `session-inbox.png`
3. `project-timeline.png`
4. `daily-report.png`

推荐尺寸：

- 16:10 桌面应用截图。
- 约 1440 x 900。
- macOS 桌面应用气质。
- 深浅之间选择柔和浅色界面，信息区块用低对比边界，不做夸张渐变。

## 高保真效果图

### Today

![Today dashboard](images/today-dashboard.png)

### Session Inbox

![Session Inbox](images/session-inbox.png)

### Project Timeline

![Project Timeline](images/project-timeline.png)

### Daily Report

![Daily Report](images/daily-report.png)
