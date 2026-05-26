use serde_json::Value;
use std::collections::{BTreeMap, BTreeSet};
use std::fs;
use std::path::{Path, PathBuf};

use crate::git::{delivery_link, git_info};
use crate::models::{
    SessionRecord, SessionSource, SessionStatus, TestCommandRecord, TestCommandStatus, TimeFields,
};
use crate::parsers::{infer_ai_waiting_intervals, AiEvent, AiEventKind};
use crate::util::{clamp, normalize_timestamp, seconds_between, stable_id, truncate};

fn timestamp_of(event: &Value) -> Option<String> {
    event
        .get("timestamp")
        .or_else(|| event.get("created_at"))
        .or_else(|| event.get("createdAt"))
        .or_else(|| event.get("time"))
        .or_else(|| event.get("start_time"))
        .or_else(|| event.get("startTime"))
        .or_else(|| {
            event
                .get("attributes")
                .and_then(|attributes| attributes.get("timestamp"))
        })
        .and_then(|value| {
            if let Some(text) = value.as_str() {
                normalize_timestamp(text)
            } else if let Some(number) = value.as_i64() {
                let millis = if number > 1_000_000_000_000 {
                    number
                } else {
                    number * 1000
                };
                chrono::DateTime::<chrono::Utc>::from_timestamp_millis(millis)
                    .map(|dt| dt.to_rfc3339_opts(chrono::SecondsFormat::Millis, true))
            } else {
                None
            }
        })
}

fn attr<'a>(event: &'a Value, keys: &[&str]) -> Option<&'a Value> {
    for key in keys {
        if let Some(value) = event.get(*key) {
            return Some(value);
        }
        if let Some(value) = event
            .get("attributes")
            .and_then(|attributes| attributes.get(*key))
        {
            return Some(value);
        }
    }
    None
}

fn role_of(event: &Value) -> String {
    attr(
        event,
        &["role", "type", "event.name", "name", "message.role"],
    )
    .or_else(|| event.get("message").and_then(|message| message.get("role")))
    .and_then(Value::as_str)
    .unwrap_or_default()
    .to_string()
}

fn message_text(event: &Value) -> String {
    let content = event
        .get("content")
        .or_else(|| {
            event
                .get("message")
                .and_then(|message| message.get("content"))
        })
        .or_else(|| {
            attr(
                event,
                &["content", "message.content", "prompt", "completion"],
            )
        });
    match content {
        Some(Value::String(text)) => text.clone(),
        Some(Value::Array(items)) => items
            .iter()
            .filter_map(|item| {
                item.as_str().map(ToString::to_string).or_else(|| {
                    item.get("text")
                        .or_else(|| item.get("content"))
                        .and_then(Value::as_str)
                        .map(ToString::to_string)
                })
            })
            .collect::<Vec<_>>()
            .join(" "),
        _ => String::new(),
    }
}

fn usage_tokens(event: &Value) -> i64 {
    let usage = event
        .get("usage")
        .or_else(|| {
            event
                .get("message")
                .and_then(|message| message.get("usage"))
        })
        .or_else(|| event.get("attributes"));
    let Some(usage) = usage else {
        return 0;
    };
    let read = |key: &str| usage.get(key).and_then(Value::as_i64).unwrap_or(0);
    read("input_tokens")
        + read("inputTokens")
        + read("claude.usage.input_tokens")
        + read("llm.usage.input_tokens")
        + read("output_tokens")
        + read("outputTokens")
        + read("claude.usage.output_tokens")
        + read("llm.usage.output_tokens")
        + read("cache_creation_input_tokens")
        + read("cache_read_input_tokens")
}

fn usage_cost(event: &Value) -> f64 {
    let usage = event
        .get("usage")
        .or_else(|| {
            event
                .get("message")
                .and_then(|message| message.get("usage"))
        })
        .or_else(|| event.get("attributes"));
    let Some(usage) = usage else {
        return 0.0;
    };
    for key in [
        "cost_usd",
        "costUsd",
        "cost",
        "total_cost_usd",
        "totalCostUsd",
        "claude.cost.usd",
        "llm.usage.cost_usd",
    ] {
        if let Some(value) = usage.get(key).and_then(Value::as_f64) {
            return value;
        }
    }
    0.0
}

