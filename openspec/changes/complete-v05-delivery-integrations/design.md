# Design: V0.5 PR / CI / Issue 轻量归因

## 设计原则

V0.5 是“轻量归因”，不是远程集成。所有外部对象都以本地可推断的 link / candidate 形式呈现。

## 数据来源

- GitHub remote URL：从 `git remote get-url origin` 解析 owner/repo。
- PR：从 commit subject、branch name、session summary 中解析 `PR #123`、`(#123)` 等线索；没有编号时，可基于非默认分支生成 compare URL 作为 candidate。
- Merge：通过本地 git graph 判断 commit 是否已进入默认分支。
- CI：优先使用 session 日志中的本地测试命令；如果有明确 exit code 或 pass/fail 文本，则标注 passed/failed，否则标注 unknown。
- Issue：从 branch、commit subject、summary、note 中解析 Jira/Linear key 和 GitHub issue number。
- Review comment count：本地不可得时必须保持 `null` / unknown。

## 数据模型

每个 session 的 `delivery.integration` 包含：

- `pullRequest`：可选 PR link / candidate。
- `issues`：issue key 线索。
- `ci`：CI/local test 信号。
- `reviewCommentCount`：可选数值，缺失时表示 unknown。
- `attributionConfidence`：归因置信度。

日级 `deliveryReview` 汇总 PR-linked session、issue-linked session、CI signal session 和 merged session 数。

## UI

- Detail Delivery section 显示 PR / issue / CI / review comment count。
- Operating Review 中显示交付链路矩阵。
- Report 增加 Delivery Integration notes。

## 风险

- `(#123)` 既可能是 PR，也可能是 issue。若只从 commit subject 推断，必须标记为 inferred。
- 没有远程 API 时无法确认 PR open/merged、review comment count、CI run 状态。UI 必须显示 unknown 而不是虚假成功。
