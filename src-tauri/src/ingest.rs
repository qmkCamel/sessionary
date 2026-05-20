use chrono::{SecondsFormat, Utc};
use std::path::PathBuf;
use walkdir::WalkDir;

use crate::db;
use crate::models::{ScanResult, SessionRecord, SessionSource, SourceStatus};
use crate::parsers::{claude::parse_claude_file, codex::parse_codex_file};
use crate::util::stable_id;

fn home_path(parts: &[&str]) -> PathBuf {
    let mut path = dirs::home_dir().unwrap_or_else(|| PathBuf::from("/"));
    for part in parts {
        path.push(part);
    }
    path
}

fn source_paths() -> Vec<(SessionSource, Vec<PathBuf>)> {
    vec![
        (
            SessionSource::Codex,
            vec![
                home_path(&[".codex", "sessions"]),
                home_path(&[".codex", "archived_sessions"]),
            ],
        ),
        (
            SessionSource::Claude,
            vec![home_path(&[".claude", "projects"]), home_path(&[".claude"])],
        ),
    ]
}

pub fn source_status_paths() -> Vec<(SessionSource, String)> {
    source_paths()
        .into_iter()
        .map(|(source, paths)| {
            (
                source,
                paths
                    .iter()
                    .map(|path| path.display().to_string())
                    .collect::<Vec<_>>()
                    .join(", "),
            )
        })
        .collect()
}

fn collect_jsonl(paths: &[PathBuf]) -> Vec<PathBuf> {
    let mut files = Vec::new();
    for root in paths {
        if !root.exists() {
            continue;
        }
        for entry in WalkDir::new(root)
            .follow_links(false)
            .into_iter()
            .filter_entry(|entry| {
                let name = entry.file_name().to_string_lossy();
                name != "node_modules" && name != ".git"
            })
            .filter_map(Result::ok)
        {
            let path = entry.path();
            if path.is_file() && path.extension().and_then(|ext| ext.to_str()) == Some("jsonl") {
                files.push(path.to_path_buf());
            }
        }
    }
    files.sort();
    files.dedup();
    files
}

fn scan_source(
    source: SessionSource,
    paths: &[PathBuf],
) -> anyhow::Result<(usize, usize, usize, String)> {
    let started_at = Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true);
    let files = collect_jsonl(paths);
    let mut sessions = Vec::<SessionRecord>::new();
    let mut errors = 0_usize;
    let mut error_messages = Vec::new();

    for file in &files {
        let parsed = match source {
            SessionSource::Codex => {
                parse_codex_file(file).map(|session| session.into_iter().collect::<Vec<_>>())
            }
            SessionSource::Claude => parse_claude_file(file),
        };

        match parsed {
            Ok(mut found) => sessions.append(&mut found),
            Err(error) => {
                errors += 1;
                if error_messages.len() < 5 {
                    error_messages.push(format!("{}: {error}", file.display()));
                }
            }
        }
    }

    let sessions_found = sessions.len();
    db::upsert_sessions(&sessions)?;
    let finished_at = Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true);
    db::record_scan_run(
        &format!("{}:{}", source.as_str(), stable_id(&started_at)),
        source,
        &started_at,
        &finished_at,
        files.len(),
        sessions_found,
        errors,
        &error_messages.join("\n"),
    )?;

    Ok((files.len(), sessions_found, errors, finished_at))
}

pub fn source_status() -> anyhow::Result<Vec<SourceStatus>> {
    db::source_status(&source_status_paths())
}

pub fn scan_sources() -> anyhow::Result<ScanResult> {
    db::init()?;
    let started_at = Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true);
    let mut files_scanned = 0_usize;
    let mut sessions_found = 0_usize;
    let mut errors = 0_usize;
    let mut finished_at = started_at.clone();

    for (source, paths) in source_paths() {
        let (files, sessions, source_errors, source_finished_at) = scan_source(source, &paths)?;
        files_scanned += files;
        sessions_found += sessions;
        errors += source_errors;
        finished_at = source_finished_at;
    }

    Ok(ScanResult {
        started_at,
        finished_at,
        files_scanned,
        sessions_found,
        errors,
        source_status: source_status()?,
    })
}