fn file_hints(event: &Value) -> Vec<String> {
    let mut files = Vec::new();
    for key in ["file_path", "filePath", "path", "filename"] {
        if let Some(path) = attr(event, &[key]).and_then(Value::as_str) {
            files.push(path.to_string());
        }
    }
    if let Some(result) = event
        .get("toolUseResult")
        .or_else(|| event.get("tool_use_result"))
    {
        if let Some(path) = result
            .get("file_path")
            .or_else(|| result.get("filePath"))
            .or_else(|| result.get("path"))
            .and_then(Value::as_str)
        {
            files.push(path.to_string());
        }
    }
    files
}

fn strings_in(value: &Value, output: &mut Vec<String>) {
    match value {
        Value::String(text) => output.push(text.clone()),
        Value::Array(items) => {
            for item in items {
                strings_in(item, output);
            }
        }
        Value::Object(map) => {
            for item in map.values() {
                strings_in(item, output);
            }
        }
        _ => {}
    }
}

fn test_command_status(text: &str) -> TestCommandStatus {
    let lower = text.to_lowercase();
    if lower.contains("exit code: 0")
        || lower.contains("exit code 0")
        || lower.contains("test result: ok")
        || lower.contains("tests passed")
    {
        TestCommandStatus::Passed
    } else if lower.contains("exit code: 1")
        || lower.contains("exit code 1")
        || lower.contains("test result: failed")
        || lower.contains("tests failed")
    {
        TestCommandStatus::Failed
    } else {
        TestCommandStatus::Unknown
    }
}

fn extract_test_commands(value: &Value) -> Vec<TestCommandRecord> {
    let mut strings = Vec::new();
    strings_in(value, &mut strings);
    let command_regex = regex::Regex::new(
        r"(?im)\b((?:npm|pnpm|yarn|bun)\s+(?:run\s+)?(?:test|build|typecheck|lint)[^\n;&|]*|cargo\s+(?:test|clippy|fmt)[^\n;&|]*|pytest[^\n;&|]*|go\s+test[^\n;&|]*|make\s+(?:test|check|lint)[^\n;&|]*)",
    )
    .expect("valid regex");
    let mut commands = BTreeMap::<String, TestCommandStatus>::new();
    for text in strings {
        let status = test_command_status(&text);
        for capture in command_regex.captures_iter(&text) {
            let command = capture[1].split_whitespace().collect::<Vec<_>>().join(" ");
            commands
                .entry(truncate(&command, 160))
                .and_modify(|existing| {
                    if *existing == TestCommandStatus::Unknown {
                        *existing = status;
                    }
                })
                .or_insert(status);
        }
    }

    commands
        .into_iter()
        .take(20)
        .map(|(command, status)| TestCommandRecord {
            command,
            status,
            source: "claude_log".to_string(),
        })
        .collect()
}

fn project_from_claude_path(file_path: &Path) -> PathBuf {
    let components = file_path
        .components()
        .map(|component| component.as_os_str().to_string_lossy().to_string())
        .collect::<Vec<_>>();
    if let Some(index) = components.iter().position(|part| part == "projects") {
        if let Some(project_dir) = components.get(index + 1) {
            if project_dir.starts_with("-Users-") {
                return PathBuf::from(project_dir.replace('-', "/"));
            }
            return PathBuf::from(project_dir);
        }
    }
    file_path
        .parent()
        .unwrap_or_else(|| Path::new("/"))
        .to_path_buf()
}

fn basename(path: &Path) -> String {
    path.file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("Unknown Project")
        .to_string()
}

