use std::collections::BTreeSet;
use std::fs;
use std::path::PathBuf;

use crate::analytics::{
    build_day_ledger, build_delivery_review_summary, build_operating_review_summary,
    build_parallel_review_summary, compute_overlaps, OverlapKind,
};
use crate::db;
use crate::models::{
    DeliveryInsight, DeliveryInsightKind, ParallelInsight, ParallelInsightKind, PlaybookItem,
    PlaybookKind, ReportResult, SessionRecord, SessionStatus, SessionValueCategory, TaskType,
};
use crate::util::week_range;

fn human_time(seconds: i64) -> String {
    if seconds < 60 {
        return format!("{seconds}s");
    }
    let minutes = (seconds as f64 / 60.0).round() as i64;
    if minutes < 60 {
        format!("{minutes}m")
    } else {
        format!("{}h {}m", minutes / 60, minutes % 60)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum ReportLocale {
    En,
    ZhCn,
}

impl ReportLocale {
    fn parse(value: Option<&str>) -> Self {
        match value {
            Some("zh-CN") | Some("zh") => Self::ZhCn,
            _ => Self::En,
        }
    }

    fn text(self) -> ReportText {
        ReportText { locale: self }
    }
}

#[derive(Debug, Clone, Copy)]
struct ReportText {
    locale: ReportLocale,
}

impl ReportText {
    fn pick(self, en: &'static str, zh: &'static str) -> &'static str {
        match self.locale {
            ReportLocale::En => en,
            ReportLocale::ZhCn => zh,
        }
    }

    fn daily_title(self, date: &str) -> String {
        match self.locale {
            ReportLocale::En => format!("# Sessionary Daily Report - {date}"),
            ReportLocale::ZhCn => format!("# Sessionary 日报 - {date}"),
        }
    }

    fn weekly_title(self, week_start: &str, week_end: &str) -> String {
        match self.locale {
            ReportLocale::En => {
                format!("# Sessionary Weekly Report - {week_start} to {week_end}")
            }
            ReportLocale::ZhCn => {
                format!("# Sessionary 周报 - {week_start} 至 {week_end}")
            }
        }
    }

    fn section(self, en: &'static str, zh: &'static str) -> String {
        format!("## {}", self.pick(en, zh))
    }

    fn metric<T: std::fmt::Display>(self, en: &'static str, zh: &'static str, value: T) -> String {
        format!("- {}: {value}", self.pick(en, zh))
    }

    fn session_count(self, count: usize) -> String {
        match self.locale {
            ReportLocale::En => format!("{count} session(s)"),
            ReportLocale::ZhCn => format!("{count} 个 session"),
        }
    }

    fn value_mix(self, high: usize, low: usize, repair: usize, discarded: usize) -> String {
        match self.locale {
            ReportLocale::En => {
                format!(
                    "- Value mix: {high} high, {low} low, {repair} repair, {discarded} discarded"
                )
            }
            ReportLocale::ZhCn => {
                format!(
                    "- 价值构成: 高价值 {high}，低价值 {low}，需修复 {repair}，已丢弃 {discarded}"
                )
            }
        }
    }

    fn review_backlog(self, count: usize, seconds: i64) -> String {
        match self.locale {
            ReportLocale::En => {
                format!(
                    "- Review backlog estimated: {count} session(s), {}",
                    human_time(seconds)
                )
            }
            ReportLocale::ZhCn => {
                format!(
                    "- Review backlog 估算: {count} 个 session，{}",
                    human_time(seconds)
                )
            }
        }
    }

    fn delivery_absorbed(self, absorbed: usize, total: usize) -> String {
        match self.locale {
            ReportLocale::En => format!("- Delivery absorbed: {absorbed}/{total} sessions"),
            ReportLocale::ZhCn => format!("- 已吸收交付: {absorbed}/{total} 个 session"),
        }
    }

    fn delivery_commits_dirty(self, committed: usize, dirty: usize) -> String {
        match self.locale {
            ReportLocale::En => {
                format!("- Delivery commits / dirty: {committed} committed, {dirty} dirty")
            }
            ReportLocale::ZhCn => {
                format!("- 交付 commit / dirty: {committed} 个已提交，{dirty} 个仍 dirty")
            }
        }
    }

    fn pr_ci_issue(self, pr: usize, ci: usize, issues: usize) -> String {
        match self.locale {
            ReportLocale::En => {
                format!(
                    "- PR / CI / Issue signals: {pr} PR, {ci} CI/local test, {issues} issue-linked"
                )
            }
            ReportLocale::ZhCn => {
                format!("- PR / CI / Issue 信号: {pr} 个 PR，{ci} 个 CI/本地测试，{issues} 个 issue 关联")
            }
        }
    }

    fn context_switches(self, total: usize, short: usize) -> String {
        match self.locale {
            ReportLocale::En => format!("- Context switches: {total} total, {short} short"),
            ReportLocale::ZhCn => format!("- 上下文切换: 总计 {total} 次，短时 {short} 次"),
        }
    }

    fn delivery_integrations(self, pr: usize, issues: usize, ci: usize, merged: usize) -> String {
        match self.locale {
            ReportLocale::En => {
                format!("- Delivery Integrations: {pr} PR, {issues} issue-linked, {ci} CI/local test signal(s), {merged} merged")
            }
            ReportLocale::ZhCn => {
                format!("- 交付集成: {pr} 个 PR，{issues} 个 issue 关联，{ci} 个 CI/本地测试信号，{merged} 个已 merge")
            }
        }
    }

    fn success_rate(self, rate: f64, successful: usize, total: usize) -> String {
        match self.locale {
            ReportLocale::En => {
                format!(
                    "- Success rate estimated: {} ({successful}/{total})",
                    percent(rate)
                )
            }
            ReportLocale::ZhCn => {
                format!("- 成功率估算: {}（{successful}/{total}）", percent(rate))
            }
        }
    }

    fn cross_tool_sources(self, sources: usize, projects: usize) -> String {
        match self.locale {
            ReportLocale::En => {
                format!("- Cross-tool sources: {sources}, cross-projects: {projects}")
            }
            ReportLocale::ZhCn => {
                format!("- 跨工具来源: {sources}，跨项目: {projects}")
            }
        }
    }

    fn task_type_summary(
        self,
        task_type: TaskType,
        session_count: usize,
        successful_sessions: usize,
        average_value_score: f64,
    ) -> String {
        match self.locale {
            ReportLocale::En => format!(
                "- {}: {} session(s), {} successful, avg score {:.0}",
                self.task_type(task_type),
                session_count,
                successful_sessions,
                average_value_score
            ),
            ReportLocale::ZhCn => format!(
                "- {}: {} 个 session，{} 个成功，平均评分 {:.0}",
                self.task_type(task_type),
                session_count,
                successful_sessions,
                average_value_score
            ),
        }
    }

    fn value_category(self, category: SessionValueCategory) -> &'static str {
        match self.locale {
            ReportLocale::En => category.as_str(),
            ReportLocale::ZhCn => match category {
                SessionValueCategory::HighValue => "高价值",
                SessionValueCategory::MixedValue => "混合价值",
                SessionValueCategory::LowValue => "低价值",
                SessionValueCategory::NeedsHumanRepair => "需要人工修复",
                SessionValueCategory::Discarded => "已丢弃",
                SessionValueCategory::Unreviewed => "未复盘",
            },
        }
    }

    fn status(self, status: SessionStatus) -> &'static str {
        match self.locale {
            ReportLocale::En => status.as_str(),
            ReportLocale::ZhCn => match status {
                SessionStatus::Unknown => "未知",
                SessionStatus::Useful => "有用",
                SessionStatus::NeedsReview => "待复盘",
                SessionStatus::NeedsRepair => "需修复",
                SessionStatus::Repaired => "已修复",
                SessionStatus::Failed => "失败",
                SessionStatus::Discarded => "已丢弃",
            },
        }
    }

    fn task_type(self, task_type: TaskType) -> &'static str {
        match task_type {
            TaskType::UiFrontend => self.pick("UI/frontend", "UI/前端"),
            TaskType::Docs => self.pick("docs", "文档"),
            TaskType::Tests => self.pick("tests", "测试"),
            TaskType::Backend => self.pick("backend", "后端"),
            TaskType::Delivery => self.pick("delivery", "交付"),
            TaskType::Repair => self.pick("repair", "修复"),
            TaskType::Unknown => self.pick("unknown", "未知"),
        }
    }

    fn no_pr(self) -> &'static str {
        self.pick("no PR", "无 PR")
    }

    fn no_issue(self) -> &'static str {
        self.pick("no issue", "无 issue")
    }

    fn session_line(self, session: &SessionRecord) -> String {
        let note = if session.note.trim().is_empty() {
            String::new()
        } else {
            format!(" - {}", session.note.trim())
        };
        let title = if session.summary.is_empty() {
            &session.source_session_id
        } else {
            &session.summary
        };
        match self.locale {
            ReportLocale::En => format!(
                "- {} / {}: {} ({}, {} user prompts, {} tools){}",
                session.project_name,
                session.source.as_str(),
                title,
                human_time(session.duration_seconds),
                session.user_message_count,
                session.tool_call_count,
                note
            ),
            ReportLocale::ZhCn => format!(
                "- {} / {}: {}（{}，{} 条用户提示，{} 次工具调用）{}",
                session.project_name,
                session.source.as_str(),
                title,
                human_time(session.duration_seconds),
                session.user_message_count,
                session.tool_call_count,
                note
            ),
        }
    }

    fn value_session_line(self, session: &SessionRecord) -> String {
        let title = if session.summary.is_empty() {
            &session.source_session_id
        } else {
            &session.summary
        };
        let cost = session
            .cost_amount
            .map(|cost| format!("${cost:.4}"))
            .unwrap_or_else(|| self.pick("n/a", "无").to_string());
        match self.locale {
            ReportLocale::En => format!(
                "- {} / {}: {} (value: {}, score: {}, cost: {}, tokens: {}, tools: {}, files: {})",
                session.project_name,
                session.source.as_str(),
                title,
                self.value_category(session.value.category),
                session.value.score,
                cost,
                session.token_count.unwrap_or_default(),
                session.tool_call_count,
                session.changed_files.len()
            ),
            ReportLocale::ZhCn => format!(
                "- {} / {}: {}（价值: {}，评分: {}，成本: {}，Tokens: {}，工具调用: {}，文件: {}）",
                session.project_name,
                session.source.as_str(),
                title,
                self.value_category(session.value.category),
                session.value.score,
                cost,
                session.token_count.unwrap_or_default(),
                session.tool_call_count,
                session.changed_files.len()
            ),
        }
    }

    fn parallel_insight_line(self, insight: &ParallelInsight) -> String {
        match insight.kind {
            ParallelInsightKind::ParallelPayoff => match self.locale {
                ReportLocale::En => format!(
                    "- Parallel payoff: {} of AI waiting overlapped with review/repair across {} interval(s).",
                    human_time(insight.seconds),
                    insight.count
                ),
                ReportLocale::ZhCn => format!(
                    "- 并行收益: {} AI waiting 与 review/repair 重叠，覆盖 {} 个区间。",
                    human_time(insight.seconds),
                    insight.count
                ),
            },
            ParallelInsightKind::ReviewBottleneck => match self.locale {
                ReportLocale::En => format!(
                    "- Review bottleneck: {} session(s) have waited about {} for review/repair.",
                    insight.count,
                    human_time(insight.seconds)
                ),
                ReportLocale::ZhCn => format!(
                    "- Review 瓶颈: {} 个 session 已等待约 {} 进入 review/repair。",
                    insight.count,
                    human_time(insight.seconds)
                ),
            },
            ParallelInsightKind::ContextSwitching => match self.locale {
                ReportLocale::En => format!(
                    "- Context switching: {} short cross-project switch(es) detected.",
                    insight.count
                ),
                ReportLocale::ZhCn => {
                    format!("- 上下文切换: 检测到 {} 次短时跨项目切换。", insight.count)
                }
            },
            ParallelInsightKind::LowParallelism => match self.locale {
                ReportLocale::En => {
                    format!("- Low parallelism: {} sessions ran mostly serially.", insight.count)
                }
                ReportLocale::ZhCn => {
                    format!("- 并行度偏低: {} 个 session 基本串行运行。", insight.count)
                }
            },
        }
    }

    fn delivery_insight_line(self, insight: &DeliveryInsight) -> String {
        match insight.kind {
            DeliveryInsightKind::UnabsorbedOutput => match self.locale {
                ReportLocale::En => format!(
                    "- Unabsorbed output: {} session(s) have delivery signals but are not absorbed.",
                    insight.count
                ),
                ReportLocale::ZhCn => {
                    format!("- 未吸收输出: {} 个 session 有交付信号但尚未 absorbed。", insight.count)
                }
            },
            DeliveryInsightKind::DirtyAfterSession => match self.locale {
                ReportLocale::En => format!(
                    "- Dirty after session: {} session(s) still have local dirty changes.",
                    insight.count
                ),
                ReportLocale::ZhCn => {
                    format!("- Session 后仍 dirty: {} 个 session 仍有本地未提交改动。", insight.count)
                }
            },
            DeliveryInsightKind::MissingTests => match self.locale {
                ReportLocale::En => format!(
                    "- Missing local test loop: {} file-changing session(s) have no recorded test command.",
                    insight.count
                ),
                ReportLocale::ZhCn => format!(
                    "- 缺少本地测试闭环: {} 个改动文件的 session 没有记录测试命令。",
                    insight.count
                ),
            },
            DeliveryInsightKind::LinkedDelivery => match self.locale {
                ReportLocale::En => format!(
                    "- Linked delivery: {} PR / issue attribution signal(s) found locally.",
                    insight.count
                ),
                ReportLocale::ZhCn => {
                    format!("- 已关联交付: 本地发现 {} 个 PR / issue 归因信号。", insight.count)
                }
            },
        }
    }

    fn playbook_line(self, item: &PlaybookItem) -> String {
        match self.locale {
            ReportLocale::En => format!("- {}: {}", item.title, item.detail),
            ReportLocale::ZhCn => match item.kind {
                PlaybookKind::ReusePattern => {
                    let source = item.source.map(|source| source.as_str()).unwrap_or("AI");
                    let task = item
                        .task_type
                        .map(|task_type| self.task_type(task_type))
                        .unwrap_or_else(|| self.task_type(TaskType::Unknown));
                    format!(
                        "- 复用 {} 处理 {}: 这个本地模式在当前复盘窗口中产出稳定。",
                        source, task
                    )
                }
                PlaybookKind::ClearReviewBacklog => "- 先清理 review backlog 再启动更多 agents: 多个已完成 session 仍在等待 review 或 repair。".to_string(),
                PlaybookKind::AbsorbBeforeMoreAgents => "- 扩大并行前先吸收或暂存交付输出: 当前有本地代码改动尚未完全进入 review 闭环。".to_string(),
                PlaybookKind::KeepParallelLimitSwitches => "- 保持并行，但限制短时切换: 并行工作已经可见；增加更多并发 session 前先检查短时切换。".to_string(),
                PlaybookKind::AddTestLoop => "- 给改动文件的 session 绑定本地测试闭环: 部分代码改动 session 还没有记录测试命令。".to_string(),
            },
        }
    }

    fn delivery_session_line(self, session: &SessionRecord) -> String {
        let pr = session
            .delivery
            .integration
            .pull_request
            .as_ref()
            .and_then(|pull_request| pull_request.url.clone())
            .unwrap_or_else(|| self.no_pr().to_string());
        let issues = if session.delivery.integration.issues.is_empty() {
            self.no_issue().to_string()
        } else {
            session
                .delivery
                .integration
                .issues
                .iter()
                .map(|issue| issue.key.clone())
                .collect::<Vec<_>>()
                .join(", ")
        };
        match self.locale {
            ReportLocale::En => format!(
                "- {} / {}: absorbed={}, commit={}, dirty={}, tests={}, pr={}, issues={}",
                session.project_name,
                session.source.as_str(),
                session.delivery.absorbed,
                session.delivery.committed_after_session,
                session.delivery.dirty_after_session,
                session.delivery.test_commands.len(),
                pr,
                issues
            ),
            ReportLocale::ZhCn => format!(
                "- {} / {}: absorbed={}，commit={}，dirty={}，tests={}，pr={}，issues={}",
                session.project_name,
                session.source.as_str(),
                session.delivery.absorbed,
                session.delivery.committed_after_session,
                session.delivery.dirty_after_session,
                session.delivery.test_commands.len(),
                pr,
                issues
            ),
        }
    }
}

