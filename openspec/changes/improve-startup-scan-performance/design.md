# Design: 优化启动扫描性能

## 数据加载流程

启动流程拆成两段：

1. `load()` 读取 settings、解析目标日期、调用 `getDay()`，尽快用 SQLite 缓存渲染界面。
2. 如果 onboarding 已完成，后台执行 `scanSources()`；扫描成功后再次调用 `load()` 刷新当前日期的 ledger。

`scanning` 表示后台扫描进行中。`loading` 只表示当前 ledger 加载状态，不能因为后台扫描而隐藏已有界面。

手动重新扫描同样使用后台扫描路径：

- 点击 rescan 后只更新 `scanning`，不得把已有 ledger 重新置入 loading 状态。
- 扫描期间按钮显示旋转 icon 和扫描中文案，但主界面、侧栏、列表和日期切换仍可交互。
- 后端 `scan_sources` 必须放到阻塞线程中执行，避免长时间 JSONL 解析占住 Tauri 响应路径。

## Parser 优化

Codex parser 保持现有输入输出不变，只优化热点：

- 使用 `OnceLock<Regex>` 缓存测试命令、文件 marker、文件路径和测试命令确认 regex。
- 对测试命令提取先检查 JSON 事件文本是否包含候选关键词，再做递归字符串提取和 regex 匹配。
- 对文件变更提取复用缓存 regex，避免每个 tool call 重复编译。

## 边界

- 不改变 `SessionRecord`、`DeliveryLink` 或数据库 schema。
- 不改变 fallback API 的行为。
- 不改变 Settings 中 source config 的含义。
- 后台扫描失败时展示现有 error 状态，但不得清空已经渲染的 ledger。
- workspace header 的 `Last scan` 必须来自 source scan run 的 `lastScanAt`，而不是 ledger 生成时间，并显示月日和时间。

## 风险

- 后台扫描完成后刷新 ledger 可能与用户手动切换日期交错。实现需要用当前日期引用，避免刷新过期日期。
- parser 快速过滤可能漏掉命令。关键词过滤必须宽松，只作为进入 regex 的前置条件，不能替代 regex 识别。

## 验证

- `npm run openspec:validate`
- `npm run typecheck`
- `npm run build`
- `npm test`
- 本地启动并确认界面先渲染、扫描状态随后显示。
