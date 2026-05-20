use std::fs;
use std::path::PathBuf;

use crate::analytics::build_day_ledger;
use crate::db;
use crate::models::{ReportResult, SessionRecord, SessionStatus};

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
        lines.extend(useful.iter().map(|session| session_line(session)));
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

pub fn build_report(date: &str) -> anyhow::Result<ReportResult> {
    Ok(ReportResult {
        markdown: markdown_for(date)?,
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
