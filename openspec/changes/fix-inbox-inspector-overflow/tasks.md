## 1. OpenSpec

- [x] 1.1 创建 Inbox inspector overflow 修复 change。
- [x] 1.2 定义 Inbox master-detail 不得横向溢出的需求。
- [x] 1.3 运行 OpenSpec 严格校验。

## 2. 前端布局

- [x] 2.1 收敛 Inbox master-detail 栅格宽度，避免固定右栏撑出页面。
- [x] 2.2 修复 detail inspector、status grid、delivery row、长标题和长链接的换行/省略。
- [x] 2.3 保持中窄屏单列展示，不改变业务交互。
- [x] 2.4 修复紧凑侧栏品牌溢出和运营复盘桌面表格横向滚动。
- [x] 2.5 保持左侧导航 sticky，不因横向溢出裁切破坏纵向固定。
- [x] 2.6 调整 Settings 页面分组、来源卡片、集成卡片和启用开关样式。
- [x] 2.7 为项目根目录补输入示例，并移除 Settings 中非通用的发布/打包检查区域。
- [x] 2.8 调整 Report 页面编辑器自适应高度和右侧摘要 sticky 行为。

## 3. 验证

- [x] 3.1 运行 `npm run openspec:validate`。
- [x] 3.2 运行 `npm run typecheck`、`npm run build`、`npm test`。
- [x] 3.3 做本地渲染验证，确认 Inbox 无全局横向溢出。
