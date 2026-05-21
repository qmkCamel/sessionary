use std::fs;
use std::path::PathBuf;
use std::collections::BTreeSet;

use crate::analytics::build_day_ledger;
use crate::db;
use crate::models::{ReportResult, SessionRecord, SessionStatus, SessionValueCategory};
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
        "## Parallel Development Notes".to_string(),
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

    let project_count = sessions
        .iter()
        .map(|session| session.project_path.clone())
        .collect::<BTreeSet<_>>()
        .len();
    let prompting_seconds: i64 = sessions.iter().map(|session| session.prompting_seconds).sum();
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
        "Repair exists but is not dominating the week yet; inspect needs repair sessions first.".to_string()
    } else {
        "Review and repair did not dominate this week based on current estimates.".to_string()
    };

    let mut lines = vec![
        format!("# Sessionary Weekly Report - {} to {}", week_start, week_end),
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
        format!("- Tool calls: {tool_call_count}"),
        format!("- Tokens: {token_count}"),
        format!("- Cost: ${cost_amount:.4}"),
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
        String::new(),
    ]);

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
    use crate::models::{
        SessionSource, SessionStatus, SessionValue, TimeFields,
    };

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
