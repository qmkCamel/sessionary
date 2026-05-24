use regex::Regex;
use serde_json::Value;
use std::collections::{BTreeMap, BTreeSet};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::OnceLock;

use crate::git::{delivery_link, git_info};
use crate::models::{
    SessionRecord, SessionSource, SessionStatus, TestCommandRecord, TestCommandStatus, TimeFields,
};
use crate::util::{clamp, normalize_timestamp, seconds_between, stable_id, truncate};

fn json_lines(file_path: &Path) -> anyhow::Result<Vec<Value>> {
    let content = fs::read_to_string(file_path)?;
    Ok(content
        .lines()
        .filter(|line| !line.trim().is_empty())
        .filter_map(|line| serde_json::from_str::<Value>(line).ok())
        .collect())
}

fn changed_file_marker_regex() -> &'static Regex {
    static REGEX: OnceLock<Regex> = OnceLock::new();
    REGEX.get_or_init(|| {
        Regex::new(r"\*\*\* (?:Add|Update|Delete) File: ([^\n]+)").expect("valid regex")
    })
}

fn file_like_regex() -> &'static Regex {
    static REGEX: OnceLock<Regex> = OnceLock::new();
    REGEX.get_or_init(|| {
        Regex::new(
            r#"(/Users/[^\s"'`),]+|[A-Za-z0-9_.\-/]+\.(?:ts|tsx|js|jsx|json|md|css|html|sql|rs|py|toml|yaml|yml|mjs|cjs))"#,
        )
        .expect("valid regex")
    })
}

fn test_command_regex() -> &'static Regex {
    static REGEX: OnceLock<Regex> = OnceLock::new();
    REGEX.get_or_init(|| {
        Regex::new(
            r"(?im)\b((?:npm|pnpm|yarn|bun)\s+(?:run\s+)?(?:test|build|typecheck|lint)\b[^\n;&|]*|cargo\s+(?:test|clippy|fmt)\b[^\n;&|]*|pytest\b[^\n;&|]*|go\s+test\b[^\n;&|]*|make\s+(?:test|check|lint)\b[^\n;&|]*)",
        )
        .expect("valid regex")
    })
}

fn text_has_hint(text: &str, hints: &[&str]) -> bool {
    if hints.iter().any(|hint| text.contains(hint)) {
        return true;
    }
    let lower = text.to_ascii_lowercase();
    hints.iter().any(|hint| lower.contains(hint))
}

fn content_to_text(value: &Value) -> String {
    match value {
        Value::String(text) => text.clone(),
        Value::Array(items) => items
            .iter()
            .filter_map(|item| {
                if let Some(text) = item.as_str() {
                    return Some(text.to_string());
                }
                item.get("text")
                    .or_else(|| item.get("input_text"))
                    .and_then(Value::as_str)
                    .map(ToString::to_string)
            })
            .collect::<Vec<_>>()
            .join(" "),
        _ => String::new(),
    }
}

fn extract_changed_files(value: &Value) -> Vec<String> {
    let mut files = BTreeSet::new();
    collect_changed_files(value, &mut files);
    files.into_iter().take(20).collect()
}

fn collect_changed_files(value: &Value, files: &mut BTreeSet<String>) {
    match value {
        Value::String(text) => collect_changed_files_from_text(text, files),
        Value::Array(items) => {
            for item in items {
                collect_changed_files(item, files);
            }
        }
        Value::Object(map) => {
            for item in map.values() {
                collect_changed_files(item, files);
            }
        }
        _ => {}
    }
}

