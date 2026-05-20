use serde_json::Value;
use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};

use crate::git::git_info;
use crate::models::{SessionRecord, SessionSource, SessionStatus, TimeFields};
use crate::util::{clamp, normalize_timestamp, seconds_between, stable_id, truncate};

fn timestamp_of(event: &Value) -> Option<String> {
    event
        .get("timestamp")
        .or_else(|| event.get("created_at"))
        .or_else(|| event.get("createdAt"))
        .or_else(|| event.get("time"))
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

fn role_of(event: &Value) -> String {
    event
        .get("role")
        .or_else(|| event.get("type"))
        .or_else(|| event.get("message").and_then(|message| message.get("role")))
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_string()
}

fn message_text(event: &Value) -> String {
    let content = event.get("content").or_else(|| {
        event
            .get("message")
            .and_then(|message| message.get("content"))
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
    let usage = event.get("usage").or_else(|| {
        event
            .get("message")
            .and_then(|message| message.get("usage"))
    });
    let Some(usage) = usage else {
        return 0;
    };
    let read = |key: &str| usage.get(key).and_then(Value::as_i64).unwrap_or(0);
    read("input_tokens")
        + read("inputTokens")
        + read("output_tokens")
        + read("outputTokens")
        + read("cache_creation_input_tokens")
        + read("cache_read_input_tokens")
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
        let session_id = event
            .get("sessionId")
            .or_else(|| event.get("session_id"))
            .or_else(|| event.get("conversationId"))
            .or_else(|| event.get("conversation_id"))
            .or_else(|| event.get("uuid"))
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

        for event in &group {
            if let Some(path) = event
                .get("cwd")
                .or_else(|| event.get("projectPath"))
                .or_else(|| event.get("project_path"))
                .and_then(Value::as_str)
            {
                cwd = path.to_string();
            }
            let role = role_of(event);
            if role == "user" || role == "user_message" {
                user_message_count += 1;
                if first_user_message.is_empty() {
                    first_user_message = message_text(event);
                }
            }
            if role == "assistant" || role == "assistant_message" {
                assistant_message_count += 1;
            }
            if role.contains("tool")
                || event.get("toolUseResult").is_some()
                || event.get("tool_use_id").is_some()
            {
                tool_call_count += 1;
            }
            token_count += usage_tokens(event);
        }

        let started_at = timestamps.first().cloned().expect("timestamp exists");
        let ended_at = timestamps.last().cloned();
        let duration_seconds = seconds_between(&started_at, ended_at.as_deref());
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
        let waiting_seconds = (duration_seconds - prompting_seconds).max(0);
        let cwd_path = if cwd.is_empty() {
            project_from_claude_path(file_path)
        } else {
            PathBuf::from(&cwd)
        };
        let git = git_info(&cwd_path);
        let project_path = git.root;

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
            cost_amount: None,
            status: SessionStatus::Unknown,
            status_updated_at: None,
            note: String::new(),
            confidence: if cwd_path.exists() { 0.84 } else { 0.65 },
            changed_files: Vec::new(),
            prompting_seconds,
            waiting_seconds,
            review_seconds,
            repair_seconds: 0,
            time_fields: TimeFields::default(),
            summary: truncate(&first_user_message, 180),
            source_file: file_path.display().to_string(),
            git_branch: git.branch,
            git_dirty: git.dirty,
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
}
