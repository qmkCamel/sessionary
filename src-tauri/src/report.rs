use std::collections::BTreeSet;
use std::fs;
use std::path::PathBuf;

use crate::analytics::{
    build_day_ledger, build_delivery_review_summary, build_operating_review_summary,
    build_parallel_review_summary, compute_overlaps, OverlapKind,
};
use crate::db;
use crate::models::{
    DeliveryInsight, DeliveryInsightKind, PlaybookItem, ReportResult, SessionRecord, SessionStatus,
    SessionValueCategory, TaskType,
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

fn session_line(session: &SessionRecord) -> String {
    let note = if session.note.trim().is_empty() {
        String::new()
    } else {
        format!(" - {}", session.note.trim())
    };
    format!(
        "- {} / {}: {} ({}, {} user prompts, {} tools){}",
        session.project_name,
        session.source.as_str(),
        if session.summary.is_empty() {
            &session.source_session_id
        } else {
            &session.summary
        },
        human_time(session.duration_seconds),
        session.user_message_count,
        session.tool_call_count,
        note
    )
}

fn value_session_line(session: &SessionRecord) -> String {
    format!(
        "- {} / {}: {} (value: {}, score: {}, cost: {}, tokens: {}, tools: {}, files: {})",
        session.project_name,
        session.source.as_str(),
        if session.summary.is_empty() {
            &session.source_session_id
        } else {
            &session.summary
        },
        session.value.category.as_str(),
        session.value.score,
        session
            .cost_amount
            .map(|cost| format!("${cost:.4}"))
            .unwrap_or_else(|| "n/a".to_string()),
        session.token_count.unwrap_or_default(),
        session.tool_call_count,
        session.changed_files.len()
    )
}

fn total_human_seconds(sessions: &[SessionRecord]) -> i64 {
    sessions
        .iter()
        .map(|session| session.prompting_seconds + session.review_seconds + session.repair_seconds)
        .sum()
}

fn percent(value: f64) -> String {
    format!("{}%", (value * 100.0).round() as i64)
}

fn insight_line(insight: &crate::models::ParallelInsight) -> String {
    match insight.kind {
        crate::models::ParallelInsightKind::ParallelPayoff => format!(
            "- Parallel payoff: {} of AI waiting overlapped with review/repair across {} interval(s).",
            human_time(insight.seconds),
            insight.count
        ),
        crate::models::ParallelInsightKind::ReviewBottleneck => format!(
            "- Review bottleneck: {} session(s) have waited about {} for review/repair.",
            insight.count,
            human_time(insight.seconds)
        ),
        crate::models::ParallelInsightKind::ContextSwitching => format!(
            "- Context switching: {} short cross-project switch(es) detected.",
            insight.count
        ),
        crate::models::ParallelInsightKind::LowParallelism => format!(
            "- Low parallelism: {} sessions ran mostly serially.",
            insight.count
        ),
    }
}

fn delivery_insight_line(insight: &DeliveryInsight) -> String {
    match insight.kind {
        DeliveryInsightKind::UnabsorbedOutput => format!(
            "- Unabsorbed output: {} session(s) have delivery signals but are not absorbed.",
            insight.count
        ),
        DeliveryInsightKind::DirtyAfterSession => format!(
            "- Dirty after session: {} session(s) still have local dirty changes.",
            insight.count
        ),
        DeliveryInsightKind::MissingTests => format!(
            "- Missing local test loop: {} file-changing session(s) have no recorded test command.",
            insight.count
        ),
        DeliveryInsightKind::LinkedDelivery => format!(
            "- Linked delivery: {} PR / issue attribution signal(s) found locally.",
            insight.count
        ),
    }
}

fn task_type_label(task_type: TaskType) -> &'static str {
    match task_type {
        TaskType::UiFrontend => "UI/frontend",
        TaskType::Docs => "docs",
        TaskType::Tests => "tests",
        TaskType::Backend => "backend",
        TaskType::Delivery => "delivery",
        TaskType::Repair => "repair",
        TaskType::Unknown => "unknown",
    }
}

fn playbook_line(item: &PlaybookItem) -> String {
    format!("- {}: {}", item.title, item.detail)
}

