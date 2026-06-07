## MODIFIED Requirements

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
- **AND** detail inspector 及其内部长文本不得导致页面出现全局横向滚动

#### Scenario: Timeline 使用 canvas-first

- **WHEN** 用户打开 Project Timeline
- **THEN** 时间线画布必须成为页面主区域
- **AND** overlap 或 session detail 只能作为上下文 inspector 出现

#### Scenario: Report 使用 document-first

- **WHEN** 用户打开 Daily Report
- **THEN** 报告编辑器必须保持适合阅读和编辑的稳定宽度
- **AND** overview 或辅助指标不得把编辑器挤压到不可读
- **AND** 报告编辑器不得与页面外层形成双重纵向滚动
- **AND** 宽屏下 overview 应保持可参考的 sticky 辅助栏

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

#### Scenario: 主工作区无全局横向滚动

- **WHEN** 用户在 Today、Inbox、Project Timeline、Operating Review、Daily Report 或 Settings 中调整窗口宽度
- **THEN** 页面不得出现全局横向滚动条
- **AND** 宽表格如需横向滚动，必须局限在表格容器内

#### Scenario: Settings 使用分组表单布局

- **WHEN** 用户打开 Settings
- **THEN** 语言、数据来源、项目根目录、集成和备份/恢复必须按任务分组展示
- **AND** 数据来源与集成配置在桌面宽度下应使用清晰的卡片分组
- **AND** 启用开关不得贴到面板边缘或使用原生控件的失控尺寸

#### Scenario: Settings 空项目根目录提供输入提示

- **WHEN** 项目根目录为空
- **THEN** 输入框必须显示每行一个项目根目录的示例
- **AND** 示例不得写入设置，除非用户主动编辑保存

#### Scenario: Settings 不展示项目专用打包检查

- **WHEN** 用户打开 Settings
- **THEN** 页面不得展示 release readiness、本地打包检查或等价的项目专用打包检查区域
- **AND** Settings 布局不得依赖该区域占位

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

#### Scenario: 长页面滚动时左侧导航保持可见

- **WHEN** 用户在 Report 或其他长页面向下滚动
- **THEN** 左侧导航必须保持在视口内
- **AND** 顶部品牌、日期入口和主导航不得被主内容滚动裁掉
