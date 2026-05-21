## ADDED Requirements

### Requirement: Session 必须提供轻量交付关联

Sessionary 必须（MUST）为每个 session 提供 delivery linkage，至少包含 diff 摘要、交付相关文件、session 后 commit 线索、dirty 状态、absorbed 状态和测试命令线索。delivery linkage 必须（MUST）全部来自本地 session 日志、本地 git 仓库或用户手动标记。

#### Scenario: 用户查看 session detail

- **WHEN** 用户选择一个 session
- **THEN** detail 必须显示 delivery 摘要
- **AND** 必须显示该 session 是否有 session 后 commit
- **AND** 必须显示仓库是否仍有 dirty changes
- **AND** 必须显示 absorbed 状态

#### Scenario: session 没有 git 仓库

- **WHEN** session 的 cwd 无法解析到 git 仓库
- **THEN** delivery linkage 必须返回空摘要和低置信度
- **AND** UI 不得报错

### Requirement: 用户必须可以手动标记 absorbed

Sessionary 必须（MUST）允许用户将 session 标记为 absorbed 或未 absorbed。手动 absorbed 标记必须（MUST）保存到本地 SQLite，并且后续重新扫描不得覆盖 `absorbed=true`。

#### Scenario: 用户标记已吸收

- **WHEN** 用户在 session detail 中标记 absorbed
- **THEN** session 的 delivery absorbed 必须变为 true
- **AND** 重新加载 day ledger 后必须保持 true

### Requirement: Delivery Review 必须汇总交付吸收状态

Day ledger 必须（MUST）包含 delivery review summary，至少统计有文件线索的 session 数、有 commit 的 session 数、有 dirty changes 的 session 数、absorbed session 数和检测到测试命令的 session 数。

#### Scenario: 用户查看 Today

- **WHEN** 当天存在 sessions
- **THEN** Today 必须显示 delivery review metrics
- **AND** metrics 必须能区分 committed、dirty 和 absorbed

### Requirement: Report 必须包含轻量交付复盘

Daily Report 和 Weekly Report 必须（MUST）包含 Delivery Review 段落，列出交付吸收摘要和需要继续处理的 sessions。

#### Scenario: 用户生成报告

- **WHEN** 用户生成 Daily Report 或 Weekly Report
- **THEN** Markdown 必须包含 Delivery Review 或等价段落
- **AND** 不得保存或输出完整源码 diff 正文

### Requirement: V0.4 不得改变 local-first 隐私边界

Delivery linkage 必须（MUST）全部在本地计算。实现不得（MUST NOT）新增账号、云同步、遥测、远程 API 或上传 prompt / response / source code。

#### Scenario: 用户查看 delivery 信息

- **WHEN** 用户查看 Today、Detail 或 Report
- **THEN** 应用不得发起远程网络请求
- **AND** 所有数据必须来自本地 SQLite、session 日志、settings、scan 结果、本地 git 和前端 fallback
