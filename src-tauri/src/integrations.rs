use serde_json::{json, Value};
use std::path::Path;
use std::process::Command;
use std::time::Duration;

use crate::credentials;
use crate::db;
use crate::models::{
    CiSignal, CiStatus, DiagnosticDetail, DiagnosticLevel, IntegrationDiagnosticsResult,
    IntegrationProviderSync, IntegrationSyncResult, IssueLink, LinkConfidence, MergeStatus,
    ProviderDiagnostics, PullRequestLink, RemoteIntegrationConfig, SessionRecord,
};

const GITHUB_API: &str = "https://api.github.com";
const LINEAR_GRAPHQL: &str = "https://api.linear.app/graphql";

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct GitHubRepo {
    owner: String,
    repo: String,
}

struct GitHubClient<'a> {
    agent: &'a ureq::Agent,
    token: &'a str,
}

struct LinearClient<'a> {
    agent: &'a ureq::Agent,
    token: &'a str,
}

pub fn sync_integrations() -> anyhow::Result<IntegrationSyncResult> {
    let started_at = now_utc();
    let settings = db::get_settings()?.integration_settings;
    let mut sessions = db::all_sessions()?;
    let github_token = credentials::get_token("github")?;
    let linear_token = credentials::get_token("linear")?;

    let github_ready = provider_ready(&settings.github, github_token.as_deref());
    let linear_ready = provider_ready(&settings.linear, linear_token.as_deref());
    let mut github = provider_start(&settings.github, github_token.as_deref(), "GitHub");
    let mut linear = provider_start(&settings.linear, linear_token.as_deref(), "Linear");
    let mut sessions_updated = 0;

    if github_ready || linear_ready {
        let agent = ureq::AgentBuilder::new()
            .timeout_connect(Duration::from_secs(10))
            .timeout_read(Duration::from_secs(30))
            .timeout_write(Duration::from_secs(30))
            .build();
        let github_client = GitHubClient {
            agent: &agent,
            token: github_token.as_deref().unwrap_or_default(),
        };
        let linear_client = LinearClient {
            agent: &agent,
            token: linear_token.as_deref().unwrap_or_default(),
        };

        for session in &mut sessions {
            let original_delivery = session.delivery.clone();
            if github_ready {
                match sync_github_session(&github_client, session) {
                    Ok(linked) => github.linked += linked,
                    Err(error) => record_provider_error(&mut github, error),
                }
            }
            if linear_ready {
                match sync_linear_session(&linear_client, session) {
                    Ok(linked) => linear.linked += linked,
                    Err(error) => record_provider_error(&mut linear, error),
                }
            }
            if session.delivery != original_delivery {
                db::update_session_delivery(&session.id, &session.delivery)?;
                sessions_updated += 1;
            }
        }
    }

    finish_provider_message(&mut github, "GitHub");
    finish_provider_message(&mut linear, "Linear");

    Ok(IntegrationSyncResult {
        started_at,
        finished_at: now_utc(),
        github,
        linear,
        sessions_updated,
    })
}

pub fn diagnose_integrations() -> anyhow::Result<IntegrationDiagnosticsResult> {
    let settings = db::get_settings()?.integration_settings;
    let sessions = db::all_sessions()?;
    let github_token = credentials::get_token("github")?;
    let linear_token = credentials::get_token("linear")?;
    let agent = ureq::AgentBuilder::new()
        .timeout_connect(Duration::from_secs(10))
        .timeout_read(Duration::from_secs(30))
        .timeout_write(Duration::from_secs(30))
        .build();

    Ok(IntegrationDiagnosticsResult {
        checked_at: now_utc(),
        github: diagnose_github(&agent, &settings.github, github_token.as_deref(), &sessions),
        linear: diagnose_linear(&agent, &settings.linear, linear_token.as_deref(), &sessions),
    })
}

fn provider_ready(config: &RemoteIntegrationConfig, token: Option<&str>) -> bool {
    config.enabled && token.is_some_and(|token| !token.trim().is_empty())
}

