## 1. OpenSpec

- [x] 1.1 创建 `prepare-open-source-release` proposal、design、tasks 与 capability spec。
- [x] 1.2 运行 `npm run openspec:validate`。

## 2. 包元数据与依赖复现

- [x] 2.1 更新 `package.json` 开源元数据、engines 和 packageManager。
- [x] 2.2 使用公共 npm registry 重新生成 `package-lock.json`。
- [x] 2.3 确认 lockfile 不再包含私有 registry URL。

## 3. 开源文档与社区文件

- [x] 3.1 新增 `LICENSE`、`PRIVACY.md`、`CONTRIBUTING.md`、`SECURITY.md`、`SUPPORT.md`、`CODE_OF_CONDUCT.md`。
- [x] 3.2 扩展 README，加入截图、隐私说明、开发流程、验证命令、文档索引和贡献入口。
- [x] 3.3 新增 issue templates 和 PR template。

## 4. 自动化验证

- [x] 4.1 新增 GitHub Actions CI workflow。
- [x] 4.2 CI 覆盖 OpenSpec、typecheck、build 和测试。

## 5. 示例数据脱敏

- [x] 5.1 将 fallback 数据中的维护者本机路径替换为中性示例路径。
- [x] 5.2 将 fixtures 中的维护者本机路径替换为中性示例路径。

## 6. 验证

## 6. OpenSpec 基线整理

- [x] 6.1 归档已完成的 `add-multilingual-ui` change。
- [x] 6.2 归档已完成的 `redesign-layout-information-architecture` change。
- [x] 6.3 完成本 change 后归档 `prepare-open-source-release`。

## 7. 验证

- [x] 7.1 `npm run typecheck` 通过。
- [x] 7.2 `npm run build` 通过。
- [x] 7.3 `npm test` 通过。
- [x] 7.4 检查公开文件不包含私有 registry 或维护者本机路径。
