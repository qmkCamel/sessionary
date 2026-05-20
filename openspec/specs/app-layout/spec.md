# app-layout Specification

## Purpose
TBD - created by archiving change redesign-layout-information-architecture. Update Purpose after archive.
## Requirements
### Requirement: 应用必须按页面任务选择布局结构

Sessionary 必须（MUST）根据 Today、Session Inbox、Project Timeline、Daily Report 的页面任务使用不同布局结构，而不得（MUST NOT）在所有页面强制使用永久三栏布局。

#### Scenario: Today 默认不显示永久详情栏

- **WHEN** 用户打开 Today
- **THEN** 页面必须优先展示日期、扫描状态、关键指标、review queue 和当天时间线
- **AND** 未选择 session、overlap 或 range 时不得显示占据宽度的空详情栏

#### Scenario: Inbox 使用 master-detail

- **WHEN** 用户在 1366px 或更宽窗口打开 Session Inbox
- **THEN** 页面必须显示 session list/table 和当前 session detail inspector
- **AND** detail inspector 不得遮挡列表的核心列与快速动作

#### Scenario: Timeline 使用 canvas-first

- **WHEN** 用户打开 Project Timeline
- **THEN** 时间线画布必须成为页面主区域
- **AND** overlap 或 session detail 只能作为上下文 inspector 出现

#### Scenario: Report 使用 document-first

- **WHEN** 用户打开 Daily Report
- **THEN** 报告编辑器必须保持适合阅读和编辑的稳定宽度
- **AND** overview 或辅助指标不得把编辑器挤压到不可读

### Requirement: 应用必须支持响应式布局断点

Sessionary 必须（MUST）支持至少四类宽度：`>=1366px`、`1100px-1365px`、`760px-1099px`、`<760px`。布局必须（MUST）随宽度切换导航、详情和主内容区域的呈现方式。

#### Scenario: 宽屏显示可选 inspector

- **WHEN** 窗口宽度大于或等于 1366px
- **THEN** 应用可以显示左侧导航、主内容和页面级 inspector
- **AND** inspector 必须只在页面任务需要时出现

#### Scenario: 中窄屏不挤压主内容

- **WHEN** 窗口宽度小于 1100px
- **THEN** session detail、overlap summary 或 report overview 必须以 drawer、overlay 或独立详情状态展示
- **AND** 不得继续占用永久右栏宽度

#### Scenario: 窄屏无横向溢出

- **WHEN** 窗口宽度小于 760px
- **THEN** 应用必须使用单列主工作流
- **AND** 页面不得因为全局 `min-width`、固定三栏或不可折叠表格产生横向溢出

### Requirement: 导航区域必须保持职责单一

左侧导航必须（MUST）优先承载页面切换和日期入口。source health、rescan、扫描新鲜度和页面动作必须（MUST）移动到 workspace header 或状态区域，不得（MUST NOT）在侧栏底部形成抢占主导航注意力的第二套 dashboard。

#### Scenario: 用户查看页面导航

- **WHEN** 用户扫读左侧栏
- **THEN** 页面入口必须清晰可见
- **AND** source health 不得比主导航入口更突出

#### Scenario: 用户重新扫描本地数据

- **WHEN** 用户需要 rescan
- **THEN** 应用必须在 workspace header 或等价状态区域提供可发现的 rescan 控件
- **AND** 控件仍然只触发本地扫描，不新增网络请求

### Requirement: 布局重构不得改变 local-first 数据边界

布局重构必须（MUST）只改变前端呈现和本地 UI 状态，不得（MUST NOT）上传 session、prompt、response、文件路径、本地 settings 或扫描结果。

#### Scenario: 打开新布局页面

- **WHEN** 用户在新布局中切换 Today、Inbox、Timeline 或 Report
- **THEN** 应用不得发起新的远程网络请求
- **AND** 所有数据仍来自本地 ledger、settings 和 scan 结果

### Requirement: 多语言文案必须在新布局中保持可读

新布局必须（MUST）支持现有英文和简体中文 UI 文案。按钮、tabs、chips、表格行、inspector 标题和空状态不得（MUST NOT）因中文文案更长而重叠、截断关键含义或挤压核心控件。

#### Scenario: 用户切换到简体中文

- **WHEN** 用户在 Settings 选择简体中文
- **THEN** Today、Inbox、Timeline、Report 的导航、标题、过滤器、动作按钮和状态标签必须保持可读
- **AND** 页面不得出现文字重叠或核心动作被挤出容器
