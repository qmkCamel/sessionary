export type SessionSource = "codex" | "claude";

export type SessionStatus =
  | "unknown"
  | "useful"
  | "needs_review"
  | "needs_repair"
  | "repaired"
  | "failed"
  | "discarded";

export type TimeFieldState = "estimated" | "manual";

export type AiWaitingIntervalSource = "event" | "inferred" | "estimated";

export type SessionValueCategory =
  | "high_value"
  | "mixed_value"
  | "low_value"
  | "needs_human_repair"
  | "discarded"
  | "unreviewed";

export type SessionValueReason =
  | "marked_useful"
  | "marked_repaired"
  | "has_file_hints"
  | "has_tool_calls"
  | "has_token_usage"
  | "low_cost"
  | "high_cost"
  | "high_human_time"
  | "high_repair_time"
  | "needs_review"
  | "needs_repair"
  | "discarded"
  | "failed"
  | "no_output_signals";

export interface SessionValue {
  category: SessionValueCategory;
  score: number;
  reasons: SessionValueReason[];
}

export interface TimeIntervalRecord {
  startedAt: string;
  endedAt: string;
  seconds: number;
}

export interface AiWaitingIntervalRecord {
  userSentAt: string;
  aiFinishedAt: string;
  seconds: number;
  source: AiWaitingIntervalSource;
}

export interface SessionRecord {
  id: string;
  source: SessionSource;
  sourceSessionId: string;
  projectName: string;
  projectPath: string;
  cwd: string;
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number;
  userMessageCount: number;
  assistantMessageCount: number;
  toolCallCount: number;
  tokenCount: number | null;
  costAmount: number | null;
  status: SessionStatus;
  statusUpdatedAt: string | null;
  note: string;
  confidence: number;
  changedFiles: string[];
  promptingSeconds: number;
  waitingSeconds: number;
  reviewSeconds: number;
  repairSeconds: number;
  reviewStartedAt: string | null;
  repairStartedAt: string | null;
  aiWaitingIntervals: AiWaitingIntervalRecord[];
  reviewIntervals: TimeIntervalRecord[];
  repairIntervals: TimeIntervalRecord[];
  timeFields: Record<"prompting" | "waiting" | "review" | "repair", TimeFieldState>;
  value: SessionValue;
  summary: string;
  sourceFile: string;
  gitBranch: string | null;
  gitDirty: boolean;
  delivery: DeliveryLink;
}

export interface ProjectSummary {
  name: string;
  path: string;
  sessionCount: number;
  startedAt: string;
  endedAt: string | null;
  activeSeconds: number;
  parallelSeconds: number;
  sources: SessionSource[];
  isParallel: boolean;
  gitBranch: string | null;
  gitDirty: boolean;
}

export interface OverlapInterval {
  startedAt: string;
  endedAt: string;
  seconds: number;
  sessionIds: string[];
  projectNames: string[];
}

export type ParallelInsightKind =
  | "parallel_payoff"
  | "review_bottleneck"
  | "context_switching"
  | "low_parallelism";

export type InsightSeverity = "info" | "warning" | "critical";

export interface ParallelInsight {
  kind: ParallelInsightKind;
  severity: InsightSeverity;
  seconds: number;
  count: number;
  sessionIds: string[];
  projectNames: string[];
}

export interface ParallelReviewSummary {
  totalActiveSeconds: number;
  parallelProjectSeconds: number;
  parallelSessionSeconds: number;
  parallelProjectRatio: number;
  parallelSessionRatio: number;
  maxConcurrentSessions: number;
  maxConcurrentProjects: number;
  aiWaitingHumanOverlapSeconds: number;
  reviewBacklogSessionCount: number;
  reviewBacklogSeconds: number;
  contextSwitchCount: number;
  shortContextSwitchCount: number;
  insights: ParallelInsight[];
}

export type TestCommandStatus = "unknown" | "passed" | "failed";

