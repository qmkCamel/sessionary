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
  timeFields: Record<"prompting" | "waiting" | "review" | "repair", TimeFieldState>;
  value: SessionValue;
  summary: string;
  sourceFile: string;
  gitBranch: string | null;
  gitDirty: boolean;
}

export interface ProjectSummary {
  name: string;
  path: string;
  sessionCount: number;
  startedAt: string;
  endedAt: string | null;
  activeSeconds: number;
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

export interface DayMetrics {
  date: string;
  projectCount: number;
  sessionCount: number;
  aiWaitingSecondsEstimated: number;
  promptingSecondsEstimated: number;
  reviewSecondsEstimated: number;
  repairSecondsEstimated: number;
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
}

export interface ScanResult {
  startedAt: string;
  finishedAt: string;
  filesScanned: number;
  sessionsFound: number;
  errors: number;
  sourceStatus: SourceStatus[];
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
}