fn provider_start(
    config: &RemoteIntegrationConfig,
    token: Option<&str>,
    label: &str,
) -> IntegrationProviderSync {
    if !config.enabled {
        return IntegrationProviderSync {
            enabled: false,
            attempted: false,
            linked: 0,
            errors: 0,
            message: format!("{label} disabled"),
        };
    }
    if token.is_none_or(|token| token.trim().is_empty()) {
        return IntegrationProviderSync {
            enabled: true,
            attempted: false,
            linked: 0,
            errors: 0,
            message: format!("{label} token missing"),
        };
    }
    IntegrationProviderSync::attempted(true)
}

fn detail(
    level: DiagnosticLevel,
    label: impl Into<String>,
    value: impl Into<String>,
) -> DiagnosticDetail {
    DiagnosticDetail {
        level,
        label: label.into(),
        value: value.into(),
    }
}

fn diagnose_github(
    agent: &ureq::Agent,
    config: &RemoteIntegrationConfig,
    token: Option<&str>,
    sessions: &[SessionRecord],
) -> ProviderDiagnostics {
    if !config.enabled {
        return ProviderDiagnostics::disabled("GitHub");
    }
    let Some(token) = token.filter(|token| !token.trim().is_empty()) else {
        return ProviderDiagnostics {
            enabled: true,
            credential_present: false,
            ok: false,
            message: "GitHub token missing".to_string(),
            details: vec![detail(
                DiagnosticLevel::Error,
                "Credential",
                "No GitHub token in Keychain",
            )],
        };
    };

    let client = GitHubClient { agent, token };
    let mut details = Vec::new();
    let (parsed, missing) = github_repo_counts(sessions);
    details.push(detail(
        DiagnosticLevel::Info,
        "Repos parsed",
        format!("{parsed} parsed, {missing} missing or unsupported"),
    ));

    match github_rate_limit(&client) {
        Ok((remaining, scopes)) => {
            details.push(detail(DiagnosticLevel::Success, "GitHub API", "reachable"));
            details.push(detail(
                DiagnosticLevel::Info,
                "Rate limit remaining",
                remaining.unwrap_or_else(|| "unknown".to_string()),
            ));
            details.push(detail(
                DiagnosticLevel::Info,
                "OAuth scopes",
                scopes.unwrap_or_else(|| "unknown".to_string()),
            ));
            ProviderDiagnostics {
                enabled: true,
                credential_present: true,
                ok: true,
                message: "GitHub diagnostics passed".to_string(),
                details,
            }
        }
        Err(error) => {
            details.push(detail(DiagnosticLevel::Error, "GitHub API", error));
            ProviderDiagnostics {
                enabled: true,
                credential_present: true,
                ok: false,
                message: "GitHub diagnostics failed".to_string(),
                details,
            }
        }
    }
}

fn diagnose_linear(
    agent: &ureq::Agent,
    config: &RemoteIntegrationConfig,
    token: Option<&str>,
    sessions: &[SessionRecord],
) -> ProviderDiagnostics {
    if !config.enabled {
        return ProviderDiagnostics::disabled("Linear");
    }
    let Some(token) = token.filter(|token| !token.trim().is_empty()) else {
        return ProviderDiagnostics {
            enabled: true,
            credential_present: false,
            ok: false,
            message: "Linear token missing".to_string(),
            details: vec![detail(
                DiagnosticLevel::Error,
                "Credential",
                "No Linear API key in Keychain",
            )],
        };
    };

    let client = LinearClient { agent, token };
    let mut details = Vec::new();
    let issue_keys = linear_issue_keys(sessions);
    details.push(detail(
        DiagnosticLevel::Info,
        "Issue keys",
        format!("{} local key(s)", issue_keys.len()),
    ));

    match linear_viewer(&client) {
        Ok(viewer) => {
            details.push(detail(DiagnosticLevel::Success, "Linear API", viewer));
            if let Some(sample) = issue_keys.first() {
                match linear_issue(&client, sample) {
                    Ok(Some(issue)) => details.push(detail(
                        DiagnosticLevel::Success,
                        "Sample issue",
                        format!(
                            "{}{}",
                            sample,
                            issue
                                .state
                                .map(|state| format!(" · {state}"))
                                .unwrap_or_default()
                        ),
                    )),
                    Ok(None) => details.push(detail(
                        DiagnosticLevel::Warning,
                        "Sample issue",
                        format!("{sample} not found"),
                    )),
                    Err(error) => {
                        details.push(detail(DiagnosticLevel::Warning, "Sample issue", error))
                    }
                }
            }
            ProviderDiagnostics {
                enabled: true,
                credential_present: true,
                ok: true,
                message: "Linear diagnostics passed".to_string(),
                details,
            }
        }
        Err(error) => {
            details.push(detail(DiagnosticLevel::Error, "Linear API", error));
            ProviderDiagnostics {
                enabled: true,
                credential_present: true,
                ok: false,
                message: "Linear diagnostics failed".to_string(),
                details,
            }
        }
    }
}