export interface TestCommandRecord {
  command: string;
  status: TestCommandStatus;
  source: string;
}

export interface DeliveryCommit {
  hash: string;
  title: string;
  committedAt: string;
  files: string[];
  mergedToDefaultBranch: boolean | null;
}

export type LinkConfidence = "confirmed" | "inferred" | "unknown";
export type MergeStatus = "merged" | "not_merged" | "unknown";
export type CiStatus = "passed" | "failed" | "running" | "unknown" | "not_recorded";

export interface PullRequestLink {
  provider: string;
  number: number | null;
  url: string | null;
  branch: string | null;
  state?: string | null;
  status: LinkConfidence;
  mergeStatus: MergeStatus;
  source: string;
}

export interface IssueLink {
  provider: string;
  key: string;
  url: string | null;
  title?: string | null;
  state?: string | null;
  status: LinkConfidence;
  source: string;
}

export interface CiSignal {
  status: CiStatus;
  source: string;
  command: string | null;
}

export interface DeliveryIntegration {
  pullRequest: PullRequestLink | null;
  issues: IssueLink[];
  ci: CiSignal;
  reviewCommentCount: number | null;
  attributionConfidence: number;
}

export interface DeliveryLink {
  diffSummary: string;
  changedFiles: string[];
  fileHints: string[];
  gitDirtyFiles: string[];
  commitFiles: string[];
  commits: DeliveryCommit[];
  committedAfterSession: boolean;
  dirtyAfterSession: boolean;
  absorbed: boolean;
  testCommands: TestCommandRecord[];
  confidence: number;
  integration: DeliveryIntegration;
}

export type DeliveryInsightKind =
  | "unabsorbed_output"
  | "dirty_after_session"
  | "missing_tests"
  | "linked_delivery";

export interface DeliveryInsight {
  kind: DeliveryInsightKind;
  severity: InsightSeverity;
  count: number;
  sessionIds: string[];
}

export interface DeliveryReviewSummary {
  sessionsWithFileChanges: number;
  sessionsWithCommits: number;
  sessionsWithDirtyChanges: number;
  absorbedSessions: number;
  sessionsWithTests: number;
  sessionsWithPr: number;
  sessionsWithCiSignal: number;
  sessionsWithIssues: number;
  mergedSessions: number;
  reviewCommentKnownSessions: number;
  insights: DeliveryInsight[];
}

export type TaskType =
  | "ui_frontend"
  | "docs"
  | "tests"
  | "backend"
  | "delivery"
  | "repair"
  | "unknown";

export interface TaskTypeSummary {
  taskType: TaskType;
  sessionCount: number;
  successfulSessions: number;
  repairSessions: number;
  averageValueScore: number;
  recommendedSource: SessionSource | null;
}

export interface ToolPerformanceSummary {
  source: SessionSource;
  sessionCount: number;
  successfulSessions: number;
  averageValueScore: number;
  topTaskType: TaskType | null;
}

export type PlaybookKind =
  | "reuse_pattern"
  | "clear_review_backlog"
  | "absorb_before_more_agents"
  | "keep_parallel_limit_switches"
  | "add_test_loop";

export interface PlaybookItem {
  kind: PlaybookKind;
  title: string;
  detail: string;
  source: SessionSource | null;
  taskType: TaskType | null;
  sessionIds: string[];
}

export interface OperatingReviewSummary {
  totalSessions: number;
  successfulSessions: number;
  successRate: number;
  crossToolSourceCount: number;
  crossProjectCount: number;
  taskTypes: TaskTypeSummary[];
  toolPerformance: ToolPerformanceSummary[];
  playbook: PlaybookItem[];
}

