# 准备 GitHub 开源发布

## Background

Sessionary 已经具备可运行的 MVP、产品文档、OpenSpec 变更记录和本地测试脚本。现在仓库准备作为 GitHub 开源项目公开，需要补齐开源项目的信任入口、贡献入口、隐私说明和自动化验证，确保外部用户可以安全地 clone、安装、运行、提 issue 和提交 PR。

当前仓库存在几个开源前风险：

- 根目录缺少可检测的 `LICENSE`、`CONTRIBUTING.md`、`SECURITY.md` 等社区文件。
- README 只覆盖基础运行命令，缺少截图、隐私边界、开发流程和故障排查。
- `package-lock.json` 中存在私有 npm registry resolved URL，外部贡献者可能无法复现安装。
- `npm run openspec:*` 当前依赖本地不可用的 `openspec` bin，不符合仓库声明的规格验证流程。
- 缺少 GitHub Actions，维护者无法在 PR 上自动验证 OpenSpec、前端、Rust 与构建。
- 已完成的历史 OpenSpec changes 仍停留在 active changes 中，外部贡献者难以区分基线规格和待实现变更。

## Goals

- 让公开仓库首页清楚说明 Sessionary 的用途、隐私边界、安装运行方式和验证命令。
- 补齐 license、贡献指南、行为准则、安全披露、支持渠道、隐私说明、issue/PR templates。
- 清理包元数据和 lockfile，确保外部环境可以使用公共 registry 安装依赖。
- 新增 GitHub Actions CI，自动运行 OpenSpec、typecheck、build 和测试。
- 对示例数据和 fallback 数据做轻量脱敏，避免公开个人本机路径作为默认示例。
- 将已完成的历史 OpenSpec changes 归档进 baseline specs，保持 active changes 列表只承载真实待变更事项。

## Non-goals

- 不发布正式安装包或配置代码签名、公证、自动更新。
- 不改变产品数据模型、扫描逻辑、Tauri command 行为或 UI 功能。
- 不引入远程服务、账户系统、云同步或 telemetry。
- 不处理历史 git 对象中的潜在私有内容清理。

## User Value

- 新用户可以更快判断 Sessionary 是否适合自己，并安全地在本地运行。
- 贡献者可以知道如何提 issue、如何写 OpenSpec、如何运行验证。
- 维护者可以通过 CI 在 PR 进入 review 前发现基础质量问题。
- 安全研究者可以通过明确渠道报告漏洞，而不是公开泄露细节。

## Success Criteria

- 仓库根目录存在 `LICENSE`、`CONTRIBUTING.md`、`SECURITY.md`、`SUPPORT.md`、`CODE_OF_CONDUCT.md`、`PRIVACY.md`。
- `.github` 下存在 CI workflow、issue templates 和 pull request template。
- `package-lock.json` 不再引用私有 npm registry。
- `npm run openspec:validate`、`npm run typecheck`、`npm run build`、`npm test` 均可运行。
- README 包含截图、隐私说明、开发流程、验证命令和贡献入口。
- 已完成的历史 OpenSpec changes 不再作为 active changes 暴露。