fn record_provider_error(provider: &mut IntegrationProviderSync, error: String) {
    provider.errors += 1;
    if provider.message.is_empty() {
        provider.message = error;
    }
}

fn finish_provider_message(provider: &mut IntegrationProviderSync, label: &str) {
    if !provider.attempted {
        return;
    }
    provider.message = if provider.errors == 0 {
        format!("{label} linked {} remote signal(s)", provider.linked)
    } else if provider.message.is_empty() {
        format!(
            "{label} linked {} remote signal(s), {} error(s)",
            provider.linked, provider.errors
        )
    } else {
        format!(
            "{label} linked {} remote signal(s), {} error(s): {}",
            provider.linked, provider.errors, provider.message
        )
    };
}

fn now_utc() -> String {
    chrono::Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true)
}

fn sync_github_session(
    client: &GitHubClient<'_>,
    session: &mut SessionRecord,
) -> Result<usize, String> {
    let Some(repo) = github_repo_for_session(session) else {
        return Ok(0);
    };
    let mut linked = 0;

    if let Some(pull_request) = find_github_pull_request(client, &repo, session)? {
        session.delivery.integration.pull_request = Some(pull_request);
        linked += 1;
    }

    if let Some(number) = session
        .delivery
        .integration
        .pull_request
        .as_ref()
        .and_then(|pull_request| pull_request.number)
    {
        if let Some(count) = github_review_comment_count(client, &repo, number)? {
            session.delivery.integration.review_comment_count = Some(count);
            linked += 1;
        }
    }

    if let Some(commit) = session.delivery.commits.first() {
        if let Some(signal) = github_workflow_run(client, &repo, &commit.hash)? {
            session.delivery.integration.ci = signal;
            linked += 1;
        }
    }

    linked += sync_github_issues(client, &repo, &mut session.delivery.integration.issues)?;

    if linked > 0 {
        boost_attribution(session, 0.92);
    }
    Ok(linked)
}

fn sync_linear_session(
    client: &LinearClient<'_>,
    session: &mut SessionRecord,
) -> Result<usize, String> {
    let mut linked = 0;
    for issue in &mut session.delivery.integration.issues {
        if !is_linear_issue_key(&issue.key) {
            continue;
        }
        if let Some(remote_issue) = linear_issue(client, &issue.key)? {
            issue.provider = "linear".to_string();
            issue.url = remote_issue.url;
            issue.title = remote_issue.title;
            issue.state = remote_issue.state;
            issue.status = LinkConfidence::Confirmed;
            issue.source = "linear_api".to_string();
            linked += 1;
        }
    }
    if linked > 0 {
        boost_attribution(session, 0.88);
    }
    Ok(linked)
}

fn boost_attribution(session: &mut SessionRecord, value: f64) {
    session.delivery.integration.attribution_confidence = session
        .delivery
        .integration
        .attribution_confidence
        .max(value);
}

fn github_repo_for_session(session: &SessionRecord) -> Option<GitHubRepo> {
    [&session.project_path, &session.cwd]
        .into_iter()
        .filter_map(|path| origin_remote(Path::new(path)))
        .find_map(|remote| parse_github_remote(&remote))
}

fn origin_remote(cwd: &Path) -> Option<String> {
    if !cwd.exists() {
        return None;
    }
    let output = Command::new("git")
        .args(["remote", "get-url", "origin"])
        .current_dir(cwd)
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }
    let remote = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if remote.is_empty() {
        None
    } else {
        Some(remote)
    }
}

