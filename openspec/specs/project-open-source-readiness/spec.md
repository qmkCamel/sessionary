# project-open-source-readiness Specification

## Purpose
TBD - created by archiving change prepare-open-source-release. Update Purpose after archive.
## Requirements
### Requirement: 仓库必须提供开源项目信任入口

Sessionary 仓库必须（MUST）提供可被 GitHub 识别或可被用户直接阅读的 license、隐私、安全、支持、行为准则和贡献文档。文档必须（MUST）明确 local-first 边界，不得（MUST NOT）暗示存在尚未实现的云同步、账户系统或远程发布能力。

#### Scenario: 新用户打开仓库首页

- **WHEN** 新用户访问 GitHub 仓库
- **THEN** README 必须说明 Sessionary 的用途、核心能力、运行方式和验证方式
- **AND** README 必须链接 license、privacy、contributing、security 和 support 文档

#### Scenario: 用户关注本地日志隐私

- **WHEN** 用户阅读隐私文档
- **THEN** 文档必须说明应用读取的默认本地路径和 SQLite 存储位置
- **AND** 文档必须说明应用不会上传 prompts、responses、source files、session metadata 或 settings

### Requirement: 贡献流程必须可复现

Sessionary 仓库必须（MUST）提供外部贡献者可执行的安装、规格、测试和 PR 流程。贡献流程必须（MUST）包含 OpenSpec 变更要求，并说明非 trivial 改动需要先创建或更新 `openspec/changes/<change-id>/`。

#### Scenario: 贡献者准备提交功能改动

- **WHEN** 贡献者阅读贡献指南
- **THEN** 贡献指南必须要求先创建或更新 OpenSpec change
- **AND** 必须列出 `npm run openspec:validate`、`npm run typecheck`、`npm run build`、`npm test`

#### Scenario: 贡献者安装依赖

- **WHEN** 贡献者运行 `npm ci`
- **THEN** lockfile 必须从公共 npm registry 解析依赖
- **AND** 不得依赖维护者私有 registry

### Requirement: PR 必须有自动化基础验证

Sessionary 仓库必须（MUST）提供 GitHub Actions workflow，在 push 或 pull request 时运行基础验证。验证必须（MUST）覆盖 OpenSpec、TypeScript typecheck、前端 build 和测试。

#### Scenario: 贡献者打开 pull request

- **WHEN** GitHub Actions 运行 CI
- **THEN** workflow 必须安装 Node 和 Rust 依赖
- **AND** 必须运行 OpenSpec 校验、TypeScript 校验、build 和测试命令

### Requirement: 公开示例不得暴露维护者本机路径

仓库中的 fallback 数据和 fixtures 必须（MUST）使用中性示例路径，不得（MUST NOT）暴露维护者真实用户名、工作目录或私有项目路径。

#### Scenario: 用户搜索维护者本机路径

- **WHEN** 用户在公开仓库中搜索维护者绝对路径
- **THEN** fallback 数据和 fixtures 中不得出现维护者本机用户名路径
- **AND** 示例数据仍必须保留足够字段以支持测试和 UI fallback

### Requirement: 已完成规格变更必须归档进基线规格

已完成并验证通过的 OpenSpec changes 必须（MUST）归档进 `openspec/specs`，不得（MUST NOT）长期保留在 active changes 列表中作为已完成历史任务。

#### Scenario: 贡献者查看 active changes

- **WHEN** 贡献者运行 `npm run openspec:status`
- **THEN** 输出不得包含已经完成并归档的历史变更
- **AND** 对应能力必须保留在 `openspec/specs` 中作为基线规格
