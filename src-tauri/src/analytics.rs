use chrono::{DateTime, Utc};
use std::collections::{BTreeMap, BTreeSet, HashMap};

use crate::db;
use crate::ingest;
use crate::models::{
    DayLedger, DayMetrics, OverlapInterval, ProjectSummary, SessionRecord, SessionSource,
    SessionStatus, SessionValueCategory,
};
use crate::util::{day_range, parse_utc};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum OverlapKind {
    Sessions,
    Projects,
}

#[derive(Debug, Clone)]
struct Event {
    time: DateTime<Utc>,
    is_start: bool,
    session: SessionRecord,
}

fn clip_time(value: &str, min: DateTime<Utc>, max: DateTime<Utc>) -> anyhow::Result<DateTime<Utc>> {
    Ok(parse_utc(value)?.max(min).min(max))
}

fn merge_intervals(intervals: Vec<OverlapInterval>) -> Vec<OverlapInterval> {
    let mut merged: Vec<OverlapInterval> = Vec::new();
    for interval in intervals {
        if let Some(last) = merged.last_mut() {
            if last.ended_at == interval.started_at
                && last.session_ids == interval.session_ids
                && last.project_names == interval.project_names
            {
                last.ended_at = interval.ended_at;
                last.seconds += interval.seconds;
                continue;
            }
        }
        merged.push(interval);
    }
    merged
}

pub fn compute_overlaps(
    sessions: &[SessionRecord],
    day_start: &str,
    day_end: &str,
    kind: OverlapKind,
) -> anyhow::Result<(Vec<OverlapInterval>, i64, usize, usize)> {
    let day_start_dt = parse_utc(day_start)?;
    let day_end_dt = parse_utc(day_end)?;
    let mut events = Vec::new();

    for session in sessions {
        let Some(ended_at) = &session.ended_at else {
            continue;
        };
        let started = clip_time(&session.started_at, day_start_dt, day_end_dt)?;
        let ended = clip_time(ended_at, day_start_dt, day_end_dt)?;
        if ended <= started {
            continue;
        }
        events.push(Event {
            time: started,
            is_start: true,
            session: session.clone(),
        });
        events.push(Event {
            time: ended,
            is_start: false,
            session: session.clone(),
        });
    }

    events.sort_by(|a, b| {
        a.time
            .cmp(&b.time)
            .then_with(|| a.is_start.cmp(&b.is_start))
    });

    let mut active: HashMap<String, SessionRecord> = HashMap::new();
    let mut previous: Option<DateTime<Utc>> = None;
    let mut intervals = Vec::new();
    let mut max_sessions = 0_usize;
    let mut max_projects = 0_usize;

    for event in events {
        if let Some(previous_time) = previous {
            if event.time > previous_time {
                let active_sessions = active.values().cloned().collect::<Vec<_>>();
                let project_names = active_sessions
                    .iter()
                    .map(|session| session.project_name.clone())
                    .collect::<BTreeSet<_>>()
                    .into_iter()
                    .collect::<Vec<_>>();
                let is_parallel = match kind {
                    OverlapKind::Sessions => active_sessions.len() > 1,
                    OverlapKind::Projects => project_names.len() > 1,
                };
                if is_parallel {
                    let mut session_ids = active_sessions
                        .iter()
                        .map(|session| session.id.clone())
                        .collect::<Vec<_>>();
                    session_ids.sort();
                    intervals.push(OverlapInterval {
                        started_at: previous_time
                            .to_rfc3339_opts(chrono::SecondsFormat::Millis, true),
                        ended_at: event
                            .time
                            .to_rfc3339_opts(chrono::SecondsFormat::Millis, true),
                        seconds: (event.time - previous_time).num_seconds(),
                        session_ids,
                        project_names,
                    });
                }
            }
        }

        if event.is_start {
            active.insert(event.session.id.clone(), event.session);
        } else {
            active.remove(&event.session.id);
        }
        max_sessions = max_sessions.max(active.len());
        max_projects = max_projects.max(
            active
                .values()
                .map(|session| session.project_name.clone())
                .collect::<BTreeSet<_>>()
                .len(),
        );
        previous = Some(event.time);
    }

    let merged = merge_intervals(intervals);
    let seconds = merged.iter().map(|interval| interval.seconds).sum();
    Ok((merged, seconds, max_sessions, max_projects))
}

fn build_projects(sessions: &[SessionRecord], overlaps: &[OverlapInterval]) -> Vec<ProjectSummary> {
    let mut by_path: BTreeMap<String, Vec<&SessionRecord>> = BTreeMap::new();
    for session in sessions {
        by_path
            .entry(session.project_path.clone())
            .or_default()
            .push(session);
    }

    by_path
        .into_iter()
        .map(|(path, mut project_sessions)| {
            project_sessions.sort_by(|a, b| a.started_at.cmp(&b.started_at));
            let first = project_sessions[0];
            let mut sources = project_sessions
                .iter()
                .map(|session| session.source)
                .collect::<Vec<SessionSource>>();
            sources.sort_by_key(|source| source.as_str());
            sources.dedup();
            let ended_at = project_sessions
                .iter()
                .filter_map(|session| session.ended_at.clone())
                .max();
            let project_name = first.project_name.clone();
            ProjectSummary {
                name: project_name.clone(),
                path,
                session_count: project_sessions.len(),
                started_at: first.started_at.clone(),
                ended_at,
                active_seconds: project_sessions
                    .iter()
                    .map(|session| session.duration_seconds)
                    .sum(),
                sources,
                is_parallel: overlaps
                    .iter()
                    .any(|overlap| overlap.project_names.contains(&project_name)),
                git_branch: project_sessions
                    .iter()
                    .find_map(|session| session.git_branch.clone()),
                git_dirty: project_sessions.iter().any(|session| session.git_dirty),
            }
        })
        .collect()
}