pub(crate) fn parse_github_remote(remote: &str) -> Option<GitHubRepo> {
    let remote = remote.trim().trim_end_matches('/');
    let remote = remote.trim_end_matches(".git");
    let path = remote
        .strip_prefix("git@github.com:")
        .or_else(|| remote.strip_prefix("https://github.com/"))
        .or_else(|| remote.strip_prefix("http://github.com/"))
        .or_else(|| remote.strip_prefix("ssh://git@github.com/"))?;
    let mut parts = path.split('/');
    let owner = parts.next()?.trim();
    let repo = parts.next()?.trim();
    if owner.is_empty() || repo.is_empty() || parts.next().is_some() {
        return None;
    }
    Some(GitHubRepo {
        owner: owner.to_string(),
        repo: repo.to_string(),
    })
}

fn find_github_pull_request(
    client: &GitHubClient<'_>,
    repo: &GitHubRepo,
    session: &SessionRecord,
) -> Result<Option<PullRequestLink>, String> {
    if let Some(number) = pull_request_number(session.delivery.integration.pull_request.as_ref()) {
        if let Some(value) = github_get(
            client,
            &format!("/repos/{}/{}/pulls/{number}", repo.owner, repo.repo),
        )? {
            return Ok(pull_request_from_github(&value));
        }
        return Ok(None);
    }

    let branch = session
        .delivery
        .integration
        .pull_request
        .as_ref()
        .and_then(|pull_request| pull_request.branch.as_deref())
        .or(session.git_branch.as_deref())
        .filter(|branch| !matches!(*branch, "main" | "master" | "trunk"))
        .filter(|branch| !branch.trim().is_empty());

    let Some(branch) = branch else {
        return Ok(None);
    };
    let head = encode_query_component(&format!("{}:{branch}", repo.owner));
    let path = format!(
        "/repos/{}/{}/pulls?state=all&head={head}&per_page=1",
        repo.owner, repo.repo
    );
    let Some(value) = github_get(client, &path)? else {
        return Ok(None);
    };
    Ok(value
        .as_array()
        .and_then(|items| items.first())
        .and_then(pull_request_from_github))
}

fn pull_request_number(pull_request: Option<&PullRequestLink>) -> Option<i64> {
    pull_request
        .and_then(|pull_request| pull_request.number)
        .or_else(|| {
            pull_request
                .and_then(|pull_request| pull_request.url.as_deref())
                .and_then(number_from_pull_request_url)
        })
}

fn number_from_pull_request_url(url: &str) -> Option<i64> {
    let marker = "/pull/";
    let index = url.find(marker)?;
    url[index + marker.len()..]
        .split(|character: char| !character.is_ascii_digit())
        .next()
        .and_then(|value| value.parse::<i64>().ok())
}

fn pull_request_from_github(value: &Value) -> Option<PullRequestLink> {
    let number = value.get("number")?.as_i64();
    let state = value
        .get("state")
        .and_then(Value::as_str)
        .map(ToString::to_string);
    let branch = value
        .pointer("/head/ref")
        .and_then(Value::as_str)
        .map(ToString::to_string);
    let merge_status = if value.get("merged").and_then(Value::as_bool) == Some(true)
        || value.get("merged_at").is_some_and(|value| !value.is_null())
    {
        MergeStatus::Merged
    } else if state.as_deref() == Some("open") {
        MergeStatus::NotMerged
    } else {
        MergeStatus::Unknown
    };

    Some(PullRequestLink {
        provider: "github".to_string(),
        number,
        url: value
            .get("html_url")
            .and_then(Value::as_str)
            .map(ToString::to_string),
        branch,
        state,
        status: LinkConfidence::Confirmed,
        merge_status,
        source: "github_api".to_string(),
    })
}

fn github_review_comment_count(
    client: &GitHubClient<'_>,
    repo: &GitHubRepo,
    number: i64,
) -> Result<Option<usize>, String> {
    github_get(
        client,
        &format!(
            "/repos/{}/{}/pulls/{number}/comments?per_page=100",
            repo.owner, repo.repo
        ),
    )
    .map(|value| value.and_then(|value| value.as_array().map(Vec::len)))
}

