# Change: 沉淀 Sessionary 数据口径文档

## 背景

Sessionary 已经覆盖 session value、parallel review、delivery linkage、integration、operating review、report 等多层指标。随着指标增多，产品文档和实现之间出现了几类容易混淆的边界：哪些数据来自 parser，哪些来自 git 归因，哪些只是估算，哪些字段会在日级聚合时重复或不切片。

## 目标

- 新增一份稳定的数据口径文档，说明当前实现中的数据来源、存储字段、计算公式和展示边界。
- 明确列出当前发现的不准确、容易误读或需要后续修正的指标。
- 给后续 OpenSpec、实现和产品说明提供一个可引用的基线。

## 不做

- 不在本变更中修改 parser、analytics、UI 或 SQLite schema。
- 不重新设计 session value、parallel review、delivery review 或 operating review 算法。
- 不新增远程同步、遥测或云端数据处理。

## 成功标准

- `docs/data-metric-definitions.md` 覆盖 session、day ledger、parallel、delivery、integration、operating review、report 等主要口径。
- 文档清楚区分事实字段、估算字段、手动字段和启发式归因。
- 文档包含当前发现的问题清单和后续修正建议。
- OpenSpec 严格校验通过。