fn value_session_line(session: &SessionRecord) -> String {
    ReportLocale::En.text().value_session_line(session)
}

fn total_human_seconds(sessions: &[SessionRecord]) -> i64 {
    sessions
        .iter()
        .map(|session| session.prompting_seconds + session.review_seconds + session.repair_seconds)
        .sum()
}

fn total_metric_time(estimated: i64, manual: i64) -> i64 {
    estimated + manual
}

fn percent(value: f64) -> String {
    format!("{}%", (value * 100.0).round() as i64)
}

pub fn markdown_for(date: &str, locale: Option<&str>) -> anyhow::Result<String> {
    let ledger = build_day_ledger(date)?;
    let text = ReportLocale::parse(locale).text();
    let useful = ledger
        .sessions
        .iter()
        .filter(|session| {
            matches!(
                session.status,
                SessionStatus::Useful | SessionStatus::Repaired
            )
        })
        .collect::<Vec<_>>();
    let follow_up = ledger
        .sessions
        .iter()
        .filter(|session| {
            matches!(
                session.status,
                SessionStatus::Unknown | SessionStatus::NeedsReview | SessionStatus::NeedsRepair
            )
        })
        .collect::<Vec<_>>();
    let failed = ledger
        .sessions
        .iter()
        .filter(|session| {
            matches!(
                session.status,
                SessionStatus::Failed | SessionStatus::Discarded
            )
        })
        .collect::<Vec<_>>();

    let mut lines = vec![
        text.daily_title(&ledger.metrics.date),
        String::new(),
        text.section("Summary", "摘要"),
        String::new(),
        text.metric("Projects", "项目", ledger.metrics.project_count),
        text.metric("Sessions", "会话", ledger.metrics.session_count),
        text.metric(
            "AI waiting",
            "AI waiting",
            human_time(total_metric_time(
                ledger.metrics.ai_waiting_seconds_estimated,
                ledger.metrics.ai_waiting_seconds_manual,
            )),
        ),
        text.metric(
            "Prompting",
            "Prompting",
            human_time(total_metric_time(
                ledger.metrics.prompting_seconds_estimated,
                ledger.metrics.prompting_seconds_manual,
            )),
        ),
        text.metric(
            "Review",
            "Review",
            human_time(total_metric_time(
                ledger.metrics.review_seconds_estimated,
                ledger.metrics.review_seconds_manual,
            )),
        ),
        text.metric(
            "Repair",
            "Repair",
            human_time(total_metric_time(
                ledger.metrics.repair_seconds_estimated,
                ledger.metrics.repair_seconds_manual,
            )),
        ),
        text.metric("Tool calls", "工具调用", ledger.metrics.tool_call_count),
        text.metric("Tokens", "Tokens", ledger.metrics.token_count),
        text.metric(
            "Cost",
            "成本",
            format!("${:.4}", ledger.metrics.cost_amount),
        ),
        text.value_mix(
            ledger.metrics.high_value_count,
            ledger.metrics.low_value_count,
            ledger.metrics.needs_repair_value_count,
            ledger.metrics.discarded_value_count,
        ),
        text.metric(
            "Parallel project time",
            "并行项目时间",
            human_time(ledger.metrics.parallel_seconds),
        ),
        text.metric(
            "Parallel project ratio estimated",
            "并行项目比例估算",
            percent(ledger.parallel_review.parallel_project_ratio),
        ),
        text.metric(
            "AI waiting / human review overlap estimated",
            "AI waiting / 人工 review 重叠估算",
            human_time(ledger.parallel_review.ai_waiting_human_overlap_seconds),
        ),
        text.review_backlog(
            ledger.parallel_review.review_backlog_session_count,
            ledger.parallel_review.review_backlog_seconds,
        ),
        text.delivery_absorbed(
            ledger.delivery_review.absorbed_sessions,
            ledger.metrics.session_count,
        ),
        text.delivery_commits_dirty(
            ledger.delivery_review.sessions_with_commits,
            ledger.delivery_review.sessions_with_dirty_changes,
        ),
        text.pr_ci_issue(
            ledger.delivery_review.sessions_with_pr,
            ledger.delivery_review.sessions_with_ci_signal,
            ledger.delivery_review.sessions_with_issues,
        ),
        text.context_switches(
            ledger.parallel_review.context_switch_count,
            ledger.parallel_review.short_context_switch_count,
        ),
        String::new(),
        text.section("Useful Sessions", "有价值的 Sessions"),
        String::new(),
    ];

    if useful.is_empty() {
        lines.push(
            text.pick("- None marked yet.", "- 还没有标记。")
                .to_string(),
        );
    } else {
        lines.extend(
            useful
                .iter()
                .map(|session| text.value_session_line(session)),
        );
    }

    lines.extend([
        String::new(),
        text.section("Needs Follow-up", "待跟进"),
        String::new(),
    ]);
    if follow_up.is_empty() {
        lines.push(text.pick("- Nothing open.", "- 没有待处理项。").to_string());
    } else {
        lines.extend(follow_up.iter().map(|session| text.session_line(session)));
    }

    lines.extend([
        String::new(),
        text.section("Failed / Discarded", "失败 / 已丢弃"),
        String::new(),
    ]);
    if failed.is_empty() {
        lines.push(text.pick("- None.", "- 无。").to_string());
    } else {
        lines.extend(failed.iter().map(|session| text.session_line(session)));
    }

    lines.extend([
        String::new(),
        text.section("Parallel Review", "并行复盘"),
        String::new(),
    ]);
    if ledger.overlaps.is_empty() {
        lines.push(
            text.pick(
                "- No cross-project overlap detected.",
                "- 未检测到跨项目 overlap。",
            )
            .to_string(),
        );
    } else {
        lines.extend(ledger.overlaps.iter().map(|overlap| {
            format!(
                "- {} - {}: {} ({})",
                overlap.started_at,
                overlap.ended_at,
                overlap.project_names.join(", "),
                human_time(overlap.seconds)
            )
        }));
    }
    if ledger.parallel_review.insights.is_empty() {
        lines.push(
            text.pick(
                "- No parallel workflow issues detected beyond current estimates.",
                "- 当前估算未发现额外并行 workflow 问题。",
            )
            .to_string(),
        );
    } else {
        lines.extend(
            ledger
                .parallel_review
                .insights
                .iter()
                .map(|insight| text.parallel_insight_line(insight)),
        );
    }

    lines.extend([
        String::new(),
        text.section("Delivery Review", "交付复盘"),
        String::new(),
        text.metric(
            "File-changing sessions",
            "改动文件的 sessions",
            ledger.delivery_review.sessions_with_file_changes,
        ),
        text.metric(
            "Absorbed sessions",
            "已吸收 sessions",
            ledger.delivery_review.absorbed_sessions,
        ),
        text.metric(
            "Commit signals",
            "Commit 信号",
            text.session_count(ledger.delivery_review.sessions_with_commits),
        ),
        text.metric(
            "Dirty after session",
            "Session 后仍 dirty",
            text.session_count(ledger.delivery_review.sessions_with_dirty_changes),
        ),
        text.metric(
            "Local test commands",
            "本地测试命令",
            text.session_count(ledger.delivery_review.sessions_with_tests),
        ),
        text.delivery_integrations(
            ledger.delivery_review.sessions_with_pr,
            ledger.delivery_review.sessions_with_issues,
            ledger.delivery_review.sessions_with_ci_signal,
            ledger.delivery_review.merged_sessions,
        ),
    ]);
    if ledger.delivery_review.insights.is_empty() {
        lines.push(
            text.pick(
                "- No delivery absorption issues detected from local signals.",
                "- 本地信号未检测到交付吸收问题。",
            )
            .to_string(),
        );
    } else {
        lines.extend(
            ledger
                .delivery_review
                .insights
                .iter()
                .map(|insight| text.delivery_insight_line(insight)),
        );
    }
    lines.extend(
        ledger
            .sessions
            .iter()
            .take(8)
            .map(|session| text.delivery_session_line(session)),
    );

    lines.extend([
        String::new(),
        text.section("AI Dev Operating Review", "AI 开发运营复盘"),
        String::new(),
        text.success_rate(
            ledger.operating_review.success_rate,
            ledger.operating_review.successful_sessions,
            ledger.operating_review.total_sessions,
        ),
        text.cross_tool_sources(
            ledger.operating_review.cross_tool_source_count,
            ledger.operating_review.cross_project_count,
        ),
    ]);
    if ledger.operating_review.task_types.is_empty() {
        lines.push(
            text.pick("- No task type signals yet.", "- 暂无任务类型信号。")
                .to_string(),
        );
    } else {
        lines.extend(ledger.operating_review.task_types.iter().map(|task| {
            text.task_type_summary(
                task.task_type,
                task.session_count,
                task.successful_sessions,
                task.average_value_score,
            )
        }));
    }
    if ledger.operating_review.playbook.is_empty() {
        lines.push(
            text.pick(
                "- No delegation playbook items yet.",
                "- 暂无 delegation playbook 项。",
            )
            .to_string(),
        );
    } else {
        lines.extend(
            ledger
                .operating_review
                .playbook
                .iter()
                .map(|item| text.playbook_line(item)),
        );
    }

    lines.extend([
        String::new(),
        text.section("Tomorrow Carry-over", "明日延续"),
        String::new(),
    ]);
    if follow_up.is_empty() {
        lines.push(
            text.pick("- No carry-over sessions.", "- 没有延续到明日的 sessions。")
                .to_string(),
        );
    } else {
        lines.extend(follow_up.iter().map(|session| {
            format!(
                "- {}: {} - {}",
                session.project_name,
                text.status(session.status),
                session.summary
            )
        }));
    }
    lines.push(String::new());

    Ok(lines.join("\n"))
}