fn delivery_session_line(session: &SessionRecord) -> String {
    let pr = session
        .delivery
        .integration
        .pull_request
        .as_ref()
        .and_then(|pull_request| pull_request.url.clone())
        .unwrap_or_else(|| "no PR".to_string());
    let issues = if session.delivery.integration.issues.is_empty() {
        "no issue".to_string()
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
    format!(
        "- {} / {}: absorbed={}, commit={}, dirty={}, tests={}, pr={}, issues={}",
        session.project_name,
        session.source.as_str(),
        session.delivery.absorbed,
        session.delivery.committed_after_session,
        session.delivery.dirty_after_session,
        session.delivery.test_commands.len(),
        pr,
        issues
    )
}

pub fn markdown_for(date: &str) -> anyhow::Result<String> {
    let ledger = build_day_ledger(date)?;
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
        format!("# Sessionary Daily Report - {}", ledger.metrics.date),
        String::new(),
        "## Summary".to_string(),
        String::new(),
        format!("- Projects: {}", ledger.metrics.project_count),
        format!("- Sessions: {}", ledger.metrics.session_count),
        format!(
            "- AI waiting estimated: {}",
            human_time(ledger.metrics.ai_waiting_seconds_estimated)
        ),
        format!(
            "- Prompting estimated: {}",
            human_time(ledger.metrics.prompting_seconds_estimated)
        ),
        format!(
            "- Review estimated: {}",
            human_time(ledger.metrics.review_seconds_estimated)
        ),
        format!(
            "- Repair estimated: {}",
            human_time(ledger.metrics.repair_seconds_estimated)
        ),
        format!("- Tool calls: {}", ledger.metrics.tool_call_count),
        format!("- Tokens: {}", ledger.metrics.token_count),
        format!("- Cost: ${:.4}", ledger.metrics.cost_amount),
        format!(
            "- Value mix: {} high, {} low, {} repair, {} discarded",
            ledger.metrics.high_value_count,
            ledger.metrics.low_value_count,
            ledger.metrics.needs_repair_value_count,
            ledger.metrics.discarded_value_count
        ),
        format!(
            "- Parallel project time: {}",
            human_time(ledger.metrics.parallel_seconds)
        ),
        format!(
            "- Parallel project ratio estimated: {}",
            percent(ledger.parallel_review.parallel_project_ratio)
        ),
        format!(
            "- AI waiting / human review overlap estimated: {}",
            human_time(ledger.parallel_review.ai_waiting_human_overlap_seconds)
        ),
        format!(
            "- Review backlog estimated: {} session(s), {}",
            ledger.parallel_review.review_backlog_session_count,
            human_time(ledger.parallel_review.review_backlog_seconds)
        ),
        format!(
            "- Delivery absorbed: {}/{} sessions",
            ledger.delivery_review.absorbed_sessions, ledger.metrics.session_count
        ),
        format!(
            "- Delivery commits / dirty: {} committed, {} dirty",
            ledger.delivery_review.sessions_with_commits,
            ledger.delivery_review.sessions_with_dirty_changes
        ),
        format!(
            "- PR / CI / Issue signals: {} PR, {} CI/local test, {} issue-linked",
            ledger.delivery_review.sessions_with_pr,
            ledger.delivery_review.sessions_with_ci_signal,
            ledger.delivery_review.sessions_with_issues
        ),
        format!(
            "- Context switches: {} total, {} short",
            ledger.parallel_review.context_switch_count,
            ledger.parallel_review.short_context_switch_count
        ),
        String::new(),
        "## Useful Sessions".to_string(),
        String::new(),
    ];

    if useful.is_empty() {
        lines.push("- None marked yet.".to_string());
    } else {
        lines.extend(useful.iter().map(|session| value_session_line(session)));
    }

    lines.extend([
        String::new(),
        "## Needs Follow-up".to_string(),
        String::new(),
    ]);
    if follow_up.is_empty() {
        lines.push("- Nothing open.".to_string());
    } else {
        lines.extend(follow_up.iter().map(|session| session_line(session)));
    }

    lines.extend([
        String::new(),
        "## Failed / Discarded".to_string(),
        String::new(),
    ]);
    if failed.is_empty() {
        lines.push("- None.".to_string());
    } else {
        lines.extend(failed.iter().map(|session| session_line(session)));
    }

    lines.extend([
        String::new(),
        "## Parallel Review".to_string(),
        String::new(),
    ]);
    if ledger.overlaps.is_empty() {
        lines.push("- No cross-project overlap detected.".to_string());
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
        lines.push("- No parallel workflow issues detected beyond current estimates.".to_string());
    } else {
        lines.extend(ledger.parallel_review.insights.iter().map(insight_line));
    }

    lines.extend([
        String::new(),
        "## Delivery Review".to_string(),
        String::new(),
        format!(
            "- File-changing sessions: {}",
            ledger.delivery_review.sessions_with_file_changes
        ),
        format!(
            "- Absorbed sessions: {}",
            ledger.delivery_review.absorbed_sessions
        ),
        format!(
            "- Commit signals: {} session(s)",
            ledger.delivery_review.sessions_with_commits
        ),
        format!(
            "- Dirty after session: {} session(s)",
            ledger.delivery_review.sessions_with_dirty_changes
        ),
        format!(
            "- Local test commands: {} session(s)",
            ledger.delivery_review.sessions_with_tests
        ),
        format!(
            "- Delivery Integrations: {} PR, {} issue-linked, {} CI/local test signal(s), {} merged",
            ledger.delivery_review.sessions_with_pr,
            ledger.delivery_review.sessions_with_issues,
            ledger.delivery_review.sessions_with_ci_signal,
            ledger.delivery_review.merged_sessions
        ),
    ]);
    if ledger.delivery_review.insights.is_empty() {
        lines.push("- No delivery absorption issues detected from local signals.".to_string());
    } else {
        lines.extend(
            ledger
                .delivery_review
                .insights
                .iter()
                .map(delivery_insight_line),
        );
    }
    lines.extend(ledger.sessions.iter().take(8).map(delivery_session_line));

    lines.extend([
        String::new(),
        "## AI Dev Operating Review".to_string(),
        String::new(),
        format!(
            "- Success rate estimated: {} ({}/{})",
            percent(ledger.operating_review.success_rate),
            ledger.operating_review.successful_sessions,
            ledger.operating_review.total_sessions
        ),
        format!(
            "- Cross-tool sources: {}, cross-projects: {}",
            ledger.operating_review.cross_tool_source_count,
            ledger.operating_review.cross_project_count
        ),
    ]);
    if ledger.operating_review.task_types.is_empty() {
        lines.push("- No task type signals yet.".to_string());
    } else {
        lines.extend(ledger.operating_review.task_types.iter().map(|task| {
            format!(
                "- {}: {} session(s), {} successful, avg score {:.0}",
                task_type_label(task.task_type),
                task.session_count,
                task.successful_sessions,
                task.average_value_score
            )
        }));
    }
    if ledger.operating_review.playbook.is_empty() {
        lines.push("- No delegation playbook items yet.".to_string());
    } else {
        lines.extend(ledger.operating_review.playbook.iter().map(playbook_line));
    }

    lines.extend([
        String::new(),
        "## Tomorrow Carry-over".to_string(),
        String::new(),
    ]);
    if follow_up.is_empty() {
        lines.push("- No carry-over sessions.".to_string());
    } else {
        lines.extend(follow_up.iter().map(|session| {
            format!(
                "- {}: {} - {}",
                session.project_name,
                session.status.as_str().replace('_', " "),
                session.summary
            )
        }));
    }
    lines.push(String::new());

    Ok(lines.join("\n"))
}

