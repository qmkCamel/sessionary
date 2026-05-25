## ADDED Requirements

### Requirement: 仓库必须提供数据口径说明

Sessionary 仓库必须（MUST）提供一份数据口径文档，说明 session、day ledger、parallel review、delivery review、operating review 和 report 的数据来源、计算口径、估算边界和已知限制。该文档必须（MUST）明确 local-first 数据边界，并区分真实字段、估算字段、手动修正字段和启发式归因字段。

#### Scenario: 贡献者理解指标来源

- **WHEN** 贡献者阅读数据口径文档
- **THEN** 文档必须列出 Codex、Claude、Git、用户标注、可选 integration 和 fallback 数据分别承担的角色
- **AND** 文档必须说明 SQLite 中当前真实存在的核心表和字段

#### Scenario: 用户或贡献者核对指标可信度

- **WHEN** 用户或贡献者查看 day ledger、parallel、delivery 或 operating review 指标
- **THEN** 文档必须说明这些指标的计算方式、单位、估算/手动边界和不适合作为精确事实的场景
- **AND** 文档必须列出当前发现的容易误读或需要后续修正的问题

#### Scenario: 数据口径文档保持 local-first 边界

- **WHEN** 文档描述 GitHub、Linear 或其他 integration
- **THEN** 文档必须说明这些能力默认关闭，只有用户启用并提供凭证后才访问远程 API
- **AND** 文档不得暗示 Sessionary 会上传完整 prompt、response 或源码正文
