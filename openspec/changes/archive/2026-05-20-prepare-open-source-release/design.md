# 开源准备设计

## 文档与社区入口

根目录文档作为用户和贡献者的第一入口：

- `README.md`：产品定位、截图、功能、隐私摘要、系统要求、运行、验证、文档索引、贡献入口。
- `PRIVACY.md`：说明扫描哪些本地路径、存储位置、不会上传什么、如何删除本地数据、fixture/fallback 数据原则。
- `CONTRIBUTING.md`：贡献流程、OpenSpec 规则、开发环境、验证矩阵、PR 期望。
- `SECURITY.md`：支持版本和私下报告漏洞方式。
- `SUPPORT.md`：普通问题、bug、安全问题和功能讨论的分流。
- `CODE_OF_CONDUCT.md`：采用 Contributor Covenant 风格的社区行为约定。
- `LICENSE`：与 package metadata 保持一致，使用 ISC。

`.github` 目录承载协作自动化：

- `workflows/ci.yml`：安装依赖并运行 OpenSpec、typecheck、build 和测试。
- `ISSUE_TEMPLATE/bug_report.yml`：收集系统、版本、数据源、复现步骤、隐私确认。
- `ISSUE_TEMPLATE/feature_request.yml`：收集问题背景、提议方案、local-first 影响和贡献意愿。
- `pull_request_template.md`：提示 OpenSpec、验证命令、隐私影响和截图。

## 包元数据与依赖复现

`package.json` 调整为公开仓库元数据：

- 移除 `private: true` 或改为公开可发布语义。
- 补充 `author`、`keywords`、`engines`、`packageManager`。
- 保持 license 与 `LICENSE` 一致。

重新生成 `package-lock.json` 时强制使用 `https://registry.npmjs.org/`，避免私有 registry URL 泄露或阻断外部安装。

## OpenSpec 基线整理

`add-multilingual-ui` 和 `redesign-layout-information-architecture` 已经完成实现与验证，但仍留在 active changes 中。开源前使用 `openspec archive <change> -y` 将它们归档到 `openspec/specs`，让外部贡献者看到的 active changes 只代表真正进行中的工作。

本次 `prepare-open-source-release` 在全部任务完成并验证通过后也应归档到 baseline specs，保留规格真相源而不是长期保留一个已完成的开源准备 change。

## 示例数据脱敏

当前 fallback 数据使用真实本机风格路径。开源前将这些路径改为中性示例路径，例如 `/Users/alex/work/...`，保持 UI 示例价值但不暴露维护者环境命名。fixture 中的路径也改为相同中性前缀，避免 README/测试输出出现维护者本机用户名。

## CI 设计

CI 使用 GitHub-hosted runner 的 macOS 环境，因为项目包含 Tauri/Rust 和桌面 app 构建语境。流程：

1. Checkout。
2. Setup Node 20.19+。
3. Setup Rust stable。
4. `npm ci`。
5. `npm run openspec:validate`。
6. `npm run typecheck`。
7. `npm run build`。
8. `npm test`。

CI 暂不构建签名安装包，不上传 artifacts。

## 本地优先与隐私约束

本变更只添加文档、配置和示例数据清理，不改变应用运行时边界。不得引入任何远程数据上传、遥测、账户系统或云同步。CI 只验证仓库代码，不读取用户机器上的 Codex/Claude 数据。

## Fallback Behavior

- 如果用户没有安装 Codex 或 Claude Code，README 和 SUPPORT 应说明可以使用 fallback/mock 数据查看界面。
- 如果 OpenSpec CLI 安装失败，CONTRIBUTING 中说明先运行 `npm ci` 并确认 Node 版本。
- 如果 Tauri app 无法启动，README 提供 `npm run dev:web` 作为前端预览入口，但标注部分 native command 在浏览器中会使用 fallback。

## Validation

- `npm run openspec:validate`
- `npm run typecheck`
- `npm run build`
- `npm test`
- 检查 lockfile 不包含私有 npm registry。
- 检查公开文档不包含维护者本机绝对路径。
- 检查 `openspec/specs` 包含已完成能力，active changes 列表不保留已完成历史任务。