pub fn weekly_markdown_for(date: &str) -> anyhow::Result<String> {
    db::init()?;
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
        "No local sessions found in this week.".to_string()
    } else if review_seconds + repair_seconds > waiting_seconds {
        "Review and repair time exceeded AI waiting time; the workflow is likely bottlenecked after sessions finish.".to_string()
    } else if repair_seconds > 0 {
        "Repair exists but is not dominating the week yet; inspect needs repair sessions first."
            .to_string()
    } else {
        "Review and repair did not dominate this week based on current estimates.".to_string()
    };

    let mut lines = vec![
        format!(
            "# Sessionary Weekly Report - {} to {}",
            week_start, week_end
        ),
        String::new(),
        "## Summary".to_string(),
        String::new(),
        format!("- Projects: {project_count}"),
        format!("- Sessions: {}", sessions.len()),
        format!("- Prompting estimated: {}", human_time(prompting_seconds)),
        format!("- AI waiting estimated: {}", human_time(waiting_seconds)),
        format!("- Review estimated: {}", human_time(review_seconds)),
        format!("- Repair estimated: {}", human_time(repair_seconds)),
        format!("- Human time estimated: {}", human_time(human_seconds)),
        format!("- Parallel project time: {}", human_time(parallel_seconds)),
        format!("- Tool calls: {tool_call_count}"),
        format!("- Tokens: {token_count}"),
        format!("- Cost: ${cost_amount:.4}"),
        format!(
            "- Delivery absorbed: {}/{} sessions",
            delivery_review.absorbed_sessions,
            sessions.len()
        ),
        format!(
            "- PR / CI / Issue signals: {} PR, {} CI/local test, {} issue-linked",
            delivery_review.sessions_with_pr,
            delivery_review.sessions_with_ci_signal,
            delivery_review.sessions_with_issues
        ),
        String::new(),
        "## Most Valuable Sessions".to_string(),
        String::new(),
    ];

    if top_value.is_empty() {
        lines.push("- No high-value sessions marked yet.".to_string());
    } else {
        lines.extend(top_value.iter().map(value_session_line));
    }

    lines.extend([
        String::new(),
        "## Most Wasteful Sessions".to_string(),
        String::new(),
    ]);
    if waste.is_empty() {
        lines.push("- No obvious waste sessions based on current marks.".to_string());
    } else {
        lines.extend(waste.iter().map(value_session_line));
    }

    lines.extend([
        String::new(),
        "## Workflow Notes".to_string(),
        String::new(),
        format!("- {workflow_note}"),
    ]);
    lines.extend([
        String::new(),
        "## Parallel Review".to_string(),
        String::new(),
        format!(
            "- Parallel project ratio estimated: {}",
            percent(parallel_review.parallel_project_ratio)
        ),
        format!(
            "- AI waiting / human review overlap estimated: {}",
            human_time(parallel_review.ai_waiting_human_overlap_seconds)
        ),
        format!(
            "- Review backlog estimated: {} session(s), {}",
            parallel_review.review_backlog_session_count,
            human_time(parallel_review.review_backlog_seconds)
        ),
        format!(
            "- Context switches: {} total, {} short",
            parallel_review.context_switch_count, parallel_review.short_context_switch_count
        ),
    ]);
    if parallel_review.insights.is_empty() {
        lines.push("- No parallel workflow issues detected beyond current estimates.".to_string());
    } else {
        lines.extend(parallel_review.insights.iter().map(insight_line));
    }

    lines.extend([
        String::new(),
        "## Delivery Review".to_string(),
        String::new(),
        format!(
            "- File-changing sessions: {}",
            delivery_review.sessions_with_file_changes
        ),
        format!(
            "- Absorbed sessions: {}",
            delivery_review.absorbed_sessions
        ),
        format!(
            "- Commit signals: {} session(s)",
            delivery_review.sessions_with_commits
        ),
        format!(
            "- Dirty after session: {} session(s)",
            delivery_review.sessions_with_dirty_changes
        ),
        format!(
            "- Delivery Integrations: {} PR, {} issue-linked, {} CI/local test signal(s), {} merged",
            delivery_review.sessions_with_pr,
            delivery_review.sessions_with_issues,
            delivery_review.sessions_with_ci_signal,
            delivery_review.merged_sessions
        ),
    ]);
    if delivery_review.insights.is_empty() {
        lines.push("- No delivery absorption issues detected from local signals.".to_string());
    } else {
        lines.extend(delivery_review.insights.iter().map(delivery_insight_line));
    }
    lines.extend(sessions.iter().take(10).map(delivery_session_line));

    lines.extend([
        String::new(),
        "## AI Dev Operating Review".to_string(),
        String::new(),
        format!(
            "- Success rate estimated: {} ({}/{})",
            percent(operating_review.success_rate),
            operating_review.successful_sessions,
            operating_review.total_sessions
        ),
        format!(
            "- Cross-tool sources: {}, cross-projects: {}",
            operating_review.cross_tool_source_count, operating_review.cross_project_count
        ),
    ]);
    if operating_review.tool_performance.is_empty() {
        lines.push("- No tool performance signals yet.".to_string());
    } else {
        lines.extend(operating_review.tool_performance.iter().map(|tool| {
            format!(
                "- {}: {} session(s), {} successful, avg score {:.0}, top task {}",
                tool.source.as_str(),
                tool.session_count,
                tool.successful_sessions,
                tool.average_value_score,
                tool.top_task_type.map(task_type_label).unwrap_or("unknown")
            )
        }));
    }
    if operating_review.task_types.is_empty() {
        lines.push("- No task type signals yet.".to_string());
    } else {
        lines.extend(operating_review.task_types.iter().map(|task| {
            format!(
                "- {}: {} session(s), {} successful, avg score {:.0}",
                task_type_label(task.task_type),
                task.session_count,
                task.successful_sessions,
                task.average_value_score
            )
        }));
    }
    if operating_review.playbook.is_empty() {
        lines.push("- No delegation playbook items yet.".to_string());
    } else {
        lines.extend(operating_review.playbook.iter().map(playbook_line));
    }
    lines.push(String::new());

    Ok(lines.join("\n"))
}

pub fn build_report(date: &str) -> anyhow::Result<ReportResult> {
    Ok(ReportResult {
        markdown: markdown_for(date)?,
        exported_path: None,
    })
}

pub fn build_weekly_report(date: &str) -> anyhow::Result<ReportResult> {
    Ok(ReportResult {
        markdown: weekly_markdown_for(date)?,
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
    fn classifies_repair_session_as_needing_human_repair() {
        let record = session(SessionStatus::NeedsRepair, Some(2.5), 900);

        assert_eq!(
            record.value.category,
            SessionValueCategory::NeedsHumanRepair
        );
    }
}