pub fn weekly_markdown_for(date: &str, locale: Option<&str>) -> anyhow::Result<String> {
    db::init()?;
    let text = ReportLocale::parse(locale).text();
    let (week_start, week_end, start_iso, end_iso) = week_range(date)?;
    let mut sessions = db::sessions_between(&start_iso, &end_iso)?;
    sessions.sort_by(|left, right| left.started_at.cmp(&right.started_at));
    let (project_overlaps, parallel_seconds, max_project_sessions, max_projects) =
        compute_overlaps(&sessions, &start_iso, &end_iso, OverlapKind::Projects)?;
    let (session_overlaps, _, max_session_sessions, _) =
        compute_overlaps(&sessions, &start_iso, &end_iso, OverlapKind::Sessions)?;
    let parallel_review = build_parallel_review_summary(
        &sessions,
        &start_iso,
        &end_iso,
        &project_overlaps,
        &session_overlaps,
        max_project_sessions.max(max_session_sessions),
        max_projects,
    )?;
    let delivery_review = build_delivery_review_summary(&sessions);
    let operating_review =
        build_operating_review_summary(&sessions, &parallel_review, &delivery_review);

    let project_count = sessions
        .iter()
        .map(|session| session.project_path.clone())
        .collect::<BTreeSet<_>>()
        .len();
    let prompting_seconds: i64 = sessions
        .iter()
        .map(|session| session.prompting_seconds)
        .sum();
    let waiting_seconds: i64 = sessions.iter().map(|session| session.waiting_seconds).sum();
    let review_seconds: i64 = sessions.iter().map(|session| session.review_seconds).sum();
    let repair_seconds: i64 = sessions.iter().map(|session| session.repair_seconds).sum();
    let token_count: i64 = sessions
        .iter()
        .map(|session| session.token_count.unwrap_or_default())
        .sum();
    let tool_call_count: i64 = sessions.iter().map(|session| session.tool_call_count).sum();
    let cost_amount: f64 = sessions
        .iter()
        .map(|session| session.cost_amount.unwrap_or_default())
        .sum();

    let mut top_value = sessions.clone();
    top_value.sort_by(|left, right| {
        right
            .value
            .score
            .cmp(&left.value.score)
            .then_with(|| right.tool_call_count.cmp(&left.tool_call_count))
    });
    let top_value = top_value
        .into_iter()
        .filter(|session| {
            matches!(
                session.value.category,
                SessionValueCategory::HighValue | SessionValueCategory::MixedValue
            )
        })
        .take(8)
        .collect::<Vec<_>>();

    let mut waste = sessions.clone();
    waste.sort_by(|left, right| {
        let left_effort = left.review_seconds + left.repair_seconds + left.prompting_seconds;
        let right_effort = right.review_seconds + right.repair_seconds + right.prompting_seconds;
        right
            .value
            .category
            .as_str()
            .cmp(left.value.category.as_str())
            .then_with(|| left.value.score.cmp(&right.value.score))
            .then_with(|| right_effort.cmp(&left_effort))
    });
    let waste = waste
        .into_iter()
        .filter(|session| {
            matches!(
                session.value.category,
                SessionValueCategory::LowValue
                    | SessionValueCategory::NeedsHumanRepair
                    | SessionValueCategory::Discarded
            ) || session.review_seconds + session.repair_seconds > session.waiting_seconds
        })
        .take(8)
        .collect::<Vec<_>>();

    let human_seconds = total_human_seconds(&sessions);
    let workflow_note = if sessions.is_empty() {
        text.pick(
            "No local sessions found in this week.",
            "本周没有找到本地 sessions。",
        )
        .to_string()
    } else if review_seconds + repair_seconds > waiting_seconds {
        text.pick(
            "Review and repair time exceeded AI waiting time; the workflow is likely bottlenecked after sessions finish.",
            "Review 和 repair 时间超过 AI waiting 时间；workflow 很可能在 session 完成后形成瓶颈。",
        )
        .to_string()
    } else if repair_seconds > 0 {
        text.pick(
            "Repair exists but is not dominating the week yet; inspect needs repair sessions first.",
            "本周存在 repair，但尚未主导整体时间；先检查 needs repair sessions。",
        )
        .to_string()
    } else {
        text.pick(
            "Review and repair did not dominate this week based on current estimates.",
            "按当前估算，review 和 repair 本周没有主导整体时间。",
        )
        .to_string()
    };

    let mut lines = vec![
        text.weekly_title(&week_start, &week_end),
        String::new(),
        text.section("Summary", "摘要"),
        String::new(),
        text.metric("Projects", "项目", project_count),
        text.metric("Sessions", "会话", sessions.len()),
        text.metric("Prompting", "Prompting", human_time(prompting_seconds)),
        text.metric("AI waiting", "AI waiting", human_time(waiting_seconds)),
        text.metric("Review", "Review", human_time(review_seconds)),
        text.metric("Repair", "Repair", human_time(repair_seconds)),
        text.metric("Human time", "人工时间", human_time(human_seconds)),
        text.metric(
            "Parallel project time",
            "并行项目时间",
            human_time(parallel_seconds),
        ),
        text.metric("Tool calls", "工具调用", tool_call_count),
        text.metric("Tokens", "Tokens", token_count),
        text.metric("Cost", "成本", format!("${cost_amount:.4}")),
        text.delivery_absorbed(delivery_review.absorbed_sessions, sessions.len()),
        text.pr_ci_issue(
            delivery_review.sessions_with_pr,
            delivery_review.sessions_with_ci_signal,
            delivery_review.sessions_with_issues,
        ),
        String::new(),
        text.section("Most Valuable Sessions", "最有价值的 Sessions"),
        String::new(),
    ];

    if top_value.is_empty() {
        lines.push(
            text.pick(
                "- No high-value sessions marked yet.",
                "- 还没有标记高价值 sessions。",
            )
            .to_string(),
        );
    } else {
        lines.extend(
            top_value
                .iter()
                .map(|session| text.value_session_line(session)),
        );
    }

    lines.extend([
        String::new(),
        text.section("Most Wasteful Sessions", "最浪费的 Sessions"),
        String::new(),
    ]);
    if waste.is_empty() {
        lines.push(
            text.pick(
                "- No obvious waste sessions based on current marks.",
                "- 按当前标记没有明显浪费的 sessions。",
            )
            .to_string(),
        );
    } else {
        lines.extend(waste.iter().map(|session| text.value_session_line(session)));
    }

    lines.extend([
        String::new(),
        text.section("Workflow Notes", "Workflow 备注"),
        String::new(),
        format!("- {workflow_note}"),
    ]);
    lines.extend([
        String::new(),
        text.section("Parallel Review", "并行复盘"),
        String::new(),
        text.metric(
            "Parallel project ratio estimated",
            "并行项目比例估算",
            percent(parallel_review.parallel_project_ratio),
        ),
        text.metric(
            "AI waiting / human review overlap estimated",
            "AI waiting / 人工 review 重叠估算",
            human_time(parallel_review.ai_waiting_human_overlap_seconds),
        ),
        text.review_backlog(
            parallel_review.review_backlog_session_count,
            parallel_review.review_backlog_seconds,
        ),
        text.context_switches(
            parallel_review.context_switch_count,
            parallel_review.short_context_switch_count,
        ),
    ]);
    if parallel_review.insights.is_empty() {
        lines.push(
            text.pick(
                "- No parallel workflow issues detected beyond current estimates.",
                "- 当前估算未发现额外并行 workflow 问题。",
            )
            .to_string(),
        );
    } else {
        lines.extend(
            parallel_review
                .insights
                .iter()
                .map(|insight| text.parallel_insight_line(insight)),
        );
    }

    lines.extend([
        String::new(),
        text.section("Delivery Review", "交付复盘"),
        String::new(),
        text.metric(
            "File-changing sessions",
            "改动文件的 sessions",
            delivery_review.sessions_with_file_changes,
        ),
        text.metric(
            "Absorbed sessions",
            "已吸收 sessions",
            delivery_review.absorbed_sessions,
        ),
        text.metric(
            "Commit signals",
            "Commit 信号",
            text.session_count(delivery_review.sessions_with_commits),
        ),
        text.metric(
            "Dirty after session",
            "Session 后仍 dirty",
            text.session_count(delivery_review.sessions_with_dirty_changes),
        ),
        text.delivery_integrations(
            delivery_review.sessions_with_pr,
            delivery_review.sessions_with_issues,
            delivery_review.sessions_with_ci_signal,
            delivery_review.merged_sessions,
        ),
    ]);
    if delivery_review.insights.is_empty() {
        lines.push(
            text.pick(
                "- No delivery absorption issues detected from local signals.",
                "- 本地信号未检测到交付吸收问题。",
            )
            .to_string(),
        );
    } else {
        lines.extend(
            delivery_review
                .insights
                .iter()
                .map(|insight| text.delivery_insight_line(insight)),
        );
    }
    lines.extend(
        sessions
            .iter()
            .take(10)
            .map(|session| text.delivery_session_line(session)),
    );

    lines.extend([
        String::new(),
        text.section("AI Dev Operating Review", "AI 开发运营复盘"),
        String::new(),
        text.success_rate(
            operating_review.success_rate,
            operating_review.successful_sessions,
            operating_review.total_sessions,
        ),
        text.cross_tool_sources(
            operating_review.cross_tool_source_count,
            operating_review.cross_project_count,
        ),
    ]);
    if operating_review.tool_performance.is_empty() {
        lines.push(
            text.pick("- No tool performance signals yet.", "- 暂无工具表现信号。")
                .to_string(),
        );
    } else {
        lines.extend(
            operating_review
                .tool_performance
                .iter()
                .map(|tool| match text.locale {
                    ReportLocale::En => format!(
                        "- {}: {} session(s), {} successful, avg score {:.0}, top task {}",
                        tool.source.as_str(),
                        tool.session_count,
                        tool.successful_sessions,
                        tool.average_value_score,
                        tool.top_task_type
                            .map(|task_type| text.task_type(task_type))
                            .unwrap_or_else(|| text.task_type(TaskType::Unknown))
                    ),
                    ReportLocale::ZhCn => format!(
                        "- {}: {} 个 session，{} 个成功，平均评分 {:.0}，主要任务 {}",
                        tool.source.as_str(),
                        tool.session_count,
                        tool.successful_sessions,
                        tool.average_value_score,
                        tool.top_task_type
                            .map(|task_type| text.task_type(task_type))
                            .unwrap_or_else(|| text.task_type(TaskType::Unknown))
                    ),
                }),
        );
    }
    if operating_review.task_types.is_empty() {
        lines.push(
            text.pick("- No task type signals yet.", "- 暂无任务类型信号。")
                .to_string(),
        );
    } else {
        lines.extend(operating_review.task_types.iter().map(|task| {
            text.task_type_summary(
                task.task_type,
                task.session_count,
                task.successful_sessions,
                task.average_value_score,
            )
        }));
    }
    if operating_review.playbook.is_empty() {
        lines.push(
            text.pick(
                "- No delegation playbook items yet.",
                "- 暂无 delegation playbook 项。",
            )
            .to_string(),
        );
    } else {
        lines.extend(
            operating_review
                .playbook
                .iter()
                .map(|item| text.playbook_line(item)),
        );
    }
    lines.push(String::new());

    Ok(lines.join("\n"))
}