pub fn build_day_ledger(date: &str) -> anyhow::Result<DayLedger> {
    db::init()?;
    let (start, end) = day_range(date)?;
    let sessions = db::sessions_between(&start, &end)?;
    let (project_overlaps, parallel_seconds, max_project_sessions, max_projects) =
        compute_overlaps(&sessions, &start, &end, OverlapKind::Projects)?;
    let (session_overlaps, _, max_session_sessions, _) =
        compute_overlaps(&sessions, &start, &end, OverlapKind::Sessions)?;
    let projects = build_projects(&sessions, &project_overlaps);
    let source_status = ingest::source_status()?;

    Ok(DayLedger {
        metrics: DayMetrics {
            date: date.to_string(),
            project_count: projects.len(),
            session_count: sessions.len(),
            ai_waiting_seconds_estimated: sessions
                .iter()
                .map(|session| session.waiting_seconds)
                .sum(),
            prompting_seconds_estimated: sessions
                .iter()
                .map(|session| session.prompting_seconds)
                .sum(),
            review_seconds_estimated: sessions.iter().map(|session| session.review_seconds).sum(),
            repair_seconds_estimated: sessions.iter().map(|session| session.repair_seconds).sum(),
            tool_call_count: sessions.iter().map(|session| session.tool_call_count).sum(),
            token_count: sessions
                .iter()
                .map(|session| session.token_count.unwrap_or_default())
                .sum(),
            cost_amount: sessions
                .iter()
                .map(|session| session.cost_amount.unwrap_or_default())
                .sum(),
            high_value_count: sessions
                .iter()
                .filter(|session| session.value.category == SessionValueCategory::HighValue)
                .count(),
            low_value_count: sessions
                .iter()
                .filter(|session| session.value.category == SessionValueCategory::LowValue)
                .count(),
            needs_repair_value_count: sessions
                .iter()
                .filter(|session| {
                    session.value.category == SessionValueCategory::NeedsHumanRepair
                })
                .count(),
            discarded_value_count: sessions
                .iter()
                .filter(|session| session.value.category == SessionValueCategory::Discarded)
                .count(),
            parallel_seconds,
            max_concurrent_sessions: max_project_sessions.max(max_session_sessions),
            max_concurrent_projects: max_projects,
            unknown_count: sessions
                .iter()
                .filter(|session| session.status == SessionStatus::Unknown)
                .count(),
            needs_review_count: sessions
                .iter()
                .filter(|session| session.status == SessionStatus::NeedsReview)
                .count(),
            needs_repair_count: sessions
                .iter()
                .filter(|session| session.status == SessionStatus::NeedsRepair)
                .count(),
            generated_at: Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true),
        },
        projects,
        sessions,
        overlaps: project_overlaps,
        session_overlaps,
        source_status,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::{SessionSource, TimeFields};

    fn session(id: &str, project: &str, start: &str, end: &str) -> SessionRecord {
        SessionRecord {
            id: id.to_string(),
            source: SessionSource::Codex,
            source_session_id: id.to_string(),
            project_name: project.to_string(),
            project_path: format!("/tmp/{project}"),
            cwd: format!("/tmp/{project}"),
            started_at: start.to_string(),
            ended_at: Some(end.to_string()),
            duration_seconds: 600,
            user_message_count: 1,
            assistant_message_count: 1,
            tool_call_count: 0,
            token_count: None,
            cost_amount: None,
            status: SessionStatus::Unknown,
            status_updated_at: None,
            note: String::new(),
            confidence: 1.0,
            changed_files: Vec::new(),
            prompting_seconds: 60,
            waiting_seconds: 540,
            review_seconds: 60,
            repair_seconds: 0,
            review_started_at: None,
            repair_started_at: None,
            time_fields: TimeFields::default(),
            value: Default::default(),
            summary: String::new(),
            source_file: String::new(),
            git_branch: None,
            git_dirty: false,
        }
    }

    #[test]
    fn computes_cross_project_overlap() {
        let sessions = vec![
            session(
                "a",
                "alpha",
                "2026-05-19T01:00:00.000Z",
                "2026-05-19T01:20:00.000Z",
            ),
            session(
                "b",
                "beta",
                "2026-05-19T01:10:00.000Z",
                "2026-05-19T01:30:00.000Z",
            ),
        ];
        let (intervals, seconds, _, projects) = compute_overlaps(
            &sessions,
            "2026-05-19T00:00:00.000Z",
            "2026-05-20T00:00:00.000Z",
            OverlapKind::Projects,
        )
        .expect("overlap computes");
        assert_eq!(intervals.len(), 1);
        assert_eq!(seconds, 600);
        assert_eq!(projects, 2);
    }
}
