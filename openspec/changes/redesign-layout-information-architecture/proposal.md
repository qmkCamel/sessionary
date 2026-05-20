# Change: 重构应用布局与信息架构

## 背景

当前实现把 Sessionary 的所有主页面固定塞进 `左侧导航 + 中间工作区 + 右侧详情栏` 三栏结构。这个结构在 Session Inbox 里合理，但放到 Today、Project Timeline 和 Daily Report 时会挤压主任务区域，让时间线、项目表和报告编辑器都显得局促。

Sessionary 的产品定位不是管理层 dashboard，而是开发者每天清理 AI coding sessions 的本地工作台。布局应该服务于“今天要处理什么、哪里需要复盘、哪些并行值得看”这条工作流，而不是把所有信息同时摆出来。

## 目标

- 建立页面级布局策略：不同页面根据任务采用不同主从关系，而不是共用永久三栏。
- Today 改为每日 command center：突出待处理队列、关键指标和当天时间线，默认不展示永久详情栏。
- Session Inbox 保留 master-detail，但只在宽屏使用常驻详情；中窄屏改为抽屉或独立详情状态。
- Project Timeline 改为 canvas-first：时间线占据主要宽度，区间或 session 详情仅作为上下文 inspector 出现。
- Daily Report 改为 document-first：报告编辑器居中，摘要信息只在宽屏作为辅助 rail。
- 定义响应式断点，移除阻止窄窗口适配的全局 `min-width: 1080px`。
- 把 source health、rescan、日期选择从侧栏底部提升为顶栏/状态区，避免导航区域承担过多职责。
- 为后续实现拆分 React 组件和 CSS layout tokens 提供清晰边界。

## 非目标

- 不改变解析、SQLite、session 状态模型或日报生成逻辑。
- 不重新定义多语言能力。
- 不引入远程同步、账号、云端数据或额外隐私边界。
- 不做复杂自定义可拖拽分栏；MVP 使用稳定断点、抽屉和可折叠 inspector。
- 不把当前所有视觉细节一次性重做成新的品牌系统；本轮聚焦布局、层级和主任务区域。

## 用户价值

用户打开应用后能更快判断今天是否还有待处理 session，能在 Inbox 里高效清理，能在 Timeline 里看清真正的并行关系，并在 Report 里获得不被侧栏挤压的写作空间。布局减少认知负担，也更符合桌面生产力工具的常识。

## 成功标准

- OpenSpec 严格校验通过。
- 新布局在 1440px 桌面宽度下 Today 不再显示永久详情栏，主工作区明显增宽。
- Inbox 在 1366px 及以上保留列表 + 详情两栏，在 1100px 以下详情不占用主布局宽度。
- Timeline 的时间线画布成为页面视觉主体，详情/overlap summary 不压缩画布。
- Report 的编辑区宽度稳定在适合阅读和编辑的范围，宽屏辅助信息不抢主文档空间。
- 1024px、768px、移动窄宽视口没有横向溢出或文字重叠。
- 渲染验证覆盖 Today、Inbox、Timeline、Report 至少四个页面和桌面/窄屏两个宽度。

## 调研依据

- Apple Human Interface Guidelines: Split Views / Sidebars：分栏适合主从关系，但应根据窗口宽度和内容优先级调整，不应让补充 pane 压过主内容。
- Microsoft Fluent 2 Layout / Nav：布局应建立空间关系、突出最重要内容，并按屏幕尺寸响应。
- Material Design Responsive UI / Navigation：响应式布局需要基于断点改变导航与内容区域，永久导航和临时导航应按宽度切换。
- Dashboard UX best practices：dashboard 应减少认知负担、突出关键指标和用户决策，而不是堆满所有可展示数据。

