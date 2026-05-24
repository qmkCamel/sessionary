# Change: 优化启动扫描性能

## 背景

当前桌面应用首次加载会在渲染主界面前同步等待 `scanSources()` 完成。真实数据中 Codex JSONL 全量扫描可持续 70 秒以上，导致用户长时间只能看到 loading。

同时 Codex parser 在扫描每条事件时会重复递归提取字符串并重复编译正则表达式，扩大了全量扫描成本。

## 目标

- 应用启动时优先加载 SQLite 中已有 ledger 并渲染界面。
- 本地源扫描改为后台执行，完成后刷新当前 ledger。
- 保留用户手动 rescan 的语义和扫描状态提示。
- 降低 Codex JSONL parser 的重复正则编译和不必要全文扫描成本。

## 不做

- 不改变数据模型字段和现有 SQLite schema。
- 不引入远程同步或新的网络请求。
- 不重设计页面布局、导航或视觉风格。
- 不实现完整文件级增量扫描索引；后续可单独 change 处理。

## 用户价值

用户打开 Sessionary 时可以先看到已有数据和主界面，不再被全量本地扫描阻塞。后台扫描完成后数据自动刷新，保持 local-first 数据边界不变。

## 成功标准

- 首屏加载路径不再等待 `scanSources()`。
- 手动 rescan 仍会触发扫描并刷新 ledger。
- Codex parser 不再在每条事件中重复编译测试命令和文件提取 regex。
- OpenSpec、TypeScript、构建和测试验证通过。