pub fn build_report(date: &str, locale: Option<&str>) -> anyhow::Result<ReportResult> {
    Ok(ReportResult {
        markdown: markdown_for(date, locale)?,
        exported_path: None,
    })
}

pub fn build_weekly_report(date: &str, locale: Option<&str>) -> anyhow::Result<ReportResult> {
    Ok(ReportResult {
        markdown: weekly_markdown_for(date, locale)?,
        exported_path: None,
    })
}

pub fn export_report(date: &str, markdown: &str) -> anyhow::Result<ReportResult> {
    let dir = db::exports_dir()?;
    fs::create_dir_all(&dir)?;
    let path: PathBuf = dir.join(format!("sessionary-report-{date}.md"));
    fs::write(&path, markdown)?;
    Ok(ReportResult {
        markdown: markdown.to_string(),
        exported_path: Some(path.display().to_string()),
    })
}

pub fn export_weekly_report(date: &str, markdown: &str) -> anyhow::Result<ReportResult> {
    let dir = db::exports_dir()?;
    fs::create_dir_all(&dir)?;
    let (week_start, _, _, _) = week_range(date)?;
    let path: PathBuf = dir.join(format!("sessionary-weekly-report-{week_start}.md"));
    fs::write(&path, markdown)?;
    Ok(ReportResult {
        markdown: markdown.to_string(),
        exported_path: Some(path.display().to_string()),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::{SessionSource, SessionStatus, SessionValue, TimeFields};

    fn session(status: SessionStatus, cost: Option<f64>, repair_seconds: i64) -> SessionRecord {
        let mut record = SessionRecord {
            id: "session".to_string(),
            source: SessionSource::Codex,
            source_session_id: "session".to_string(),
            project_name: "sessionary".to_string(),
            project_path: "/tmp/sessionary".to_string(),
            cwd: "/tmp/sessionary".to_string(),
            started_at: "2026-05-20T01:00:00.000Z".to_string(),
            ended_at: Some("2026-05-20T01:30:00.000Z".to_string()),
            duration_seconds: 1800,
            user_message_count: 2,
            assistant_message_count: 3,
            tool_call_count: 12,
            token_count: Some(24000),
            cost_amount: cost,
            status,
            status_updated_at: None,
            note: String::new(),
            confidence: 1.0,
            changed_files: vec!["src/App.tsx".to_string()],
            prompting_seconds: 300,
            waiting_seconds: 900,
            review_seconds: 120,
            repair_seconds,
            review_started_at: None,
            repair_started_at: None,
            review_intervals: Vec::new(),
            repair_intervals: Vec::new(),
            time_fields: TimeFields::default(),
            value: SessionValue::default(),
            summary: "Implemented a useful change".to_string(),
            source_file: String::new(),
            git_branch: None,
            git_dirty: false,
            delivery: Default::default(),
        };
        record.value = SessionValue::for_session(&record);
        record
    }

    #[test]
    fn value_line_includes_score_and_cost() {
        let line = value_session_line(&session(SessionStatus::Useful, Some(0.42), 0));

        assert!(line.contains("score:"));
        assert!(line.contains("$0.4200"));
    }

    #[test]
    fn report_locale_translates_daily_markdown_text() {
        let text = ReportLocale::parse(Some("zh-CN")).text();
        let record = session(SessionStatus::Useful, Some(0.42), 0);
        let line = text.value_session_line(&record);

        assert_eq!(
            text.daily_title("2026-05-24"),
            "# Sessionary 日报 - 2026-05-24"
        );
        assert_eq!(text.section("Summary", "摘要"), "## 摘要");
        assert!(text.review_backlog(2, 1800).contains("Review backlog 估算"));
        assert!(line.contains("Implemented a useful change"));
        assert!(line.contains("价值: 高价值"));
    }

    #[test]
    fn report_locale_translates_weekly_markdown_text() {
        let text = ReportLocale::parse(Some("zh-CN")).text();

        assert_eq!(
            text.weekly_title("2026-05-18", "2026-05-24"),
            "# Sessionary 周报 - 2026-05-18 至 2026-05-24"
        );
        assert_eq!(
            text.section("Most Valuable Sessions", "最有价值的 Sessions"),
            "## 最有价值的 Sessions"
        );
        assert!(text.success_rate(0.75, 3, 4).contains("成功率估算: 75%"));
    }

    #[test]
    fn unknown_report_locale_falls_back_to_english() {
        let text = ReportLocale::parse(Some("fr")).text();

        assert_eq!(
            text.daily_title("2026-05-24"),
            "# Sessionary Daily Report - 2026-05-24"
        );
    }

    #[test]
    fn classifies_repair_session_as_needing_human_repair() {
        let record = session(SessionStatus::NeedsRepair, Some(2.5), 900);

        assert_eq!(
            record.value.category,
            SessionValueCategory::NeedsHumanRepair
        );
    }
}
