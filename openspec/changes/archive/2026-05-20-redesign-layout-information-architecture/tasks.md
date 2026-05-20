## 1. 规格与设计

- [x] 1.1 梳理当前实现的布局问题和现有产品文档。
- [x] 1.2 记录调研依据与页面级布局原则。
- [x] 1.3 创建 OpenSpec proposal、design、tasks 和 app-layout spec delta。
- [x] 1.4 生成并保存高保真布局稿，作为实现前的评审基准。
- [x] 1.5 用户确认布局方向后再进入生产代码重构。

## 2. Shell 与组件边界

- [x] 2.1 新增测试覆盖的 `src/layout/layoutRules.ts`，记录页面级 inspector 布局规则。
- [x] 2.2 新增 `WorkspaceHeader`，承载扫描状态、source health、rescan 和页面动作。
- [x] 2.3 将 `DetailPanel` 改造成页面按需 inspector，不再在 app shell 层永久占位。
- [x] 2.4 在当前 React 边界内重组 Today、Inbox、Timeline、Report、Settings 视图，避免本轮同时做大规模文件搬迁。
- [x] 2.5 复用并收敛共享 UI primitives：metric、panel、chip、toolbar、empty state、segmented control。

## 3. 页面布局实现

- [x] 3.1 Today 改为 command center：4 个以内关键指标 + review queue + timeline preview + 项目表。
- [x] 3.2 Inbox 实现宽屏 master-detail、中窄屏单列详情状态。
- [x] 3.3 Timeline 实现 canvas-first 布局和按需 overlap/session inspector。
- [x] 3.4 Report 实现 document-first 布局和宽屏辅助 overview。
- [x] 3.5 Settings 保持表单可用，纳入新 shell/header 但不改变 settings 数据行为。

## 4. 响应式与可访问性

- [x] 4.1 移除 `body min-width: 1080px`，建立明确断点。
- [x] 4.2 覆盖 `>=1366px`、`1100-1365px`、`760-1099px`、`<760px` 四类布局。
- [x] 4.3 检查中英文长标签、按钮、chips、表格单元格无重叠。
- [x] 4.4 保留键盘清理 Inbox 的交互语义和 focus 可见性。
- [x] 4.5 Inspector 在宽屏为页面级右侧区域，中窄屏为单列后续内容，不再挤压主内容。

## 5. 验证

- [x] 5.1 运行 `npm run openspec:validate`。
- [x] 5.2 运行 `npm run typecheck`。
- [x] 5.3 运行 `npm run build`。
- [x] 5.4 运行 `npm test`。
- [x] 5.5 本地渲染验证 Today、Inbox、Timeline、Report。
- [x] 5.6 桌面与窄屏截图比对高保真稿，记录并修复布局偏差。