pub fn parse_claude_file(file_path: &Path) -> anyhow::Result<Vec<SessionRecord>> {
    let content = fs::read_to_string(file_path)?;
    let events = content
        .lines()
        .filter(|line| !line.trim().is_empty())
        .filter_map(|line| serde_json::from_str::<Value>(line).ok())
        .collect::<Vec<_>>();

    let mut groups: BTreeMap<String, Vec<Value>> = BTreeMap::new();
    for event in events {
        let session_id = attr(
            &event,
            &[
                "sessionId",
                "session_id",
                "conversationId",
                "conversation_id",
                "uuid",
                "session.id",
                "claude.session.id",
                "prompt.id",
            ],
        )
        .and_then(Value::as_str)
        .map(ToString::to_string)
        .unwrap_or_else(|| stable_id(&file_path.display().to_string()));
        groups.entry(session_id).or_default().push(event);
    }

    let mut sessions = Vec::new();
    for (source_session_id, group) in groups {
        let mut timestamps = group.iter().filter_map(timestamp_of).collect::<Vec<_>>();
        if timestamps.is_empty() {
            continue;
        }
        timestamps.sort();
        timestamps.dedup();

        let mut cwd = String::new();
        let mut first_user_message = String::new();
        let mut user_message_count = 0_i64;
        let mut assistant_message_count = 0_i64;
        let mut tool_call_count = 0_i64;
        let mut token_count = 0_i64;
        let mut cost_amount = 0.0_f64;
        let mut changed_files = BTreeSet::new();
        let mut test_commands = Vec::<TestCommandRecord>::new();
        let mut ai_events = Vec::new();

        for event in &group {
            test_commands.extend(extract_test_commands(event));
            let event_timestamp = timestamp_of(event);
            if let Some(path) = event
                .get("cwd")
                .or_else(|| event.get("projectPath"))
                .or_else(|| event.get("project_path"))
                .or_else(|| {
                    attr(
                        event,
                        &["cwd", "project.path", "projectPath", "project_path"],
                    )
                })
                .and_then(Value::as_str)
            {
                cwd = path.to_string();
            }
            let role = role_of(event);
            if role == "user" || role == "user_message" {
                if let Some(timestamp) = &event_timestamp {
                    ai_events.push(AiEvent {
                        at: timestamp.clone(),
                        kind: AiEventKind::User,
                    });
                }
                user_message_count += 1;
                if first_user_message.is_empty() {
                    first_user_message = message_text(event);
                }
            }
            if role == "assistant" || role == "assistant_message" {
                if let Some(timestamp) = &event_timestamp {
                    ai_events.push(AiEvent {
                        at: timestamp.clone(),
                        kind: AiEventKind::Ai,
                    });
                }
                assistant_message_count += 1;
            }
            if role.contains("tool")
                || event.get("toolUseResult").is_some()
                || event.get("tool_use_id").is_some()
            {
                if let Some(timestamp) = &event_timestamp {
                    ai_events.push(AiEvent {
                        at: timestamp.clone(),
                        kind: AiEventKind::Ai,
                    });
                }
                tool_call_count += 1;
            }
            token_count += usage_tokens(event);
            cost_amount += usage_cost(event);
            for file in file_hints(event) {
                changed_files.insert(file);
            }
        }

        let started_at = timestamps.first().cloned().expect("timestamp exists");
        let ended_at = timestamps.last().cloned();
        let duration_seconds = seconds_between(&started_at, ended_at.as_deref());
        let ai_waiting_intervals = infer_ai_waiting_intervals(ai_events);
        let prompting_seconds = clamp(
            user_message_count * 90,
            0,
            (duration_seconds as f64 * 0.35).round() as i64,
        );
        let review_seconds = if ended_at.is_some() {
            clamp((duration_seconds as f64 * 0.12).round() as i64, 60, 900)
        } else {
            0
        };
        let waiting_seconds = if ai_waiting_intervals.is_empty() {
            (duration_seconds - prompting_seconds).max(0)
        } else {
            ai_waiting_intervals
                .iter()
                .map(|interval| interval.seconds)
                .sum()
        };
        let cwd_path = if cwd.is_empty() {
            project_from_claude_path(file_path)
        } else {
            PathBuf::from(&cwd)
        };
        let git = git_info(&cwd_path);
        let project_path = git.root;
        for file in &git.changed_files {
            changed_files.insert(file.clone());
        }
        test_commands.sort_by(|left, right| left.command.cmp(&right.command));
        test_commands.dedup_by(|left, right| left.command == right.command);
        let changed_files = changed_files.into_iter().take(30).collect::<Vec<_>>();
        let delivery = delivery_link(
            &cwd_path,
            &started_at,
            ended_at.as_deref(),
            &changed_files,
            test_commands,
            &first_user_message,
            "",
        );

        sessions.push(SessionRecord {
            id: format!("claude:{source_session_id}"),
            source: SessionSource::Claude,
            source_session_id,
            project_name: basename(&project_path),
            project_path: project_path.display().to_string(),
            cwd: cwd_path.display().to_string(),
            started_at,
            ended_at,
            duration_seconds,
            user_message_count,
            assistant_message_count,
            tool_call_count,
            token_count: (token_count > 0).then_some(token_count),
            cost_amount: (cost_amount > 0.0).then_some(cost_amount),
            status: SessionStatus::Unknown,
            status_updated_at: None,
            note: String::new(),
            confidence: if cwd_path.exists() { 0.84 } else { 0.65 },
            changed_files: delivery.changed_files.iter().take(30).cloned().collect(),
            prompting_seconds,
            waiting_seconds,
            review_seconds,
            repair_seconds: 0,
            review_started_at: None,
            repair_started_at: None,
            ai_waiting_intervals,
            review_intervals: Vec::new(),
            repair_intervals: Vec::new(),
            time_fields: TimeFields::default(),
            value: Default::default(),
            summary: truncate(&first_user_message, 180),
            source_file: file_path.display().to_string(),
            git_branch: git.branch,
            git_dirty: git.dirty,
            delivery,
        });
    }

    Ok(sessions)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_fixture_claude_session() {
        let path = Path::new("../fixtures/claude/sample.jsonl");
        let sessions = parse_claude_file(path).expect("fixture parses");
        assert_eq!(sessions.len(), 1);
        assert_eq!(sessions[0].source_session_id, "claude-fixture-1");
        assert_eq!(sessions[0].user_message_count, 1);
        assert_eq!(sessions[0].tool_call_count, 1);
    }

    #[test]
    fn parses_otel_style_claude_session() {
        let path = Path::new("../fixtures/claude/otel.jsonl");
        let sessions = parse_claude_file(path).expect("fixture parses");
        assert_eq!(sessions.len(), 1);
        assert_eq!(sessions[0].source_session_id, "claude-otel-1");
        assert_eq!(sessions[0].user_message_count, 1);
        assert_eq!(sessions[0].assistant_message_count, 1);
        assert_eq!(sessions[0].tool_call_count, 1);
        assert_eq!(sessions[0].token_count, Some(66));
        assert_eq!(sessions[0].cost_amount, Some(0.012));
        assert!(sessions[0]
            .changed_files
            .iter()
            .any(|file| file.ends_with("src-tauri/src/parsers/claude.rs")));
    }

    #[test]
    fn infers_ai_waiting_turn_intervals() {
        let path = Path::new("../fixtures/claude/ai-turns.jsonl");
        let sessions = parse_claude_file(path).expect("fixture parses");
        let session = sessions.first().expect("session");

        assert_eq!(session.ai_waiting_intervals.len(), 2);
        assert_eq!(
            session.ai_waiting_intervals[0].user_sent_at,
            "2026-05-19T02:00:00.000Z"
        );
        assert_eq!(
            session.ai_waiting_intervals[0].ai_finished_at,
            "2026-05-19T02:06:00.000Z"
        );
        assert_eq!(session.ai_waiting_intervals[0].seconds, 360);
        assert_eq!(
            session.ai_waiting_intervals[0].source,
            crate::models::AiWaitingIntervalSource::Inferred
        );
        assert_eq!(session.ai_waiting_intervals[1].seconds, 420);
    }
}
