use chrono::{DateTime, Duration, SecondsFormat, Utc};
use regex::Regex;
use std::collections::BTreeSet;
use std::path::{Path, PathBuf};
use std::process::Command;

use crate::models::{
    CiSignal, CiStatus, DeliveryCommit, DeliveryIntegration, DeliveryLink, IssueLink,
    LinkConfidence, MergeStatus, PullRequestLink, TestCommandRecord, TestCommandStatus,
};

#[derive(Debug, Clone)]
pub struct GitInfo {
    pub root: PathBuf,
    pub branch: Option<String>,
    pub dirty: bool,
    pub changed_files: Vec<String>,
}

fn run_git(cwd: &Path, args: &[&str]) -> Option<String> {
    let output = Command::new("git")
        .args(args)
        .current_dir(cwd)
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }
    let value = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if value.is_empty() {
        None
    } else {
        Some(value)
    }
}

fn run_git_status(cwd: &Path, args: &[&str]) -> Option<bool> {
    let status = Command::new("git")
        .args(args)
        .current_dir(cwd)
        .status()
        .ok()?;
    Some(status.success())
}

pub fn git_info(cwd: &Path) -> GitInfo {
    if !cwd.exists() {
        return GitInfo {
            root: cwd.to_path_buf(),
            branch: None,
            dirty: false,
            changed_files: Vec::new(),
        };
    }

    let root = run_git(cwd, &["rev-parse", "--show-toplevel"])
        .map(PathBuf::from)
        .unwrap_or_else(|| cwd.to_path_buf());
    let branch = run_git(cwd, &["branch", "--show-current"]);
    let status = run_git(cwd, &["status", "--porcelain"]);
    let dirty = status.is_some();
    let changed_files = status
        .map(|status| {
            status
                .lines()
                .filter_map(|line| line.get(3..).map(str::trim))
                .filter(|file| !file.is_empty())
                .map(ToString::to_string)
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();

    GitInfo {
        root,
        branch,
        dirty,
        changed_files,
    }
}

fn unique_files(files: impl IntoIterator<Item = String>) -> Vec<String> {
    files
        .into_iter()
        .map(|file| file.trim().to_string())
        .filter(|file| !file.is_empty())
        .collect::<BTreeSet<_>>()
        .into_iter()
        .take(60)
        .collect()
}

fn parse_git_time(value: &str) -> Option<DateTime<Utc>> {
    DateTime::parse_from_rfc3339(value)
        .ok()
        .map(|value| value.with_timezone(&Utc))
}

fn git_log_window(cwd: &Path, started_at: &str, ended_at: Option<&str>) -> Vec<DeliveryCommit> {
    let Some(start) = parse_git_time(started_at) else {
        return Vec::new();
    };
    let end = ended_at
        .and_then(parse_git_time)
        .unwrap_or(start + Duration::hours(1))
        + Duration::hours(12);
    let since = start.to_rfc3339_opts(SecondsFormat::Secs, true);
    let until = end.to_rfc3339_opts(SecondsFormat::Secs, true);
    let Some(raw) = run_git(
        cwd,
        &[
            "log",
            "--max-count=20",
            "--name-only",
            "--pretty=format:%x1e%H%x1f%cI%x1f%s",
            "--since",
            &since,
            "--until",
            &until,
        ],
    ) else {
        return Vec::new();
    };

    raw.split('\u{1e}')
        .filter_map(|record| {
            let mut lines = record.lines();
            let header = lines.next()?.trim();
            if header.is_empty() {
                return None;
            }
            let mut parts = header.split('\u{1f}');
            let hash = parts.next()?.to_string();
            let committed_at = parts.next()?.to_string();
            let title = parts.next().unwrap_or_default().to_string();
            let files = unique_files(lines.map(ToString::to_string));
            let merged_to_default_branch = default_branches(cwd).into_iter().find_map(|branch| {
                run_git_status(cwd, &["merge-base", "--is-ancestor", &hash, &branch])
            });
            Some(DeliveryCommit {
                hash,
                title,
                committed_at,
                files,
                merged_to_default_branch,
            })
        })
        .collect()
}

fn default_branches(cwd: &Path) -> Vec<String> {
    let mut branches = vec![
        "origin/main".to_string(),
        "main".to_string(),
        "origin/master".to_string(),
        "master".to_string(),
    ];
    if let Some(remote_head) = run_git(
        cwd,
        &[
            "symbolic-ref",
            "--quiet",
            "--short",
            "refs/remotes/origin/HEAD",
        ],
    ) {
        branches.insert(0, remote_head);
    }
    branches
}

fn github_base_url(remote: &str) -> Option<String> {
    let remote = remote.trim_end_matches(".git");
    if let Some(rest) = remote.strip_prefix("git@github.com:") {
        return Some(format!("https://github.com/{rest}"));
    }
    if let Some(rest) = remote.strip_prefix("https://github.com/") {
        return Some(format!("https://github.com/{rest}"));
    }
    if let Some(rest) = remote.strip_prefix("ssh://git@github.com/") {
        return Some(format!("https://github.com/{rest}"));
    }
    None
}

fn text_corpus(
    branch: Option<&str>,
    summary: &str,
    note: &str,
    commits: &[DeliveryCommit],
) -> String {
    let mut parts = Vec::new();
    if let Some(branch) = branch {
        parts.push(branch.to_string());
    }
    parts.push(summary.to_string());
    parts.push(note.to_string());
    parts.extend(commits.iter().map(|commit| commit.title.clone()));
    parts.join(" ")
}

fn infer_pull_request(
    cwd: &Path,
    branch: Option<&str>,
    commits: &[DeliveryCommit],
    summary: &str,
    note: &str,
) -> Option<PullRequestLink> {
    let remote = run_git(cwd, &["remote", "get-url", "origin"])?;
    let base_url = github_base_url(&remote)?;
    let corpus = text_corpus(branch, summary, note, commits);
    let pr_regex = Regex::new(r"(?i)(?:pr|pull request)\s*#?(\d+)|\(#(\d+)\)").ok()?;
    let number = pr_regex.captures(&corpus).and_then(|capture| {
        capture
            .get(1)
            .or_else(|| capture.get(2))
            .and_then(|value| value.as_str().parse::<i64>().ok())
    });
    let branch_name = branch.map(ToString::to_string);
    let url = number
        .map(|value| format!("{base_url}/pull/{value}"))
        .or_else(|| {
            branch
                .filter(|value| {
                    !matches!(*value, "main" | "master" | "trunk") && !value.trim().is_empty()
                })
                .map(|value| format!("{base_url}/compare/main...{value}"))
        });
    let merge_status = if commits
        .iter()
        .any(|commit| commit.merged_to_default_branch == Some(true))
    {
        MergeStatus::Merged
    } else if commits
        .iter()
        .any(|commit| commit.merged_to_default_branch == Some(false))
    {
        MergeStatus::NotMerged
    } else {
        MergeStatus::Unknown
    };

    url.map(|url| PullRequestLink {
        provider: "github".to_string(),
        number,
        url: Some(url),
        branch: branch_name,
        status: if number.is_some() {
            LinkConfidence::Inferred
        } else {
            LinkConfidence::Unknown
        },
        merge_status,
        source: "local_git".to_string(),
    })
}

fn infer_issues(
    cwd: &Path,
    branch: Option<&str>,
    commits: &[DeliveryCommit],
    summary: &str,
    note: &str,
) -> Vec<IssueLink> {
    let corpus = text_corpus(branch, summary, note, commits);
    let mut issues = Vec::new();
    let mut seen = BTreeSet::new();

    if let Ok(jira_regex) = Regex::new(r"\b([A-Z][A-Z0-9]{1,9}-\d+)\b") {
        for capture in jira_regex.captures_iter(&corpus) {
            let key = capture[1].to_string();
            if seen.insert(format!("linear-jira:{key}")) {
                issues.push(IssueLink {
                    provider: "linear_or_jira".to_string(),
                    key,
                    url: None,
                    status: LinkConfidence::Inferred,
                    source: "local_text".to_string(),
                });
            }
        }
    }

    let github_base =
        run_git(cwd, &["remote", "get-url", "origin"]).and_then(|remote| github_base_url(&remote));
    if let (Some(base_url), Ok(issue_regex)) = (
        github_base,
        Regex::new(r"(?i)(?:issue|fixes|closes)\s+#(\d+)"),
    ) {
        for capture in issue_regex.captures_iter(&corpus) {
            let key = format!("#{}", &capture[1]);
            if seen.insert(format!("github:{key}")) {
                issues.push(IssueLink {
                    provider: "github".to_string(),
                    key: key.clone(),
                    url: Some(format!("{base_url}/issues/{}", &capture[1])),
                    status: LinkConfidence::Inferred,
                    source: "local_text".to_string(),
                });
            }
        }
    }

    issues
}

fn ci_signal(test_commands: &[TestCommandRecord]) -> CiSignal {
    if let Some(failed) = test_commands
        .iter()
        .find(|command| command.status == TestCommandStatus::Failed)
    {
        return CiSignal {
            status: CiStatus::Failed,
            source: failed.source.clone(),
            command: Some(failed.command.clone()),
        };
    }
    if let Some(passed) = test_commands
        .iter()
        .find(|command| command.status == TestCommandStatus::Passed)
    {
        return CiSignal {
            status: CiStatus::Passed,
            source: passed.source.clone(),
            command: Some(passed.command.clone()),
        };
    }
    if let Some(first) = test_commands.first() {
        return CiSignal {
            status: CiStatus::Unknown,
            source: first.source.clone(),
            command: Some(first.command.clone()),
        };
    }
    CiSignal::default()
}

fn diff_summary(
    dirty_files: &[String],
    diff_stat: Option<String>,
    commits: &[DeliveryCommit],
) -> String {
    let mut parts = Vec::new();
    if !dirty_files.is_empty() {
        parts.push(format!(
            "{} dirty file(s): {}",
            dirty_files.len(),
            dirty_files
                .iter()
                .take(5)
                .cloned()
                .collect::<Vec<_>>()
                .join(", ")
        ));
    }
    if let Some(stat) = diff_stat.filter(|value| !value.trim().is_empty()) {
        parts.push(format!("Diff: {stat}"));
    }
    if !commits.is_empty() {
        parts.push(format!("{} commit(s) near session window", commits.len()));
    }
    parts.join(". ")
}

pub fn delivery_link(
    cwd: &Path,
    started_at: &str,
    ended_at: Option<&str>,
    file_hints: &[String],
    test_commands: Vec<TestCommandRecord>,
    summary: &str,
    note: &str,
) -> DeliveryLink {
    if !cwd.exists() {
        return DeliveryLink {
            changed_files: unique_files(file_hints.iter().cloned()),
            test_commands,
            confidence: 0.15,
            ..DeliveryLink::default()
        };
    }

    let git = git_info(cwd);
    let commits = git_log_window(&git.root, started_at, ended_at);
    let commit_files = commits
        .iter()
        .flat_map(|commit| commit.files.clone())
        .collect::<Vec<_>>();
    let changed_files = unique_files(
        file_hints
            .iter()
            .cloned()
            .chain(git.changed_files.iter().cloned())
            .chain(commit_files),
    );
    let hint_set = file_hints.iter().cloned().collect::<BTreeSet<_>>();
    let file_overlap = commits
        .iter()
        .flat_map(|commit| commit.files.iter())
        .any(|file| hint_set.contains(file));
    let committed_after_session = !commits.is_empty();
    let absorbed = committed_after_session && (!git.dirty || file_overlap);
    let diff_stat = run_git(&git.root, &["diff", "--shortstat"])
        .or_else(|| run_git(&git.root, &["diff", "--cached", "--shortstat"]));
    let integration = DeliveryIntegration {
        pull_request: infer_pull_request(&git.root, git.branch.as_deref(), &commits, summary, note),
        issues: infer_issues(&git.root, git.branch.as_deref(), &commits, summary, note),
        ci: ci_signal(&test_commands),
        review_comment_count: None,
        attribution_confidence: if committed_after_session && file_overlap {
            0.82
        } else if committed_after_session {
            0.64
        } else if !test_commands.is_empty() || !changed_files.is_empty() {
            0.46
        } else {
            0.20
        },
    };
    let confidence = if committed_after_session && file_overlap {
        0.86
    } else if committed_after_session {
        0.68
    } else if git.dirty || !changed_files.is_empty() {
        0.52
    } else {
        0.25
    };

    DeliveryLink {
        diff_summary: diff_summary(&git.changed_files, diff_stat, &commits),
        changed_files,
        commits,
        committed_after_session,
        dirty_after_session: git.dirty,
        absorbed,
        test_commands,
        confidence,
        integration,
    }
}