fn github_workflow_run(
    client: &GitHubClient<'_>,
    repo: &GitHubRepo,
    sha: &str,
) -> Result<Option<CiSignal>, String> {
    let path = format!(
        "/repos/{}/{}/actions/runs?head_sha={}&per_page=10",
        repo.owner,
        repo.repo,
        encode_query_component(sha)
    );
    let Some(value) = github_get(client, &path)? else {
        return Ok(None);
    };
    let Some(run) = value
        .get("workflow_runs")
        .and_then(Value::as_array)
        .and_then(|runs| runs.first())
    else {
        return Ok(None);
    };

    let status = run.get("status").and_then(Value::as_str);
    let conclusion = run.get("conclusion").and_then(Value::as_str);
    let ci_status = match (status, conclusion) {
        (Some("completed"), Some("success")) => CiStatus::Passed,
        (Some("completed"), Some("failure" | "timed_out" | "cancelled" | "action_required")) => {
            CiStatus::Failed
        }
        (Some("in_progress" | "queued" | "requested" | "waiting" | "pending"), _) => {
            CiStatus::Running
        }
        _ => CiStatus::Unknown,
    };

    Ok(Some(CiSignal {
        status: ci_status,
        source: "github_actions".to_string(),
        command: run
            .get("name")
            .or_else(|| run.get("display_title"))
            .and_then(Value::as_str)
            .map(ToString::to_string),
    }))
}

fn sync_github_issues(
    client: &GitHubClient<'_>,
    repo: &GitHubRepo,
    issues: &mut [IssueLink],
) -> Result<usize, String> {
    let mut linked = 0;
    for issue in issues {
        let Some(number) = issue_number(&issue.key) else {
            continue;
        };
        let Some(value) = github_get(
            client,
            &format!("/repos/{}/{}/issues/{number}", repo.owner, repo.repo),
        )?
        else {
            continue;
        };
        issue.provider = "github".to_string();
        issue.url = value
            .get("html_url")
            .and_then(Value::as_str)
            .map(ToString::to_string);
        issue.title = value
            .get("title")
            .and_then(Value::as_str)
            .map(ToString::to_string);
        issue.state = value
            .get("state")
            .and_then(Value::as_str)
            .map(ToString::to_string);
        issue.status = LinkConfidence::Confirmed;
        issue.source = "github_api".to_string();
        linked += 1;
    }
    Ok(linked)
}

fn issue_number(key: &str) -> Option<i64> {
    key.strip_prefix('#')
        .and_then(|value| value.parse::<i64>().ok())
}

fn github_get(client: &GitHubClient<'_>, path: &str) -> Result<Option<Value>, String> {
    let url = format!("{GITHUB_API}{path}");
    let authorization = format!("Bearer {}", client.token);
    let request = client
        .agent
        .get(&url)
        .set("Accept", "application/vnd.github+json")
        .set("Authorization", &authorization)
        .set("User-Agent", "Sessionary")
        .set("X-GitHub-Api-Version", "2022-11-28");

    match request.call() {
        Ok(response) => response
            .into_json::<Value>()
            .map(Some)
            .map_err(|error| format!("GitHub invalid JSON: {error}")),
        Err(ureq::Error::Status(404, _)) => Ok(None),
        Err(ureq::Error::Status(status, response)) => {
            Err(format_http_error("GitHub", status, response))
        }
        Err(error) => Err(format!("GitHub request failed: {error}")),
    }
}

fn github_rate_limit(
    client: &GitHubClient<'_>,
) -> Result<(Option<String>, Option<String>), String> {
    let authorization = format!("Bearer {}", client.token);
    let request = client
        .agent
        .get(&format!("{GITHUB_API}/rate_limit"))
        .set("Accept", "application/vnd.github+json")
        .set("Authorization", &authorization)
        .set("User-Agent", "Sessionary")
        .set("X-GitHub-Api-Version", "2022-11-28");
    match request.call() {
        Ok(response) => {
            let remaining = response
                .header("x-ratelimit-remaining")
                .map(ToString::to_string)
                .or_else(|| {
                    response
                        .header("X-RateLimit-Remaining")
                        .map(ToString::to_string)
                });
            let scopes = response
                .header("x-oauth-scopes")
                .map(ToString::to_string)
                .or_else(|| response.header("X-OAuth-Scopes").map(ToString::to_string));
            Ok((remaining, scopes))
        }
        Err(ureq::Error::Status(status, response)) => {
            Err(format_http_error("GitHub", status, response))
        }
        Err(error) => Err(format!("GitHub request failed: {error}")),
    }
}

