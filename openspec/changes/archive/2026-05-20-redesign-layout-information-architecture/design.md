# Design: 重构应用布局与信息架构

## 范围

本轮改变 Sessionary 前端布局结构、页面信息层级和响应式行为。它不改变后端数据模型，也不改变当前 local-first 数据边界。

## 布局原则

1. **主任务优先**：每个页面只把该页面的核心任务放在最宽区域。
2. **详情按需出现**：详情栏只在用户选中 session、overlap 或编辑上下文时出现；Today 默认不常驻详情栏。
3. **导航只做导航**：左侧栏承载页面切换和日期入口；数据源健康、扫描状态、刷新动作移动到顶栏或状态条。
4. **宽屏增强，不是宽屏依赖**：大屏可以展示更多辅助 rail，但核心流程必须在 1024px 和更窄窗口可用。
5. **密度服务扫读**：保留专业工具的信息密度，但关键指标不超过 4 个主要卡片，次要数据进入表格、队列或详情。

## 页面布局

### Global Shell

采用两层 shell：

- `AppShell`：左侧主导航 + 右侧内容区。
- `WorkspaceHeader`：内容区顶部统一承载日期、扫描状态、rescan、source health 和页面级动作。

桌面宽屏：

- 左侧导航固定 236-260px。
- 内容区使用 `minmax(0, 1fr)`，内部由页面决定是否显示 inspector。
- 不再在 app shell 层永久挂载 `DetailPanel`。

中窄屏：

- 1100px 以下左侧导航压缩为 compact rail 或顶部切换入口。
- 详情内容通过 drawer/modal route 展示，不挤压主内容。
- 全局不设置 `body min-width`。

### Today

Today 是 command center，而不是所有数据的堆叠 dashboard。

结构：

- 顶部：日期、数据新鲜度、Rescan、source health summary。
- 第一行：最多 4 个关键指标：Open review queue、Needs repair、Parallel time、Human time estimate。
- 主区域：左侧 review queue，右侧当天 timeline preview。
- 下方：项目工作量表和最近 session 列表。

交互：

- 点击待处理项进入 Inbox 对应过滤视图。
- 点击 timeline block 可以打开临时 inspector；未选中时不显示详情栏。
- 点击项目行筛选该项目 sessions。

### Session Inbox

Inbox 是唯一默认 master-detail 页面。

宽屏结构：

- 上方过滤器和搜索。
- 左侧 session list/table 占主宽度。
- 右侧 session detail inspector 360-420px，仅在 1366px 及以上常驻。

中窄屏结构：

- session list/table 占满内容区。
- 选择 session 后详情以 drawer 或独立详情状态出现。

交互：

- 快捷动作保留在行内。
- 状态修改后保持短暂停留并自动推进下一个待处理项。
- 详情 inspector 聚焦 review flow、time breakdown、files、note，不重复列表已有元数据。

### Project Timeline

Timeline 是 canvas-first 页面。

结构：

- 顶部工具条：Day/Week、zoom、source filter、Today、Rescan。
- 主画布占页面第一优先级，项目轨道和时间刻度横向可读。
- overlap summary 是上下文 inspector：宽屏右侧显示，窄屏底部 drawer，未选中时收起为摘要条。

交互：

- Hover 显示轻量 tooltip。
- 点击 session 或 overlap 打开 inspector。
- 拖选时间范围后 inspector 显示范围摘要。

### Daily Report

Report 是 document-first 页面。

结构：

- 报告编辑器居中，宽度 760-880px。
- 顶部工具条承载 regenerate、copy、export。
- 宽屏右侧可显示 report overview，但不压缩编辑器到不可读宽度。
- 窄屏隐藏 overview，保留核心编辑和导出动作。

## 响应式断点

- `>= 1366px`：expanded desktop。左侧导航 + 页面主内容 + 可选 inspector。
- `1100px - 1365px`：desktop compact。左侧导航 + 主内容，inspector 以 overlay/drawer 出现。
- `760px - 1099px`：tablet/narrow desktop。导航压缩，页面单列优先，tables 使用横向滚动或列表化。
- `< 760px`：single column。导航进入顶部/抽屉，Today、Inbox、Timeline、Report 均以单列工作流展示。

## 组件边界

本轮优先建立可验证的布局边界，避免在视觉重构同时做大规模文件搬迁。落地边界：

- `src/layout/layoutRules.ts`：页面级 inspector 布局规则，单元测试覆盖。
- `AppSidebar` / `WorkspaceHeader`：在 `App.tsx` 内先形成清晰 shell 边界。
- Today / Inbox / Timeline / Report / Settings：保留当前组件边界，但重组为页面自有布局，不再依赖全局三栏。
- `DetailPanel`：作为页面按需 inspector 使用，不再由 app shell 永久挂载。
- CSS primitives：统一 metric、panel、chip、toolbar、empty state、segmented control 和 inspector 响应式规则。

后续如果继续降低单文件复杂度，可以把这些已经稳定的边界迁移到 `src/layout/*` 和 `src/views/*`；这属于代码组织优化，不阻塞本轮用户可见布局修复。

## 数据模型影响

无后端数据模型变化。当前 `DayLedger`、`SessionRecord`、`OverlapInterval`、`AppSettings` 继续作为页面数据源。

前端可能新增纯 UI 状态：

- inspector open/closed。
- inspector mode: `session | overlap | range | none`。
- compact navigation open/closed。

这些状态默认不持久化，避免跨启动恢复到不合适的窄屏布局。

## Local-first 与隐私

布局重构不新增网络请求，不上传 session、prompt、response、文件路径或本地元数据。source health 仍只来自本地 scan 结果。

## 视觉设计方向

延续安静、专业、本地优先的工具气质：

- 使用白色/近白背景和明确边界，不使用夸张渐变或营销式 hero。
- 卡片只用于重复 item、明确 panel 或 inspector，不做层层嵌套卡片。
- 图标用于导航、动作和状态，按钮文案只保留必要命令。
- 时间线、队列和报告编辑器保持稳定尺寸，避免动态内容导致布局跳动。
- 中英文文案都要在按钮、tabs、chips 中可容纳，不允许重叠。

## 兜底行为

- 没有选中 session 时，Today 不显示空详情栏；Inbox 可显示空 inspector 或 drawer 不打开。
- 没有 overlap 时，Timeline 显示轻量空状态，不占用永久右栏。
- 窄屏下如果表格列过多，先保留核心列并把次要字段放入行展开详情。
- 浏览器不支持某些高级 CSS 时，保持基本 grid/flex 布局可用。

## 验证

- `npm run openspec:validate`
- `npm run typecheck`
- `npm run build`
- `npm test`
- 本地渲染检查：
  - Today、Inbox、Timeline、Report 四页截图。
  - 1440px、1180px、1024px、760px 宽度至少一轮。
  - 检查无横向溢出、无文字重叠、详情不错误挤压主内容。
  - 检查语言切换后长中文标签不破坏布局。

## 参考来源

- Apple HIG Split Views: https://developer.apple.com/design/Human-Interface-Guidelines/split-views
- Apple HIG Sidebars: https://developer.apple.com/design/human-interface-guidelines/sidebars
- Fluent 2 Layout: https://fluent2.microsoft.design/layout
- Fluent 2 Nav: https://fluent2.microsoft.design/components/web/react/core/nav/usage
- Material Responsive UI: https://m1.material.io/layout/responsive-ui.html
- Android Responsive Navigation: https://developer.android.com/develop/ui/views/layout/build-responsive-navigation
- Baymard Information Architecture UX: https://baymard.com/learn/information-architecture-ux
