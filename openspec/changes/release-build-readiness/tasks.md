## 1. OpenSpec

- [x] 1.1 更新 release-build-readiness change，将范围改为维护者文档化。
- [x] 1.2 定义产品不得暴露项目专用打包检查的需求。
- [x] 1.3 运行 OpenSpec 校验。

## 2. 产品实现

- [x] 2.1 移除 Settings release readiness / 本地打包检查区域。
- [x] 2.2 移除前端 release readiness 状态、API wrapper、fallback 和类型。
- [x] 2.3 移除 `get_release_readiness` Tauri command、release 模块和模型。

## 3. 文档

- [x] 3.1 保留 README 到 release readiness 文档的维护者入口。
- [x] 3.2 确认文档不被描述为产品内通用发布检查能力。

## 4. 验证

- [x] 4.1 运行 `npm run openspec:validate`。
- [x] 4.2 运行 `npm run typecheck`、`npm run build`、`npm test`。
- [x] 4.3 做本地渲染验证，确认 Settings 不再展示该区域。
