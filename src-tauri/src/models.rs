use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SessionSource {
    Codex,
    Claude,
}

impl SessionSource {
    pub fn as_str(self) -> &'static str {
        match self {
            SessionSource::Codex => "codex",
            SessionSource::Claude => "claude",
        }
    }
}

impl TryFrom<&str> for SessionSource {
    type Error = anyhow::Error;

    fn try_from(value: &str) -> Result<Self, Self::Error> {
        match value {
            "codex" => Ok(SessionSource::Codex),
            "claude" => Ok(SessionSource::Claude),
            other => anyhow::bail!("unknown session source: {other}"),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SessionStatus {
    Unknown,
    Useful,
    NeedsReview,
    NeedsRepair,
    Repaired,
    Failed,
    Discarded,
}

impl SessionStatus {
    pub fn as_str(self) -> &'static str {
        match self {
            SessionStatus::Unknown => "unknown",
            SessionStatus::Useful => "useful",
            SessionStatus::NeedsReview => "needs_review",
            SessionStatus::NeedsRepair => "needs_repair",
            SessionStatus::Repaired => "repaired",
            SessionStatus::Failed => "failed",
            SessionStatus::Discarded => "discarded",
        }
    }
}

impl TryFrom<&str> for SessionStatus {
    type Error = anyhow::Error;

    fn try_from(value: &str) -> Result<Self, Self::Error> {
        match value {
            "unknown" => Ok(SessionStatus::Unknown),
            "useful" => Ok(SessionStatus::Useful),
            "needs_review" => Ok(SessionStatus::NeedsReview),
            "needs_repair" => Ok(SessionStatus::NeedsRepair),
            "repaired" => Ok(SessionStatus::Repaired),
            "failed" => Ok(SessionStatus::Failed),
            "discarded" => Ok(SessionStatus::Discarded),
            other => anyhow::bail!("unknown session status: {other}"),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum TimeFieldState {
    Estimated,
    Manual,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TimeFields {
    pub prompting: TimeFieldState,
    pub waiting: TimeFieldState,
    pub review: TimeFieldState,
    pub repair: TimeFieldState,
}

impl Default for TimeFields {
    fn default() -> Self {
        Self {
            prompting: TimeFieldState::Estimated,
            waiting: TimeFieldState::Estimated,
            review: TimeFieldState::Estimated,
            repair: TimeFieldState::Estimated,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionRecord {
    pub id: String,
    pub source: SessionSource,
    pub source_session_id: String,
    pub project_name: String,
    pub project_path: String,
    pub cwd: String,
    pub started_at: String,
    pub ended_at: Option<String>,
    pub duration_seconds: i64,
    pub user_message_count: i64,
    pub assistant_message_count: i64,
    pub tool_call_count: i64,
    pub token_count: Option<i64>,
    pub cost_amount: Option<f64>,
    pub status: SessionStatus,
    pub status_updated_at: Option<String>,
    pub note: String,
    pub confidence: f64,
    pub changed_files: Vec<String>,
    pub prompting_seconds: i64,
    pub waiting_seconds: i64,
    pub review_seconds: i64,
    pub repair_seconds: i64,
    pub review_started_at: Option<String>,
    pub time_fields: TimeFields,
    pub summary: String,
    pub source_file: String,
    pub git_branch: Option<String>,
    pub git_dirty: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct SessionPatch {
    pub status: Option<SessionStatus>,
    pub note: Option<String>,
    pub prompting_seconds: Option<i64>,
    pub waiting_seconds: Option<i64>,
    pub review_seconds: Option<i64>,
    pub repair_seconds: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectSummary {
    pub name: String,
    pub path: String,
    pub session_count: usize,
    pub started_at: String,
    pub ended_at: Option<String>,
    pub active_seconds: i64,
    pub sources: Vec<SessionSource>,
    pub is_parallel: bool,
    pub git_branch: Option<String>,
    pub git_dirty: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct OverlapInterval {
    pub started_at: String,
    pub ended_at: String,
    pub seconds: i64,
    pub session_ids: Vec<String>,
    pub project_names: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DayMetrics {
    pub date: String,
    pub project_count: usize,
    pub session_count: usize,
    pub ai_waiting_seconds_estimated: i64,
    pub prompting_seconds_estimated: i64,
    pub review_seconds_estimated: i64,
    pub repair_seconds_estimated: i64,
    pub parallel_seconds: i64,
    pub max_concurrent_sessions: usize,
    pub max_concurrent_projects: usize,
    pub unknown_count: usize,
    pub needs_review_count: usize,
    pub needs_repair_count: usize,
    pub generated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DayLedger {
    pub metrics: DayMetrics,
    pub projects: Vec<ProjectSummary>,
    pub sessions: Vec<SessionRecord>,
    pub overlaps: Vec<OverlapInterval>,
    pub session_overlaps: Vec<OverlapInterval>,
    pub source_status: Vec<SourceStatus>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceStatus {
    pub source: SessionSource,
    pub enabled: bool,
    pub path: String,
    pub files_scanned: usize,
    pub sessions_found: usize,
    pub errors: usize,
    pub last_scan_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceConfig {
    pub source: SessionSource,
    pub enabled: bool,
    pub paths: Vec<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
pub enum LanguageSetting {
    #[default]
    #[serde(rename = "system")]
    System,
    #[serde(rename = "en")]
    En,
    #[serde(rename = "zh-CN")]
    ZhCn,
}

impl LanguageSetting {
    pub fn as_str(self) -> &'static str {
        match self {
            LanguageSetting::System => "system",
            LanguageSetting::En => "en",
            LanguageSetting::ZhCn => "zh-CN",
        }
    }
}

impl TryFrom<&str> for LanguageSetting {
    type Error = anyhow::Error;

    fn try_from(value: &str) -> Result<Self, Self::Error> {
        match value {
            "system" => Ok(LanguageSetting::System),
            "en" => Ok(LanguageSetting::En),
            "zh-CN" => Ok(LanguageSetting::ZhCn),
            other => anyhow::bail!("unknown language setting: {other}"),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub onboarding_completed: bool,
    pub source_configs: Vec<SourceConfig>,
    pub project_roots: Vec<String>,
    #[serde(default)]
    pub language: LanguageSetting,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanResult {
    pub started_at: String,
    pub finished_at: String,
    pub files_scanned: usize,
    pub sessions_found: usize,
    pub errors: usize,
    pub source_status: Vec<SourceStatus>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReportResult {
    pub markdown: String,
    pub exported_path: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn app_settings_defaults_language_for_existing_payloads() {
        let settings: AppSettings = serde_json::from_value(json!({
            "onboardingCompleted": true,
            "sourceConfigs": [],
            "projectRoots": []
        }))
        .expect("settings deserialize");

        assert_eq!(settings.language, LanguageSetting::System);
    }

    #[test]
    fn app_settings_accepts_saved_language() {
        let settings: AppSettings = serde_json::from_value(json!({
            "onboardingCompleted": true,
            "sourceConfigs": [],
            "projectRoots": [],
            "language": "zh-CN"
        }))
        .expect("settings deserialize");

        assert_eq!(settings.language, LanguageSetting::ZhCn);
    }
}