export interface DayMetrics {
  date: string;
  projectCount: number;
  sessionCount: number;
  aiWaitingSecondsEstimated: number;
  aiWaitingSecondsManual: number;
  promptingSecondsEstimated: number;
  promptingSecondsManual: number;
  reviewSecondsEstimated: number;
  reviewSecondsManual: number;
  repairSecondsEstimated: number;
  repairSecondsManual: number;
  toolCallCount: number;
  tokenCount: number;
  costAmount: number;
  highValueCount: number;
  lowValueCount: number;
  needsRepairValueCount: number;
  discardedValueCount: number;
  parallelSeconds: number;
  parallelSessionSeconds: number;
  parallelProjectRatio: number;
  aiWaitingHumanOverlapSeconds: number;
  reviewBacklogSessionCount: number;
  contextSwitchCount: number;
  absorbedSessionCount: number;
  committedSessionCount: number;
  dirtyDeliverySessionCount: number;
  prLinkedSessionCount: number;
  ciSignalSessionCount: number;
  maxConcurrentSessions: number;
  maxConcurrentProjects: number;
  unknownCount: number;
  needsReviewCount: number;
  needsRepairCount: number;
  generatedAt: string;
}

export interface DayLedger {
  metrics: DayMetrics;
  projects: ProjectSummary[];
  sessions: SessionRecord[];
  overlaps: OverlapInterval[];
  sessionOverlaps: OverlapInterval[];
  parallelReview: ParallelReviewSummary;
  deliveryReview: DeliveryReviewSummary;
  operatingReview: OperatingReviewSummary;
  sourceStatus: SourceStatus[];
}

export interface SourceStatus {
  source: SessionSource;
  enabled: boolean;
  path: string;
  filesScanned: number;
  sessionsFound: number;
  errors: number;
  lastScanAt: string | null;
}

export interface SourceConfig {
  source: SessionSource;
  enabled: boolean;
  paths: string[];
}

export interface AppSettings {
  onboardingCompleted: boolean;
  sourceConfigs: SourceConfig[];
  projectRoots: string[];
  language: "system" | "en" | "zh-CN";
  integrationSettings: IntegrationSettings;
}

export interface RemoteIntegrationConfig {
  enabled: boolean;
  tokenSaved: boolean;
  token: string;
  clearToken?: boolean;
}

export interface IntegrationSettings {
  github: RemoteIntegrationConfig;
  linear: RemoteIntegrationConfig;
}

export interface ScanResult {
  startedAt: string;
  finishedAt: string;
  filesScanned: number;
  sessionsFound: number;
  errors: number;
  sourceStatus: SourceStatus[];
}

export interface IntegrationProviderSync {
  enabled: boolean;
  attempted: boolean;
  linked: number;
  errors: number;
  message: string;
}

export interface IntegrationSyncResult {
  startedAt: string;
  finishedAt: string;
  github: IntegrationProviderSync;
  linear: IntegrationProviderSync;
  sessionsUpdated: number;
}

export type DiagnosticLevel = "info" | "success" | "warning" | "error";

export interface DiagnosticDetail {
  level: DiagnosticLevel;
  label: string;
  value: string;
}

export interface ProviderDiagnostics {
  enabled: boolean;
  credentialPresent: boolean;
  ok: boolean;
  message: string;
  details: DiagnosticDetail[];
}

export interface IntegrationDiagnosticsResult {
  checkedAt: string;
  github: ProviderDiagnostics;
  linear: ProviderDiagnostics;
}

export interface BackupResult {
  path: string;
  bytes: number;
  createdAt: string;
  message: string;
}

export type ReleaseCheckStatus = "pass" | "warning" | "fail";

export interface ReleaseCheck {
  id: string;
  label: string;
  status: ReleaseCheckStatus;
  detail: string;
}

export interface ReleaseReadinessResult {
  checkedAt: string;
  version: string;
  buildCommand: string;
  checks: ReleaseCheck[];
}

export interface ReportResult {
  markdown: string;
  exportedPath?: string;
}

export interface SessionPatch {
  status?: SessionStatus;
  note?: string;
  promptingSeconds?: number;
  waitingSeconds?: number;
  reviewSeconds?: number;
  repairSeconds?: number;
  absorbed?: boolean;
}
