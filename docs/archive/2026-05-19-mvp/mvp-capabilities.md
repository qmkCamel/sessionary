# Sessionary MVP 能力设计

日期：2026-05-19

## MVP 目标

第一版目标不是做完整 AI 开发效率平台，而是做一个可每天使用的本地 session 账本。

MVP 成功标准：

- 用户无需手动录入大部分 session。
- 用户能看到每天做了哪些项目和 AI sessions。
- 用户能看到 session 的轮数、起止时间、执行时长。
- 用户能看到哪些项目/会话发生了并行。
- 用户可以用很低成本标注 session 是否有用、是否需要 review/repair。
- 用户能获得一份当天 AI 开发日报。

## 信息架构

### Day

一天是 Sessionary 的主视角。

Day 记录：

- 日期
- 当天涉及项目数
- 当天 session 数
- AI 执行总时间
- 人工输入估算时间
- 人工 review 估算时间
- 人工 repair 估算时间
- 并行开发总时长
- 并行项目列表

### Project

Project 由 repo/worktree/cwd 自动识别。

Project 记录：

- 项目名
- 路径
- session 数
- 当天活跃时间段
- 是否与其他项目并行
- 主要 AI 工具来源

### Session

Session 是最小工作单元。

Session 记录：

- session id
- 来源工具：Codex、Claude Code，后续可扩展 Cursor/Gemini
- 项目路径
- 开始时间
- 结束时间
- 持续时间
- 对话轮数
- 用户 prompt 数
- assistant response 数
- tool call 数
- token/cost，如果本地日志可获得
- 相关文件变化，如果可从日志或 git diff 获得
- 状态：有用、待 review、需要 repair、已修复、失败、废弃
- 用户备注

## 指标可行性

### 容易自动统计

这些指标第一版应自动完成：

- 每天做了哪几个项目
- 每个项目有哪些 sessions
- session 来源工具
- session 起止时间
- session 持续时间
- 对话轮数
- 用户输入轮数
- assistant 回复轮数
- tool call 数
- 多个 session 时间段是否重叠
- 哪些项目是并行开发

### 可以估算

这些指标可以先做可信估算：

- 人工输入时间
- 人工 review 时间
- 人工 repair 时间
- session 完成后是否继续发生相关文件改动
- session 结束后用户是否继续围绕同一项目工作

估算原则：

- 用明确标签告诉用户“这是估算，不是精确计时”。
- 允许用户手动修正。
- 比起秒级准确，更重视长期趋势。

### 需要用户轻量确认

这些指标不适合纯自动判断：

- session 是否真的有用
- 是否废弃
- 是否需要人工修
- review 从什么时候开始/结束
- repair 是否归属于某个 session

第一版可以用简单状态按钮解决：

- Useful
- Needs review
- Needs repair
- Repaired
- Failed
- Discarded

## 人工时间统计方案

人工时间不要一开始追求完全自动和绝对准确。建议拆成四类：

### Prompting Time

用户主动输入 prompt、补充需求、纠正方向的时间。

实现方案：

- 如果从本地日志读取，只能根据相邻事件间隔估算。
- 如果后续提供 launcher/wrapper，可以精确统计输入框聚焦、编辑、提交时间。

MVP 做法：

- 先从 user message 时间戳和事件间隔估算。
- 对过长间隔设置上限，避免把离开电脑误算为输入。

### Waiting Time

AI 正在执行、生成、调用工具、跑命令的时间。

实现方案：

- 根据 assistant/tool call 起止时间统计。
- 如果日志没有细粒度事件，则用 session 中 AI 响应区间估算。

MVP 做法：

- 用 session active interval 估算 AI waiting time。
- 后续接 Claude Code OpenTelemetry 时可更精确区分 cli/tool execution。

### Review Time

AI 完成后，用户检查结果、看 diff、跑验证、判断是否接受的时间。

实现方案：

- 纯自动较难。
- 需要手动按钮或状态流。

MVP 做法：

- session 结束后提供 Start Review / Done / Needs Repair。
- 如果用户不点按钮，则用 session 结束到下一次同项目操作之间的时间做估算，并标记为 estimated。

### Repair Time

AI session 完成后，用户手动修改或继续修复的时间。

实现方案：

- 监听相关项目文件变化。
- 结合 git diff 或编辑器活动判断 session 后是否继续发生人类改动。

MVP 做法：

- 先用用户手动标注 Needs repair / Repaired。
- 自动显示 session 后相关文件继续变化的线索。
- 不强行判断每一行代码归属。

## MVP 页面

### 1. Today

今日主视图。

内容：

- 今日项目数
- 今日 session 数
- AI waiting time
- prompting/review/repair estimated time
- 并行开发时间
- 按时间排序的 session timeline
- 并行区间高亮

### 2. Session Inbox

待清理的 session 列表。

内容：

- session 摘要
- 项目
- 起止时间
- 轮数
- 状态
- 快速标注按钮
- 用户备注

目标：

- 让用户像清 inbox 一样清 AI sessions。
- 每天结束时把未知状态 session 清到明确状态。

### 3. Project Timeline

按项目展示一天内的 AI 开发时间线。

内容：

- 每个项目一条横向时间线
- session block
- 并行重叠区间
- review/repair 标记

目标：

- 一眼看到哪些项目在并行。
- 判断并行是否过载。

### 4. Daily Report

日报。

内容：

- 今天做了哪些项目
- 哪些 sessions 有用
- 哪些失败/废弃
- 并行开发时段
- 人工时间估算
- 明天需要继续处理的 session

## 数据来源

### Codex

可从本地 Codex session/rollout 日志中解析：

- session id
- 时间戳
- cwd
- 用户消息
- assistant/tool activity
- 命令执行

### Claude Code

可从本地 projects 日志或 OpenTelemetry 事件中解析：

- session count
- active time
- token/cost
- tool activity
- prompt id
- commits/PRs，如果后续接入

### Git

MVP 只做轻量读取：

- repo 名称
- branch
- worktree 路径
- session 前后是否有文件变化
- 当前 dirty state

不做：

- 远程 PR 解析
- CI 状态
- Jira/Linear issue 关联

## 本地优先原则

MVP 默认：

- 不上传源码
- 不上传完整 session 内容
- 本地保存 session metadata
- 用户可选择是否让本地模型或远程模型生成摘要
- 明确展示数据来源和权限

## 非目标

MVP 不做：

- 团队管理后台
- 绩效排名
- 发票/客户计费
- PR/merge 全链路 ROI
- 自动判断业务价值
- 自动把 session 变成 prompt library
- 手机端

## 验收标准

一个可用的 MVP 应该能在真实使用一天后回答：

- 今天我做了哪几个项目？
- 每个项目用了哪些 sessions？
- 每个 session 多少轮、多久？
- 哪些 sessions 时间上重叠？
- 哪些项目是并行开发？
- 哪些 session 我已经确认有用？
- 哪些 session 还需要 review 或 repair？
- 我大概花了多少时间在输入、等待、review、repair？
