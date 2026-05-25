use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Ord, PartialOrd, Serialize, Deserialize)]
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

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SessionValueCategory {
    HighValue,
    MixedValue,
    LowValue,
    NeedsHumanRepair,
    Discarded,
    Unreviewed,
}

impl SessionValueCategory {
    pub fn as_str(self) -> &'static str {
        match self {
            SessionValueCategory::HighValue => "high_value",
            SessionValueCategory::MixedValue => "mixed_value",
            SessionValueCategory::LowValue => "low_value",
            SessionValueCategory::NeedsHumanRepair => "needs_human_repair",
            SessionValueCategory::Discarded => "discarded",
            SessionValueCategory::Unreviewed => "unreviewed",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SessionValueReason {
    MarkedUseful,
    MarkedRepaired,
    HasFileHints,
    HasToolCalls,
    HasTokenUsage,
    LowCost,
    HighCost,
    HighHumanTime,
    HighRepairTime,
    NeedsReview,
    NeedsRepair,
    Discarded,
    Failed,
    NoOutputSignals,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionValue {
    pub category: SessionValueCategory,
    pub score: i64,
    pub reasons: Vec<SessionValueReason>,
}

impl Default for SessionValue {
    fn default() -> Self {
        Self {
            category: SessionValueCategory::Unreviewed,
            score: 50,
            reasons: vec![SessionValueReason::NeedsReview],
        }
    }
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

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TimeIntervalRecord {
    pub started_at: String,
    pub ended_at: String,
    pub seconds: i64,
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
    pub repair_started_at: Option<String>,
    pub review_intervals: Vec<TimeIntervalRecord>,
    pub repair_intervals: Vec<TimeIntervalRecord>,
    pub time_fields: TimeFields,
    pub value: SessionValue,
    pub summary: String,
    pub source_file: String,
    pub git_branch: Option<String>,
    pub git_dirty: bool,
    pub delivery: DeliveryLink,
}

impl SessionValue {
    pub fn for_session(session: &SessionRecord) -> Self {
        let mut reasons = Vec::new();
        let mut score = 45_i64;

        match session.status {
            SessionStatus::Discarded => {
                return Self {
                    category: SessionValueCategory::Discarded,
                    score: 5,
                    reasons: vec![SessionValueReason::Discarded],
                };
            }
            SessionStatus::Failed => {
                return Self {
                    category: SessionValueCategory::Discarded,
                    score: 10,
                    reasons: vec![SessionValueReason::Failed],
                };
            }
            SessionStatus::NeedsRepair => {
                reasons.push(SessionValueReason::NeedsRepair);
                score -= 12;
            }
            SessionStatus::NeedsReview | SessionStatus::Unknown => {
                reasons.push(SessionValueReason::NeedsReview);
                score -= 6;
            }
            SessionStatus::Useful => {
                reasons.push(SessionValueReason::MarkedUseful);
                score += 24;
            }
            SessionStatus::Repaired => {
                reasons.push(SessionValueReason::MarkedRepaired);
                score += 16;
            }
        }

        let has_file_hints = !session.changed_files.is_empty();
        let has_tool_calls = session.tool_call_count > 0;
        let has_token_usage = session.token_count.unwrap_or_default() > 0;

        if has_file_hints {
            reasons.push(SessionValueReason::HasFileHints);
            score += 14;
        }
        if has_tool_calls {
            reasons.push(SessionValueReason::HasToolCalls);
            score += (session.tool_call_count / 3).clamp(3, 12);
        }
        if has_token_usage {
            reasons.push(SessionValueReason::HasTokenUsage);
            score += 4;
        }
        if !has_file_hints && !has_tool_calls && !has_token_usage {
            reasons.push(SessionValueReason::NoOutputSignals);
            score -= 12;
        }

        if let Some(cost) = session.cost_amount {
            if cost <= 1.0 {
                reasons.push(SessionValueReason::LowCost);
                score += 5;
            } else if cost >= 5.0 {
                reasons.push(SessionValueReason::HighCost);
                score -= 18;
            } else if cost >= 2.0 {
                reasons.push(SessionValueReason::HighCost);
                score -= 9;
            }
        }

        let human_seconds =
            session.prompting_seconds + session.review_seconds + session.repair_seconds;
        let total_seconds = session.duration_seconds.max(1);
        if human_seconds * 100 / total_seconds > 55 {
            reasons.push(SessionValueReason::HighHumanTime);
            score -= 10;
        }
        if session.repair_seconds > 0 {
            reasons.push(SessionValueReason::HighRepairTime);
            score -= (session.repair_seconds / 300).clamp(4, 16);
        }

        let score = score.clamp(0, 100);
        let category = match session.status {
            SessionStatus::NeedsRepair => SessionValueCategory::NeedsHumanRepair,
            SessionStatus::Unknown | SessionStatus::NeedsReview => SessionValueCategory::Unreviewed,
            SessionStatus::Useful | SessionStatus::Repaired if score >= 72 => {
                SessionValueCategory::HighValue
            }
            SessionStatus::Useful | SessionStatus::Repaired if score >= 42 => {
                SessionValueCategory::MixedValue
            }
            SessionStatus::Useful | SessionStatus::Repaired => SessionValueCategory::LowValue,
            SessionStatus::Failed | SessionStatus::Discarded => SessionValueCategory::Discarded,
        };

        Self {
            category,
            score,
            reasons,
        }
    }
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
    pub absorbed: Option<bool>,
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
    pub parallel_seconds: i64,
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

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ParallelInsightKind {
    ParallelPayoff,
    ReviewBottleneck,
    ContextSwitching,
    LowParallelism,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum InsightSeverity {
    Info,
    Warning,
    Critical,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ParallelInsight {
    pub kind: ParallelInsightKind,
    pub severity: InsightSeverity,
    pub seconds: i64,
    pub count: usize,
    pub session_ids: Vec<String>,
    pub project_names: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ParallelReviewSummary {
    pub total_active_seconds: i64,
    pub parallel_project_seconds: i64,
    pub parallel_session_seconds: i64,
    pub parallel_project_ratio: f64,
    pub parallel_session_ratio: f64,
    pub max_concurrent_sessions: usize,
    pub max_concurrent_projects: usize,
    pub ai_waiting_human_overlap_seconds: i64,
    pub review_backlog_session_count: usize,
    pub review_backlog_seconds: i64,
    pub context_switch_count: usize,
    pub short_context_switch_count: usize,
    pub insights: Vec<ParallelInsight>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TestCommandStatus {
    Unknown,
    Passed,
    Failed,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct TestCommandRecord {
    pub command: String,
    pub status: TestCommandStatus,
    pub source: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DeliveryCommit {
    pub hash: String,
    pub title: String,
    pub committed_at: String,
    pub files: Vec<String>,
    pub merged_to_default_branch: Option<bool>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum LinkConfidence {
    Confirmed,
    Inferred,
    Unknown,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum MergeStatus {
    Merged,
    NotMerged,
    Unknown,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CiStatus {
    Passed,
    Failed,
    Running,
    Unknown,
    NotRecorded,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PullRequestLink {
    pub provider: String,
    pub number: Option<i64>,
    pub url: Option<String>,
    pub branch: Option<String>,
    #[serde(default)]
    pub state: Option<String>,
    pub status: LinkConfidence,
    pub merge_status: MergeStatus,
    pub source: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct IssueLink {
    pub provider: String,
    pub key: String,
    pub url: Option<String>,
    #[serde(default)]
    pub title: Option<String>,
    #[serde(default)]
    pub state: Option<String>,
    pub status: LinkConfidence,
    pub source: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CiSignal {
    pub status: CiStatus,
    pub source: String,
    pub command: Option<String>,
}

impl Default for CiSignal {
    fn default() -> Self {
        Self {
            status: CiStatus::NotRecorded,
            source: "none".to_string(),
            command: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct DeliveryIntegration {
    pub pull_request: Option<PullRequestLink>,
    pub issues: Vec<IssueLink>,
    pub ci: CiSignal,
    pub review_comment_count: Option<usize>,
    pub attribution_confidence: f64,
}

impl Default for DeliveryIntegration {
    fn default() -> Self {
        Self {
            pull_request: None,
            issues: Vec::new(),
            ci: CiSignal::default(),
            review_comment_count: None,
            attribution_confidence: 0.0,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct DeliveryLink {
    pub diff_summary: String,
    pub changed_files: Vec<String>,
    #[serde(default)]
    pub file_hints: Vec<String>,
    #[serde(default)]
    pub git_dirty_files: Vec<String>,
    #[serde(default)]
    pub commit_files: Vec<String>,
    pub commits: Vec<DeliveryCommit>,
    pub committed_after_session: bool,
    pub dirty_after_session: bool,
    pub absorbed: bool,
    pub test_commands: Vec<TestCommandRecord>,
    pub confidence: f64,
    pub integration: DeliveryIntegration,
}

impl Default for DeliveryLink {
    fn default() -> Self {
        Self {
            diff_summary: String::new(),
            changed_files: Vec::new(),
            file_hints: Vec::new(),
            git_dirty_files: Vec::new(),
            commit_files: Vec::new(),
            commits: Vec::new(),
            committed_after_session: false,
            dirty_after_session: false,
            absorbed: false,
            test_commands: Vec::new(),
            confidence: 0.0,
            integration: DeliveryIntegration::default(),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DeliveryInsightKind {
    UnabsorbedOutput,
    DirtyAfterSession,
    MissingTests,
    LinkedDelivery,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeliveryInsight {
    pub kind: DeliveryInsightKind,
    pub severity: InsightSeverity,
    pub count: usize,
    pub session_ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct DeliveryReviewSummary {
    pub sessions_with_file_changes: usize,
    pub sessions_with_commits: usize,
    pub sessions_with_dirty_changes: usize,
    pub absorbed_sessions: usize,
    pub sessions_with_tests: usize,
    pub sessions_with_pr: usize,
    pub sessions_with_ci_signal: usize,
    pub sessions_with_issues: usize,
    pub merged_sessions: usize,
    pub review_comment_known_sessions: usize,
    pub insights: Vec<DeliveryInsight>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Ord, PartialOrd, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TaskType {
    UiFrontend,
    Docs,
    Tests,
    Backend,
    Delivery,
    Repair,
    Unknown,
}

impl TaskType {
    pub fn as_str(self) -> &'static str {
        match self {
            TaskType::UiFrontend => "ui_frontend",
            TaskType::Docs => "docs",
            TaskType::Tests => "tests",
            TaskType::Backend => "backend",
            TaskType::Delivery => "delivery",
            TaskType::Repair => "repair",
            TaskType::Unknown => "unknown",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskTypeSummary {
    pub task_type: TaskType,
    pub session_count: usize,
    pub successful_sessions: usize,
    pub repair_sessions: usize,
    pub average_value_score: f64,
    pub recommended_source: Option<SessionSource>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolPerformanceSummary {
    pub source: SessionSource,
    pub session_count: usize,
    pub successful_sessions: usize,
    pub average_value_score: f64,
    pub top_task_type: Option<TaskType>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PlaybookKind {
    ReusePattern,
    ClearReviewBacklog,
    AbsorbBeforeMoreAgents,
    KeepParallelLimitSwitches,
    AddTestLoop,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlaybookItem {
    pub kind: PlaybookKind,
    pub title: String,
    pub detail: String,
    pub source: Option<SessionSource>,
    pub task_type: Option<TaskType>,
    pub session_ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct OperatingReviewSummary {
    pub total_sessions: usize,
    pub successful_sessions: usize,
    pub success_rate: f64,
    pub cross_tool_source_count: usize,
    pub cross_project_count: usize,
    pub task_types: Vec<TaskTypeSummary>,
    pub tool_performance: Vec<ToolPerformanceSummary>,
    pub playbook: Vec<PlaybookItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DayMetrics {
    pub date: String,
    pub project_count: usize,
    pub session_count: usize,
    pub ai_waiting_seconds_estimated: i64,
    pub ai_waiting_seconds_manual: i64,
    pub prompting_seconds_estimated: i64,
    pub prompting_seconds_manual: i64,
    pub review_seconds_estimated: i64,
    pub review_seconds_manual: i64,
    pub repair_seconds_estimated: i64,
    pub repair_seconds_manual: i64,
    pub tool_call_count: i64,
    pub token_count: i64,
    pub cost_amount: f64,
    pub high_value_count: usize,
    pub low_value_count: usize,
    pub needs_repair_value_count: usize,
    pub discarded_value_count: usize,
    pub parallel_seconds: i64,
    pub parallel_session_seconds: i64,
    pub parallel_project_ratio: f64,
    pub ai_waiting_human_overlap_seconds: i64,
    pub review_backlog_session_count: usize,
    pub context_switch_count: usize,
    pub absorbed_session_count: usize,
    pub committed_session_count: usize,
    pub dirty_delivery_session_count: usize,
    pub pr_linked_session_count: usize,
    pub ci_signal_session_count: usize,
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
    pub parallel_review: ParallelReviewSummary,
    pub delivery_review: DeliveryReviewSummary,
    pub operating_review: OperatingReviewSummary,
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

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "camelCase")]
pub struct RemoteIntegrationConfig {
    pub enabled: bool,
    #[serde(default)]
    pub token_saved: bool,
    pub token: String,
    #[serde(default)]
    pub clear_token: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "camelCase")]
pub struct IntegrationSettings {
    pub github: RemoteIntegrationConfig,
    pub linear: RemoteIntegrationConfig,
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
    #[serde(default)]
    pub integration_settings: IntegrationSettings,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct IntegrationProviderSync {
    pub enabled: bool,
    pub attempted: bool,
    pub linked: usize,
    pub errors: usize,
    pub message: String,
}

impl IntegrationProviderSync {
    pub fn attempted(enabled: bool) -> Self {
        Self {
            enabled,
            attempted: true,
            linked: 0,
            errors: 0,
            message: String::new(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct IntegrationSyncResult {
    pub started_at: String,
    pub finished_at: String,
    pub github: IntegrationProviderSync,
    pub linear: IntegrationProviderSync,
    pub sessions_updated: usize,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum DiagnosticLevel {
    Info,
    Success,
    Warning,
    Error,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DiagnosticDetail {
    pub level: DiagnosticLevel,
    pub label: String,
    pub value: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ProviderDiagnostics {
    pub enabled: bool,
    pub credential_present: bool,
    pub ok: bool,
    pub message: String,
    pub details: Vec<DiagnosticDetail>,
}

impl ProviderDiagnostics {
    pub fn disabled(label: &str) -> Self {
        Self {
            enabled: false,
            credential_present: false,
            ok: false,
            message: format!("{label} disabled"),
            details: Vec::new(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct IntegrationDiagnosticsResult {
    pub checked_at: String,
    pub github: ProviderDiagnostics,
    pub linear: ProviderDiagnostics,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct BackupResult {
    pub path: String,
    pub bytes: u64,
    pub created_at: String,
    pub message: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ReleaseCheckStatus {
    Pass,
    Warning,
    Fail,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ReleaseCheck {
    pub id: String,
    pub label: String,
    pub status: ReleaseCheckStatus,
    pub detail: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ReleaseReadinessResult {
    pub checked_at: String,
    pub version: String,
    pub build_command: String,
    pub checks: Vec<ReleaseCheck>,
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
        assert!(!settings.integration_settings.github.enabled);
        assert!(settings.integration_settings.github.token.is_empty());
    }

    #[test]
    fn app_settings_accepts_saved_language() {
        let settings: AppSettings = serde_json::from_value(json!({
            "onboardingCompleted": true,
            "sourceConfigs": [],
            "projectRoots": [],
            "language": "zh-CN",
            "integrationSettings": {
                "github": { "enabled": true, "tokenSaved": false, "token": "ghp_example", "clearToken": false },
                "linear": { "enabled": false, "tokenSaved": false, "token": "", "clearToken": false }
            }
        }))
        .expect("settings deserialize");

        assert_eq!(settings.language, LanguageSetting::ZhCn);
        assert!(settings.integration_settings.github.enabled);
    }
}
