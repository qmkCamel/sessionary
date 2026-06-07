## MODIFIED Requirements

### Requirement: 应用必须按页面任务选择布局结构

Sessionary 必须（MUST）根据 Today、Session Inbox、Project Timeline、Daily Report 的页面任务使用不同布局结构，而不得（MUST NOT）在所有页面强制使用永久三栏布局。

#### Scenario: Timeline 使用 canvas-first

- **WHEN** 用户打开 Project Timeline
- **THEN** 时间线画布必须成为页面主区域
- **AND** overlap 或 session detail 只能作为上下文 inspector 出现
- **AND** 与当天窗口相交的跨天 session 必须按当天可见时间片展示，不得用原始完整 session 跨度撑开画布或显示 500h+ 这类完整跨度标签
