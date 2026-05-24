## ADDED Requirements

### Requirement: 启动不得用本地扫描阻塞首屏

应用启动时必须（MUST）先从 SQLite 中已有数据加载当前 ledger 并渲染主界面，不得（MUST NOT）在显示主界面前同步等待完整 source scan 完成。

#### Scenario: 用户打开已有数据的桌面应用

- **WHEN** onboarding 已完成且 SQLite 中已有 session 数据
- **THEN** 应用必须先渲染可交互主界面
- **AND** 本地 Codex / Claude source scan 必须作为后台任务运行
- **AND** 扫描完成后必须刷新当前 ledger

#### Scenario: 后台扫描失败

- **WHEN** 启动后的后台 source scan 失败
- **THEN** 应用必须保留已经渲染的 ledger
- **AND** 必须通过现有错误状态提示失败原因

### Requirement: 手动重新扫描必须继续刷新数据

用户手动触发 rescan 时，应用必须（MUST）执行完整 source scan，并在扫描完成后刷新当前选中日期的 ledger。

#### Scenario: 用户点击 rescan

- **WHEN** 用户在 workspace header 触发重新扫描
- **THEN** 应用必须显示扫描状态
- **AND** 扫描完成后必须刷新当前日期数据

### Requirement: Codex parser 必须避免重复编译热点正则

Codex JSONL parser 必须（MUST）复用测试命令和文件提取相关正则表达式，不得（MUST NOT）在每条事件或每次工具输出解析时重复编译同一正则表达式。

#### Scenario: 扫描包含大量 response item 的 Codex 日志

- **WHEN** parser 遍历大量 Codex JSONL 事件
- **THEN** 测试命令和文件路径匹配必须复用已编译正则
- **AND** 对不包含命令候选关键词的事件不得做完整递归字符串提取