fn github_repo_counts(sessions: &[SessionRecord]) -> (usize, usize) {
    sessions.iter().fold((0, 0), |(parsed, missing), session| {
        if github_repo_for_session(session).is_some() {
            (parsed + 1, missing)
        } else {
            (parsed, missing + 1)
        }
    })
}

#[derive(Debug)]
struct RemoteIssue {
    url: Option<String>,
    title: Option<String>,
    state: Option<String>,
}

fn linear_issue(client: &LinearClient<'_>, key: &str) -> Result<Option<RemoteIssue>, String> {
    let body = json!({
        "query": r#"
            query Issue($id: String!) {
              issue(id: $id) {
                id
                identifier
                title
                url
                state {
                  name
                  type
                }
              }
            }
        "#,
        "variables": { "id": key }
    });
    let request = client
        .agent
        .post(LINEAR_GRAPHQL)
        .set("Accept", "application/json")
        .set("Content-Type", "application/json")
        .set("Authorization", client.token);
    let value = match request.send_json(body) {
        Ok(response) => response
            .into_json::<Value>()
            .map_err(|error| format!("Linear invalid JSON: {error}"))?,
        Err(ureq::Error::Status(404, _)) => return Ok(None),
        Err(ureq::Error::Status(status, response)) => {
            return Err(format_http_error("Linear", status, response));
        }
        Err(error) => return Err(format!("Linear request failed: {error}")),
    };

    if let Some(error) = value
        .get("errors")
        .and_then(Value::as_array)
        .and_then(|errors| errors.first())
        .and_then(|error| error.get("message"))
        .and_then(Value::as_str)
    {
        return Err(format!("Linear GraphQL error: {error}"));
    }

    let Some(issue) = value
        .pointer("/data/issue")
        .filter(|value| !value.is_null())
    else {
        return Ok(None);
    };

    Ok(Some(RemoteIssue {
        url: issue
            .get("url")
            .and_then(Value::as_str)
            .map(ToString::to_string),
        title: issue
            .get("title")
            .and_then(Value::as_str)
            .map(ToString::to_string),
        state: issue
            .pointer("/state/name")
            .and_then(Value::as_str)
            .map(ToString::to_string),
    }))
}

fn linear_viewer(client: &LinearClient<'_>) -> Result<String, String> {
    let body = json!({
        "query": r#"
            query Viewer {
              viewer {
                id
                name
              }
            }
        "#
    });
    let request = client
        .agent
        .post(LINEAR_GRAPHQL)
        .set("Accept", "application/json")
        .set("Content-Type", "application/json")
        .set("Authorization", client.token);
    let value = match request.send_json(body) {
        Ok(response) => response
            .into_json::<Value>()
            .map_err(|error| format!("Linear invalid JSON: {error}"))?,
        Err(ureq::Error::Status(status, response)) => {
            return Err(format_http_error("Linear", status, response));
        }
        Err(error) => return Err(format!("Linear request failed: {error}")),
    };
    if let Some(error) = value
        .get("errors")
        .and_then(Value::as_array)
        .and_then(|errors| errors.first())
        .and_then(|error| error.get("message"))
        .and_then(Value::as_str)
    {
        return Err(format!("Linear GraphQL error: {error}"));
    }
    let name = value
        .pointer("/data/viewer/name")
        .and_then(Value::as_str)
        .unwrap_or("viewer");
    Ok(format!("reachable as {name}"))
}

fn linear_issue_keys(sessions: &[SessionRecord]) -> Vec<String> {
    let mut keys = sessions
        .iter()
        .flat_map(|session| session.delivery.integration.issues.iter())
        .map(|issue| issue.key.clone())
        .filter(|key| is_linear_issue_key(key))
        .collect::<Vec<_>>();
    keys.sort();
    keys.dedup();
    keys
}

