use chrono::{DateTime, Duration, Utc};
use std::collections::{BTreeMap, BTreeSet, HashMap};

use crate::db;
use crate::ingest;
use crate::models::{
    DayLedger, DayMetrics, DeliveryInsight, DeliveryInsightKind, DeliveryReviewSummary,
    InsightSeverity, MergeStatus, OperatingReviewSummary, OverlapInterval, ParallelInsight,
    ParallelInsightKind, ParallelReviewSummary, PlaybookItem, PlaybookKind, ProjectSummary,
    SessionRecord, SessionSource, SessionStatus, SessionValueCategory, TaskType, TaskTypeSummary,
    ToolPerformanceSummary,
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

#[derive(Debug, Clone)]
struct TimelineInterval {
    start: DateTime<Utc>,
    end: DateTime<Utc>,
    session_id: String,
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

fn clipped_session_interval(
    session: &SessionRecord,
    min: DateTime<Utc>,
    max: DateTime<Utc>,
) -> anyhow::Result<Option<TimelineInterval>> {
    let Some(ended_at) = &session.ended_at else {
        return Ok(None);
    };
    let start = clip_time(&session.started_at, min, max)?;
    let end = clip_time(ended_at, min, max)?;
    if end <= start {
        return Ok(None);
    }
    Ok(Some(TimelineInterval {
        start,
        end,
        session_id: session.id.clone(),
    }))
}

fn union_seconds(mut intervals: Vec<TimelineInterval>) -> i64 {
    if intervals.is_empty() {
        return 0;
    }
    intervals.sort_by(|left, right| left.start.cmp(&right.start).then(left.end.cmp(&right.end)));
    let mut total = 0_i64;
    let mut current_start = intervals[0].start;
    let mut current_end = intervals[0].end;

    for interval in intervals.into_iter().skip(1) {
        if interval.start <= current_end {
            current_end = current_end.max(interval.end);
        } else {
            total += (current_end - current_start).num_seconds().max(0);
            current_start = interval.start;
            current_end = interval.end;
        }
    }

    total + (current_end - current_start).num_seconds().max(0)
}

fn interval_overlap_seconds(left: &TimelineInterval, right: &TimelineInterval) -> i64 {
    let start = left.start.max(right.start);
    let end = left.end.min(right.end);
    (end - start).num_seconds().max(0)
}

fn overlap_collection_seconds(
    left: &[TimelineInterval],
    right: &[TimelineInterval],
    exclude_same_session: bool,
) -> i64 {
    let mut total = 0_i64;
    for left_interval in left {
        for right_interval in right {
            if exclude_same_session && left_interval.session_id == right_interval.session_id {
                continue;
            }
            total += interval_overlap_seconds(left_interval, right_interval);
        }
    }
    total
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

pub fn build_parallel_review_summary(
    sessions: &[SessionRecord],
    range_start: &str,
    range_end: &str,
    project_overlaps: &[OverlapInterval],
    session_overlaps: &[OverlapInterval],
    max_concurrent_sessions: usize,
    max_concurrent_projects: usize,
) -> anyhow::Result<ParallelReviewSummary> {
    let range_start_dt = parse_utc(range_start)?;
    let range_end_dt = parse_utc(range_end)?;
    let active_intervals = sessions
        .iter()
        .filter_map(|session| {
            clipped_session_interval(session, range_start_dt, range_end_dt)
                .ok()
                .flatten()
        })
        .collect::<Vec<_>>();
    let total_active_seconds = union_seconds(active_intervals.clone());
    let parallel_project_seconds = project_overlaps.iter().map(|overlap| overlap.seconds).sum();
    let parallel_session_seconds = session_overlaps.iter().map(|overlap| overlap.seconds).sum();
    let ratio = |seconds: i64| {
        if total_active_seconds <= 0 {
            0.0
        } else {
            seconds as f64 / total_active_seconds as f64
        }
    };

    let waiting_intervals = sessions
        .iter()
        .filter_map(|session| {
            let Some(ended_at) = &session.ended_at else {
                return None;
            };
            let session_start = parse_utc(&session.started_at).ok()?;
            let waiting_start = session_start + Duration::seconds(session.prompting_seconds.max(0));
            let waiting_end = parse_utc(ended_at).ok()?;
            let start = waiting_start.max(range_start_dt);
            let end = waiting_end.min(range_end_dt);
            (end > start).then(|| TimelineInterval {
                start,
                end,
                session_id: session.id.clone(),
            })
        })
        .collect::<Vec<_>>();

    let human_intervals = sessions
        .iter()
        .filter_map(|session| {
            let Some(ended_at) = &session.ended_at else {
                return None;
            };
            let human_seconds = session.review_seconds.max(0) + session.repair_seconds.max(0);
            if human_seconds <= 0 {
                return None;
            }
            let start = parse_utc(ended_at).ok()?.max(range_start_dt);
            let end =
                (parse_utc(ended_at).ok()? + Duration::seconds(human_seconds)).min(range_end_dt);
            (end > start).then(|| TimelineInterval {
                start,
                end,
                session_id: session.id.clone(),
            })
        })
        .collect::<Vec<_>>();
    let ai_waiting_human_overlap_seconds =
        overlap_collection_seconds(&waiting_intervals, &human_intervals, true);

    let now = Utc::now().min(range_end_dt);
    let eval_time = now.max(range_start_dt);
    let backlog_sessions = sessions
        .iter()
        .filter(|session| {
            matches!(
                session.status,
                SessionStatus::Unknown | SessionStatus::NeedsReview | SessionStatus::NeedsRepair
            ) && session.ended_at.is_some()
        })
        .collect::<Vec<_>>();
    let review_backlog_seconds = backlog_sessions
        .iter()
        .filter_map(|session| session.ended_at.as_deref())
        .filter_map(|ended_at| parse_utc(ended_at).ok())
        .map(|ended_at| (eval_time - ended_at).num_seconds().max(0))
        .sum();

    let mut ordered_sessions = sessions
        .iter()
        .filter_map(|session| {
            parse_utc(&session.started_at)
                .ok()
                .map(|start| (start, session))
        })
        .collect::<Vec<_>>();
    ordered_sessions.sort_by(|left, right| left.0.cmp(&right.0));
    let mut context_switch_count = 0_usize;
    let mut short_context_switch_count = 0_usize;
    let mut switch_project_names = BTreeSet::new();
    let mut switch_session_ids = Vec::new();
    for pair in ordered_sessions.windows(2) {
        let (previous_start, previous) = pair[0];
        let (next_start, next) = pair[1];
        if previous.project_path != next.project_path {
            context_switch_count += 1;
            switch_project_names.insert(previous.project_name.clone());
            switch_project_names.insert(next.project_name.clone());
            switch_session_ids.push(previous.id.clone());
            switch_session_ids.push(next.id.clone());
            if (next_start - previous_start).num_minutes() <= 20 {
                short_context_switch_count += 1;
            }
        }
    }
    switch_session_ids.sort();
    switch_session_ids.dedup();

    let mut insights = Vec::new();
    if parallel_project_seconds > 0 && ai_waiting_human_overlap_seconds > 0 {
        insights.push(ParallelInsight {
            kind: ParallelInsightKind::ParallelPayoff,
            severity: InsightSeverity::Info,
            seconds: ai_waiting_human_overlap_seconds,
            count: project_overlaps.len(),
            session_ids: project_overlaps
                .iter()
                .flat_map(|overlap| overlap.session_ids.clone())
                .collect::<BTreeSet<_>>()
                .into_iter()
                .collect(),
            project_names: project_overlaps
                .iter()
                .flat_map(|overlap| overlap.project_names.clone())
                .collect::<BTreeSet<_>>()
                .into_iter()
                .collect(),
        });
    }
    if backlog_sessions.len() >= 2 || review_backlog_seconds >= 2 * 60 * 60 {
        insights.push(ParallelInsight {
            kind: ParallelInsightKind::ReviewBottleneck,
            severity: if review_backlog_seconds >= 4 * 60 * 60 {
                InsightSeverity::Critical
            } else {
                InsightSeverity::Warning
            },
            seconds: review_backlog_seconds,
            count: backlog_sessions.len(),
            session_ids: backlog_sessions
                .iter()
                .map(|session| session.id.clone())
                .collect(),
            project_names: backlog_sessions
                .iter()
                .map(|session| session.project_name.clone())
                .collect::<BTreeSet<_>>()
                .into_iter()
                .collect(),
        });
    }
    if short_context_switch_count >= 2 {
        insights.push(ParallelInsight {
            kind: ParallelInsightKind::ContextSwitching,
            severity: InsightSeverity::Warning,
            seconds: 0,
            count: short_context_switch_count,
            session_ids: switch_session_ids,
            project_names: switch_project_names.into_iter().collect(),
        });
    }
    if sessions.len() > 1 && max_concurrent_sessions <= 1 {
        insights.push(ParallelInsight {
            kind: ParallelInsightKind::LowParallelism,
            severity: InsightSeverity::Info,
            seconds: 0,
            count: sessions.len(),
            session_ids: sessions.iter().map(|session| session.id.clone()).collect(),
            project_names: sessions
                .iter()
                .map(|session| session.project_name.clone())
                .collect::<BTreeSet<_>>()
                .into_iter()
                .collect(),
        });
    }

    Ok(ParallelReviewSummary {
        total_active_seconds,
        parallel_project_seconds,
        parallel_session_seconds,
        parallel_project_ratio: ratio(parallel_project_seconds),
        parallel_session_ratio: ratio(parallel_session_seconds),
        max_concurrent_sessions,
        max_concurrent_projects,
        ai_waiting_human_overlap_seconds,
        review_backlog_session_count: backlog_sessions.len(),
        review_backlog_seconds,
        context_switch_count,
        short_context_switch_count,
        insights,
    })
}

fn session_successful(session: &SessionRecord) -> bool {
    matches!(
        session.status,
        SessionStatus::Useful | SessionStatus::Repaired
    ) || matches!(
        session.value.category,
        SessionValueCategory::HighValue | SessionValueCategory::MixedValue
    )
}

pub fn build_delivery_review_summary(sessions: &[SessionRecord]) -> DeliveryReviewSummary {
    let sessions_with_file_changes = sessions
        .iter()
        .filter(|session| {
            !session.delivery.changed_files.is_empty() || !session.changed_files.is_empty()
        })
        .count();
    let sessions_with_commits = sessions
        .iter()
        .filter(|session| session.delivery.committed_after_session)
        .count();
    let sessions_with_dirty_changes = sessions
        .iter()
        .filter(|session| session.delivery.dirty_after_session || session.git_dirty)
        .count();
    let absorbed_sessions = sessions
        .iter()
        .filter(|session| session.delivery.absorbed)
        .count();
    let sessions_with_tests = sessions
        .iter()
        .filter(|session| !session.delivery.test_commands.is_empty())
        .count();
    let sessions_with_pr = sessions
        .iter()
        .filter(|session| session.delivery.integration.pull_request.is_some())
        .count();
    let sessions_with_ci_signal = sessions
        .iter()
        .filter(|session| {
            !matches!(
                session.delivery.integration.ci.status,
                crate::models::CiStatus::NotRecorded
            )
        })
        .count();
    let sessions_with_issues = sessions
        .iter()
        .filter(|session| !session.delivery.integration.issues.is_empty())
        .count();
    let merged_sessions = sessions
        .iter()
        .filter(|session| {
            session
                .delivery
                .integration
                .pull_request
                .as_ref()
                .map(|pull_request| pull_request.merge_status == MergeStatus::Merged)
                .unwrap_or(false)
                || session
                    .delivery
                    .commits
                    .iter()
                    .any(|commit| commit.merged_to_default_branch == Some(true))
        })
        .count();
    let review_comment_known_sessions = sessions
        .iter()
        .filter(|session| session.delivery.integration.review_comment_count.is_some())
        .count();

    let unabsorbed_ids = sessions
        .iter()
        .filter(|session| {
            (!session.delivery.changed_files.is_empty() || session.delivery.committed_after_session)
                && !session.delivery.absorbed
        })
        .map(|session| session.id.clone())
        .collect::<Vec<_>>();
    let dirty_ids = sessions
        .iter()
        .filter(|session| session.delivery.dirty_after_session || session.git_dirty)
        .map(|session| session.id.clone())
        .collect::<Vec<_>>();
    let missing_test_ids = sessions
        .iter()
        .filter(|session| {
            (!session.delivery.changed_files.is_empty() || !session.changed_files.is_empty())
                && session.delivery.test_commands.is_empty()
        })
        .map(|session| session.id.clone())
        .collect::<Vec<_>>();

    let mut insights = Vec::new();
    if !unabsorbed_ids.is_empty() {
        insights.push(DeliveryInsight {
            kind: DeliveryInsightKind::UnabsorbedOutput,
            severity: InsightSeverity::Warning,
            count: unabsorbed_ids.len(),
            session_ids: unabsorbed_ids,
        });
    }
    if !dirty_ids.is_empty() {
        insights.push(DeliveryInsight {
            kind: DeliveryInsightKind::DirtyAfterSession,
            severity: InsightSeverity::Warning,
            count: dirty_ids.len(),
            session_ids: dirty_ids,
        });
    }
    if !missing_test_ids.is_empty() {
        insights.push(DeliveryInsight {
            kind: DeliveryInsightKind::MissingTests,
            severity: InsightSeverity::Info,
            count: missing_test_ids.len(),
            session_ids: missing_test_ids,
        });
    }
    if sessions_with_pr > 0 || sessions_with_issues > 0 {
        insights.push(DeliveryInsight {
            kind: DeliveryInsightKind::LinkedDelivery,
            severity: InsightSeverity::Info,
            count: sessions_with_pr + sessions_with_issues,
            session_ids: sessions
                .iter()
                .filter(|session| {
                    session.delivery.integration.pull_request.is_some()
                        || !session.delivery.integration.issues.is_empty()
                })
                .map(|session| session.id.clone())
                .collect(),
        });
    }

    DeliveryReviewSummary {
        sessions_with_file_changes,
        sessions_with_commits,
        sessions_with_dirty_changes,
        absorbed_sessions,
        sessions_with_tests,
        sessions_with_pr,
        sessions_with_ci_signal,
        sessions_with_issues,
        merged_sessions,
        review_comment_known_sessions,
        insights,
    }
}

pub fn task_type_for_session(session: &SessionRecord) -> TaskType {
    let text = format!(
        "{} {} {} {}",
        session.summary,
        session.note,
        session.git_branch.clone().unwrap_or_default(),
        session
            .delivery
            .test_commands
            .iter()
            .map(|command| command.command.clone())
            .collect::<Vec<_>>()
            .join(" ")
    )
    .to_lowercase();
    let files = session
        .delivery
        .changed_files
        .iter()
        .chain(session.changed_files.iter())
        .map(|file| file.to_lowercase())
        .collect::<Vec<_>>();

    if session.status == SessionStatus::NeedsRepair
        || session.repair_seconds > 0
        || text.contains("repair")
        || text.contains("bug")
        || text.contains("fix")
        || text.contains("failed")
    {
        return TaskType::Repair;
    }
    if files.iter().any(|file| {
        file.ends_with(".test.ts")
            || file.ends_with(".test.tsx")
            || file.ends_with("_test.rs")
            || file.contains("/test")
            || file.contains("/spec")
    }) || text.contains("test")
        || text.contains("typecheck")
    {
        return TaskType::Tests;
    }
    if files
        .iter()
        .any(|file| file.ends_with(".md") || file.contains("docs/") || file.contains("roadmap"))
        || text.contains("docs")
        || text.contains("roadmap")
    {
        return TaskType::Docs;
    }
    if files.iter().any(|file| {
        file.ends_with(".tsx")
            || file.ends_with(".jsx")
            || file.ends_with(".css")
            || file.contains("src/app")
            || file.contains("views/")
    }) || text.contains("ui")
        || text.contains("frontend")
        || text.contains("layout")
    {
        return TaskType::UiFrontend;
    }
    if text.contains("pr")
        || text.contains("ci")
        || text.contains("commit")
        || text.contains("release")
        || files
            .iter()
            .any(|file| file.contains(".github/") || file.contains("workflow"))
    {
        return TaskType::Delivery;
    }
    if files.iter().any(|file| {
        file.ends_with(".rs")
            || file.ends_with(".sql")
            || file.contains("src-tauri")
            || file.contains("parser")
            || file.contains("analytics")
            || file.contains("api")
    }) || text.contains("backend")
        || text.contains("parser")
        || text.contains("analytics")
    {
        return TaskType::Backend;
    }
    TaskType::Unknown
}

pub fn build_operating_review_summary(
    sessions: &[SessionRecord],
    parallel_review: &ParallelReviewSummary,
    delivery_review: &DeliveryReviewSummary,
) -> OperatingReviewSummary {
    let successful_sessions = sessions
        .iter()
        .filter(|session| session_successful(session))
        .count();
    let success_rate = if sessions.is_empty() {
        0.0
    } else {
        successful_sessions as f64 / sessions.len() as f64
    };
    let cross_tool_source_count = sessions
        .iter()
        .map(|session| session.source)
        .collect::<BTreeSet<_>>()
        .len();
    let cross_project_count = sessions
        .iter()
        .map(|session| session.project_path.clone())
        .collect::<BTreeSet<_>>()
        .len();

    let mut by_task = BTreeMap::<TaskType, Vec<&SessionRecord>>::new();
    let mut by_source = BTreeMap::<SessionSource, Vec<&SessionRecord>>::new();
    let mut by_source_task = BTreeMap::<(SessionSource, TaskType), Vec<&SessionRecord>>::new();
    for session in sessions {
        let task_type = task_type_for_session(session);
        by_task.entry(task_type).or_default().push(session);
        by_source.entry(session.source).or_default().push(session);
        by_source_task
            .entry((session.source, task_type))
            .or_default()
            .push(session);
    }

    let task_types = by_task
        .iter()
        .map(|(task_type, task_sessions)| {
            let recommended_source = by_source_task
                .iter()
                .filter(|((_, bucket_task), _)| bucket_task == task_type)
                .max_by(|left, right| {
                    let left_success = left
                        .1
                        .iter()
                        .filter(|session| session_successful(session))
                        .count();
                    let right_success = right
                        .1
                        .iter()
                        .filter(|session| session_successful(session))
                        .count();
                    let left_score: i64 = left.1.iter().map(|session| session.value.score).sum();
                    let right_score: i64 = right.1.iter().map(|session| session.value.score).sum();
                    left_success
                        .cmp(&right_success)
                        .then(left_score.cmp(&right_score))
                })
                .map(|((source, _), _)| *source);
            let total_score: i64 = task_sessions
                .iter()
                .map(|session| session.value.score)
                .sum();
            TaskTypeSummary {
                task_type: *task_type,
                session_count: task_sessions.len(),
                successful_sessions: task_sessions
                    .iter()
                    .filter(|session| session_successful(session))
                    .count(),
                repair_sessions: task_sessions
                    .iter()
                    .filter(|session| {
                        matches!(
                            session.status,
                            SessionStatus::NeedsRepair | SessionStatus::Repaired
                        ) || session.repair_seconds > 0
                    })
                    .count(),
                average_value_score: if task_sessions.is_empty() {
                    0.0
                } else {
                    total_score as f64 / task_sessions.len() as f64
                },
                recommended_source,
            }
        })
        .collect::<Vec<_>>();

    let tool_performance = by_source
        .iter()
        .map(|(source, source_sessions)| {
            let average_score = if source_sessions.is_empty() {
                0.0
            } else {
                source_sessions
                    .iter()
                    .map(|session| session.value.score)
                    .sum::<i64>() as f64
                    / source_sessions.len() as f64
            };
            let mut task_counts = BTreeMap::<TaskType, usize>::new();
            for session in source_sessions {
                *task_counts
                    .entry(task_type_for_session(session))
                    .or_default() += 1;
            }
            ToolPerformanceSummary {
                source: *source,
                session_count: source_sessions.len(),
                successful_sessions: source_sessions
                    .iter()
                    .filter(|session| session_successful(session))
                    .count(),
                average_value_score: average_score,
                top_task_type: task_counts
                    .into_iter()
                    .max_by(|left, right| left.1.cmp(&right.1))
                    .map(|(task_type, _)| task_type),
            }
        })
        .collect::<Vec<_>>();

    let mut playbook = Vec::new();
    if let Some(((source, task_type), bucket)) = by_source_task.iter().find(|(_, bucket)| {
        !bucket.is_empty()
            && bucket
                .iter()
                .filter(|session| session_successful(session))
                .count()
                * 100
                / bucket.len()
                >= 60
            && bucket
                .iter()
                .map(|session| session.value.score)
                .sum::<i64>()
                / bucket.len() as i64
                >= 55
    }) {
        playbook.push(PlaybookItem {
            kind: PlaybookKind::ReusePattern,
            title: format!("Reuse {} for {}", source.as_str(), task_type.as_str()),
            detail: "This local pattern produced solid value in the current review window."
                .to_string(),
            source: Some(*source),
            task_type: Some(*task_type),
            session_ids: bucket.iter().map(|session| session.id.clone()).collect(),
        });
    }
    if parallel_review.review_backlog_session_count >= 2 {
        playbook.push(PlaybookItem {
            kind: PlaybookKind::ClearReviewBacklog,
            title: "Clear review backlog before opening more agents".to_string(),
            detail: "Several completed sessions are still waiting for review or repair."
                .to_string(),
            source: None,
            task_type: None,
            session_ids: sessions
                .iter()
                .filter(|session| {
                    matches!(
                        session.status,
                        SessionStatus::Unknown
                            | SessionStatus::NeedsReview
                            | SessionStatus::NeedsRepair
                    )
                })
                .map(|session| session.id.clone())
                .collect(),
        });
    }
    if delivery_review.sessions_with_dirty_changes > 0
        || delivery_review.absorbed_sessions < delivery_review.sessions_with_file_changes
    {
        playbook.push(PlaybookItem {
            kind: PlaybookKind::AbsorbBeforeMoreAgents,
            title: "Absorb or shelve delivery output before widening parallelism".to_string(),
            detail: "There are local code changes that have not fully landed in the review loop."
                .to_string(),
            source: None,
            task_type: Some(TaskType::Delivery),
            session_ids: sessions
                .iter()
                .filter(|session| {
                    session.delivery.dirty_after_session
                        || (!session.delivery.changed_files.is_empty()
                            && !session.delivery.absorbed)
                })
                .map(|session| session.id.clone())
                .collect(),
        });
    }
    if parallel_review.parallel_project_ratio >= 0.2 {
        playbook.push(PlaybookItem {
            kind: PlaybookKind::KeepParallelLimitSwitches,
            title: "Keep parallel agents, cap short switching".to_string(),
            detail: "Parallel work is visible; review short switches before adding more concurrent sessions."
                .to_string(),
            source: None,
            task_type: None,
            session_ids: sessions.iter().map(|session| session.id.clone()).collect(),
        });
    }
    if delivery_review.sessions_with_file_changes > delivery_review.sessions_with_tests {
        playbook.push(PlaybookItem {
            kind: PlaybookKind::AddTestLoop,
            title: "Attach a local test loop to file-changing sessions".to_string(),
            detail: "Some code-changing sessions do not have a recorded test command yet."
                .to_string(),
            source: None,
            task_type: Some(TaskType::Tests),
            session_ids: sessions
                .iter()
                .filter(|session| {
                    !session.delivery.changed_files.is_empty()
                        && session.delivery.test_commands.is_empty()
                })
                .map(|session| session.id.clone())
                .collect(),
        });
    }

    OperatingReviewSummary {
        total_sessions: sessions.len(),
        successful_sessions,
        success_rate,
        cross_tool_source_count,
        cross_project_count,
        task_types,
        tool_performance,
        playbook,
    }
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
    let parallel_review = build_parallel_review_summary(
        &sessions,
        &start,
        &end,
        &project_overlaps,
        &session_overlaps,
        max_project_sessions.max(max_session_sessions),
        max_projects,
    )?;
    let delivery_review = build_delivery_review_summary(&sessions);
    let operating_review =
        build_operating_review_summary(&sessions, &parallel_review, &delivery_review);

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
                .filter(|session| session.value.category == SessionValueCategory::NeedsHumanRepair)
                .count(),
            discarded_value_count: sessions
                .iter()
                .filter(|session| session.value.category == SessionValueCategory::Discarded)
                .count(),
            parallel_seconds,
            parallel_session_seconds: parallel_review.parallel_session_seconds,
            parallel_project_ratio: parallel_review.parallel_project_ratio,
            ai_waiting_human_overlap_seconds: parallel_review.ai_waiting_human_overlap_seconds,
            review_backlog_session_count: parallel_review.review_backlog_session_count,
            context_switch_count: parallel_review.context_switch_count,
            absorbed_session_count: delivery_review.absorbed_sessions,
            committed_session_count: delivery_review.sessions_with_commits,
            dirty_delivery_session_count: delivery_review.sessions_with_dirty_changes,
            pr_linked_session_count: delivery_review.sessions_with_pr,
            ci_signal_session_count: delivery_review.sessions_with_ci_signal,
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
        parallel_review,
        delivery_review,
        operating_review,
        source_status,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::{
        DeliveryLink, SessionSource, TestCommandRecord, TestCommandStatus, TimeFields,
    };

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
            delivery: Default::default(),
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

    #[test]
    fn builds_parallel_review_summary_with_backlog_and_overlap() {
        let sessions = vec![
            session(
                "a",
                "alpha",
                "2026-05-19T01:00:00.000Z",
                "2026-05-19T01:30:00.000Z",
            ),
            session(
                "b",
                "beta",
                "2026-05-19T01:10:00.000Z",
                "2026-05-19T01:40:00.000Z",
            ),
        ];
        let (project_overlaps, _, max_session_projects, max_projects) = compute_overlaps(
            &sessions,
            "2026-05-19T00:00:00.000Z",
            "2026-05-20T00:00:00.000Z",
            OverlapKind::Projects,
        )
        .expect("project overlap computes");
        let (session_overlaps, _, max_sessions, _) = compute_overlaps(
            &sessions,
            "2026-05-19T00:00:00.000Z",
            "2026-05-20T00:00:00.000Z",
            OverlapKind::Sessions,
        )
        .expect("session overlap computes");
        let summary = build_parallel_review_summary(
            &sessions,
            "2026-05-19T00:00:00.000Z",
            "2026-05-20T00:00:00.000Z",
            &project_overlaps,
            &session_overlaps,
            max_sessions.max(max_session_projects),
            max_projects,
        )
        .expect("summary computes");

        assert_eq!(summary.parallel_project_seconds, 1200);
        assert_eq!(summary.parallel_session_seconds, 1200);
        assert_eq!(summary.max_concurrent_sessions, 2);
        assert_eq!(summary.review_backlog_session_count, 2);
        assert!(summary.parallel_project_ratio > 0.0);
        assert!(summary
            .insights
            .iter()
            .any(|insight| insight.kind == ParallelInsightKind::ReviewBottleneck));
    }

    #[test]
    fn builds_delivery_and_operating_review_summaries() {
        let mut useful = session(
            "a",
            "alpha",
            "2026-05-19T01:00:00.000Z",
            "2026-05-19T01:30:00.000Z",
        );
        useful.status = SessionStatus::Useful;
        useful.changed_files = vec!["src/App.tsx".to_string()];
        useful.delivery = DeliveryLink {
            changed_files: vec!["src/App.tsx".to_string()],
            committed_after_session: true,
            absorbed: true,
            test_commands: vec![TestCommandRecord {
                command: "npm test".to_string(),
                status: TestCommandStatus::Passed,
                source: "fixture".to_string(),
            }],
            confidence: 0.8,
            ..DeliveryLink::default()
        };
        useful.value = crate::models::SessionValue::for_session(&useful);

        let mut repair = session(
            "b",
            "beta",
            "2026-05-19T02:00:00.000Z",
            "2026-05-19T02:30:00.000Z",
        );
        repair.status = SessionStatus::NeedsRepair;
        repair.git_dirty = true;
        repair.delivery = DeliveryLink {
            changed_files: vec!["src/storage/adapter.ts".to_string()],
            dirty_after_session: true,
            confidence: 0.5,
            ..DeliveryLink::default()
        };
        repair.value = crate::models::SessionValue::for_session(&repair);

        let sessions = vec![useful, repair];
        let delivery = build_delivery_review_summary(&sessions);
        let parallel = ParallelReviewSummary::default();
        let operating = build_operating_review_summary(&sessions, &parallel, &delivery);

        assert_eq!(delivery.sessions_with_commits, 1);
        assert_eq!(delivery.absorbed_sessions, 1);
        assert_eq!(delivery.sessions_with_dirty_changes, 1);
        assert_eq!(delivery.sessions_with_tests, 1);
        assert_eq!(operating.total_sessions, 2);
        assert!(operating
            .task_types
            .iter()
            .any(|task| task.task_type == TaskType::Tests));
        assert!(!operating.playbook.is_empty());
    }
}