fn collect_changed_files_from_text(text: &str, files: &mut BTreeSet<String>) {
    const FILE_HINTS: &[&str] = &[
        "*** add file:",
        "*** update file:",
        "*** delete file:",
        "/users/",
        ".ts",
        ".tsx",
        ".js",
        ".jsx",
        ".json",
        ".md",
        ".css",
        ".html",
        ".sql",
        ".rs",
        ".py",
        ".toml",
        ".yaml",
        ".yml",
        ".mjs",
        ".cjs",
    ];
    if !text_has_hint(text, FILE_HINTS) {
        return;
    }

    for capture in changed_file_marker_regex().captures_iter(text) {
        files.insert(capture[1].trim().to_string());
    }
    for capture in file_like_regex().captures_iter(text) {
        let candidate = capture[1].trim().to_string();
        if !candidate.contains("node_modules") && !candidate.contains("/.git/") {
            files.insert(candidate);
        }
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
    let mut commands = BTreeMap::<String, TestCommandStatus>::new();
    collect_test_commands(value, &mut commands);

    commands
        .into_iter()
        .take(20)
        .map(|(command, status)| TestCommandRecord {
            command,
            status,
            source: "codex_log".to_string(),
        })
        .collect()
}

fn collect_test_commands(value: &Value, commands: &mut BTreeMap<String, TestCommandStatus>) {
    match value {
        Value::String(text) => collect_test_commands_from_text(text, commands),
        Value::Array(items) => {
            for item in items {
                collect_test_commands(item, commands);
            }
        }
        Value::Object(map) => {
            for item in map.values() {
                collect_test_commands(item, commands);
            }
        }
        _ => {}
    }
}

fn collect_test_commands_from_text(text: &str, commands: &mut BTreeMap<String, TestCommandStatus>) {
    const TEST_COMMAND_HINTS: &[&str] = &[
        "npm ", "pnpm ", "yarn ", "bun ", "cargo ", "pytest", "go test", "make ",
    ];
    if !text_has_hint(text, TEST_COMMAND_HINTS) {
        return;
    }

    let status = test_command_status(text);
    for capture in test_command_regex().captures_iter(text) {
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

fn token_total(payload: &Value) -> Option<i64> {
    payload
        .get("info")
        .and_then(|info| info.get("total_token_usage"))
        .and_then(|usage| {
            usage
                .get("total_tokens")
                .or_else(|| usage.get("totalTokens"))
        })
        .and_then(Value::as_i64)
}

fn cost_total(payload: &Value) -> Option<f64> {
    payload
        .get("info")
        .and_then(|info| info.get("total_token_usage").or_else(|| info.get("usage")))
        .and_then(|usage| {
            usage
                .get("cost_usd")
                .or_else(|| usage.get("costUsd"))
                .or_else(|| usage.get("cost"))
                .or_else(|| usage.get("total_cost_usd"))
        })
        .and_then(Value::as_f64)
}

fn basename(path: &Path) -> String {
    path.file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("Unknown Project")
        .to_string()
}

pub fn parse_codex_file(file_path: &Path) -> anyhow::Result<Option<SessionRecord>> {
    let items = json_lines(file_path)?;
    if items.is_empty() {
        return Ok(None);
    }

    let mut source_session_id = stable_id(&file_path.display().to_string());
    let mut cwd = String::new();
    let mut first_user_message = String::new();
    let mut user_message_count = 0_i64;
    let mut assistant_message_count = 0_i64;
    let mut tool_call_count = 0_i64;
    let mut token_count: Option<i64> = None;
    let mut cost_amount: Option<f64> = None;
    let mut timestamps = Vec::new();
    let mut changed_files = BTreeSet::new();
    let mut test_commands = Vec::<TestCommandRecord>::new();

    for item in items {
        test_commands.extend(extract_test_commands(&item));
        if let Some(timestamp) = item
            .get("timestamp")
            .and_then(Value::as_str)
            .and_then(normalize_timestamp)
        {
            timestamps.push(timestamp);
        }
        let payload = item.get("payload").unwrap_or(&Value::Null);
        let item_type = item.get("type").and_then(Value::as_str).unwrap_or_default();

        if item_type == "session_meta" {
            if let Some(id) = payload.get("id").and_then(Value::as_str) {
                source_session_id = id.to_string();
            }
            if let Some(payload_cwd) = payload.get("cwd").and_then(Value::as_str) {
                cwd = payload_cwd.to_string();
            }
            if let Some(timestamp) = payload
                .get("timestamp")
                .and_then(Value::as_str)
                .and_then(normalize_timestamp)
            {
                timestamps.push(timestamp);
            }
        }

        if item_type == "event_msg" {
            match payload
                .get("type")
                .and_then(Value::as_str)
                .unwrap_or_default()
            {
                "user_message" => {
                    user_message_count += 1;
                    if first_user_message.is_empty() {
                        first_user_message = payload
                            .get("message")
                            .and_then(Value::as_str)
                            .unwrap_or_default()
                            .to_string();
                    }
                }
                "agent_message" => assistant_message_count += 1,
                "token_count" => {
                    if let Some(total) = token_total(payload) {
                        token_count = Some(token_count.unwrap_or(0).max(total));
                    }
                    if let Some(cost) = cost_total(payload) {
                        cost_amount = Some(cost_amount.unwrap_or(0.0).max(cost));
                    }
                }
                _ => {}
            }
        }

        if item_type == "response_item" {
            match payload
                .get("type")
                .and_then(Value::as_str)
                .unwrap_or_default()
            {
                "function_call" => {
                    tool_call_count += 1;
                    if let Some(args) = payload.get("arguments") {
                        for file in extract_changed_files(args) {
                            changed_files.insert(file);
                        }
                    }
                }
                "function_call_output" => {
                    if let Some(output) = payload.get("output") {
                        for file in extract_changed_files(output) {
                            changed_files.insert(file);
                        }
                    }
                }
                "message" => match payload
                    .get("role")
                    .and_then(Value::as_str)
                    .unwrap_or_default()
                {
                    "assistant" => assistant_message_count += 1,
                    "user" => {
                        user_message_count += 1;
                        if first_user_message.is_empty() {
                            if let Some(content) = payload.get("content") {
                                first_user_message = content_to_text(content);
                            }
                        }
                    }
                    _ => {}
                },
                _ => {}
            }
        }
    }

    if timestamps.is_empty() {
        return Ok(None);
    }
    timestamps.sort();
    timestamps.dedup();
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
        file_path
            .parent()
            .unwrap_or_else(|| Path::new("/"))
            .to_path_buf()
    } else {
        PathBuf::from(&cwd)
    };
    let git = git_info(&cwd_path);
    let project_path = git.root;
    let project_name = basename(&project_path);
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

    Ok(Some(SessionRecord {
        id: format!("codex:{source_session_id}"),
        source: SessionSource::Codex,
        source_session_id,
        project_name,
        project_path: project_path.display().to_string(),
        cwd: if cwd.is_empty() {
            cwd_path.display().to_string()
        } else {
            cwd
        },
        started_at,
        ended_at,
        duration_seconds,
        user_message_count,
        assistant_message_count,
        tool_call_count,
        token_count,
        cost_amount,
        status: SessionStatus::Unknown,
        status_updated_at: None,
        note: String::new(),
        confidence: if cwd_path.exists() { 0.90 } else { 0.72 },
        changed_files: delivery.changed_files.iter().take(30).cloned().collect(),
        prompting_seconds,
        waiting_seconds,
        review_seconds,
        repair_seconds: 0,
        review_started_at: None,
        repair_started_at: None,
        time_fields: TimeFields::default(),
        value: Default::default(),
        summary: truncate(&first_user_message, 180),
        source_file: file_path.display().to_string(),
        git_branch: git.branch,
        git_dirty: git.dirty,
        delivery,
    }))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn parses_fixture_codex_session() {
        let path = Path::new("../fixtures/codex/sample.jsonl");
        let session = parse_codex_file(path)
            .expect("fixture parses")
            .expect("session");
        assert_eq!(session.source_session_id, "codex-fixture-1");
        assert_eq!(session.user_message_count, 1);
        assert_eq!(session.tool_call_count, 1);
        assert!(session
            .changed_files
            .iter()
            .any(|file| file.ends_with("src/App.tsx")));
    }

    #[test]
    fn extracts_nested_test_commands() {
        let value = json!({
            "payload": {
                "output": [
                    "checking build",
                    {"text": "npm run typecheck\ncargo test --all\nexit code: 0"}
                ]
            }
        });

        let commands = extract_test_commands(&value);

        assert!(commands.iter().any(|command| {
            command.command == "npm run typecheck" && command.status == TestCommandStatus::Passed
        }));
        assert!(commands.iter().any(|command| {
            command.command == "cargo test --all" && command.status == TestCommandStatus::Passed
        }));
    }

    #[test]
    fn extracts_changed_files_without_node_modules_noise() {
        let value = json!({
            "output": [
                "*** Begin Patch\n*** Update File: src/App.tsx\n*** End Patch",
                "/Users/edge/work/sessionary/src-tauri/src/main.rs",
                "/Users/edge/work/sessionary/node_modules/vite/index.js"
            ]
        });

        let files = extract_changed_files(&value);

        assert!(files.iter().any(|file| file == "src/App.tsx"));
        assert!(files
            .iter()
            .any(|file| file.ends_with("src-tauri/src/main.rs")));
        assert!(!files.iter().any(|file| file.contains("node_modules")));
    }
}