pub(crate) fn is_linear_issue_key(value: &str) -> bool {
    let Some((prefix, number)) = value.split_once('-') else {
        return false;
    };
    (2..=10).contains(&prefix.len())
        && prefix
            .chars()
            .all(|character| character.is_ascii_uppercase() || character.is_ascii_digit())
        && !number.is_empty()
        && number.chars().all(|character| character.is_ascii_digit())
}

fn encode_query_component(value: &str) -> String {
    value
        .bytes()
        .flat_map(|byte| match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                vec![byte as char]
            }
            other => format!("%{other:02X}").chars().collect::<Vec<_>>(),
        })
        .collect()
}

fn format_http_error(provider: &str, status: u16, response: ureq::Response) -> String {
    let body = response.into_string().unwrap_or_default();
    let detail = body
        .lines()
        .next()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .unwrap_or("no response body");
    format!("{provider} HTTP {status}: {detail}")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_github_remote_variants() {
        let cases = [
            "git@github.com:qmkCamel/sessionary.git",
            "https://github.com/qmkCamel/sessionary.git",
            "ssh://git@github.com/qmkCamel/sessionary",
        ];
        for remote in cases {
            let repo = parse_github_remote(remote).expect("repo parsed");
            assert_eq!(repo.owner, "qmkCamel");
            assert_eq!(repo.repo, "sessionary");
        }
        assert!(parse_github_remote("https://gitlab.com/qmkCamel/sessionary").is_none());
    }

    #[test]
    fn accepts_linear_issue_identifiers() {
        assert!(is_linear_issue_key("ABC-123"));
        assert!(is_linear_issue_key("A1BC-98765"));
        assert!(!is_linear_issue_key("abc-123"));
        assert!(!is_linear_issue_key("#123"));
        assert!(!is_linear_issue_key("A-123"));
    }

    #[test]
    fn collects_unique_linear_issue_keys() {
        let mut session = SessionRecord {
            id: "s1".to_string(),
            source: crate::models::SessionSource::Codex,
            source_session_id: "s1".to_string(),
            project_name: "p".to_string(),
            project_path: "/tmp/p".to_string(),
            cwd: "/tmp/p".to_string(),
            started_at: "2026-05-22T00:00:00Z".to_string(),
            ended_at: None,
            duration_seconds: 1,
            user_message_count: 0,
            assistant_message_count: 0,
            tool_call_count: 0,
            token_count: None,
            cost_amount: None,
            status: crate::models::SessionStatus::Unknown,
            status_updated_at: None,
            note: String::new(),
            confidence: 0.0,
            changed_files: Vec::new(),
            prompting_seconds: 0,
            waiting_seconds: 0,
            review_seconds: 0,
            repair_seconds: 0,
            review_started_at: None,
            repair_started_at: None,
            review_intervals: Vec::new(),
            repair_intervals: Vec::new(),
            time_fields: crate::models::TimeFields::default(),
            value: crate::models::SessionValue::default(),
            summary: String::new(),
            source_file: String::new(),
            git_branch: None,
            git_dirty: false,
            delivery: crate::models::DeliveryLink::default(),
        };
        session.delivery.integration.issues = vec![
            IssueLink {
                provider: "linear_or_jira".to_string(),
                key: "ABC-1".to_string(),
                url: None,
                title: None,
                state: None,
                status: LinkConfidence::Inferred,
                source: "test".to_string(),
            },
            IssueLink {
                provider: "linear_or_jira".to_string(),
                key: "ABC-1".to_string(),
                url: None,
                title: None,
                state: None,
                status: LinkConfidence::Inferred,
                source: "test".to_string(),
            },
        ];
        assert_eq!(linear_issue_keys(&[session]), vec!["ABC-1"]);
    }

    #[test]
    fn encodes_query_components() {
        assert_eq!(
            encode_query_component("qmkCamel:feature/github linear"),
            "qmkCamel%3Afeature%2Fgithub%20linear"
        );
    }
}
