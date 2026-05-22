import type {
  AppSettings,
  BackupResult,
  DayLedger,
  DayMetrics,
  DeliveryInsight,
  DeliveryLink,
  DeliveryReviewSummary,
  IntegrationDiagnosticsResult,
  IntegrationSyncResult,
  OperatingReviewSummary,
  OverlapInterval,
  ParallelInsight,
  ParallelReviewSummary,
  PlaybookItem,
  ProjectSummary,
  ReportResult,
  ReleaseReadinessResult,
  ScanResult,
  SessionPatch,
  SessionRecord,
  SessionStatus,
  SourceStatus
} from "../shared/types";
import { createTranslator, type Locale } from "../i18n";
import { classifySessionValue } from "../shared/value";

const fallbackDate = "2026-05-19";

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

let settings: AppSettings = {
  onboardingCompleted: true,
  language: "system",
  integrationSettings: {
    github: { enabled: false, tokenSaved: false, token: "" },
    linear: { enabled: false, tokenSaved: false, token: "" }
  },
  sourceConfigs: [
    { source: "codex", enabled: true, paths: ["~/.codex/sessions", "~/.codex/archived_sessions"] },
    { source: "claude", enabled: true, paths: ["~/.claude/projects", "~/.claude"] }
  ],
  projectRoots: ["/Users/alex/work/sessionary", "/Users/alex/work/marker"]
};

function deliveryFixture({
  files,
  diffSummary,
  committed,
  dirty,
  absorbed,
  tests = [],
  prUrl = null,
  issueKeys = [],
  merged = false
}: {
  files: string[];
  diffSummary: string;
  committed: boolean;
  dirty: boolean;
  absorbed: boolean;
  tests?: Array<[string, "unknown" | "passed" | "failed"]>;
  prUrl?: string | null;
  issueKeys?: string[];
  merged?: boolean;
}): DeliveryLink {
  return {
    diffSummary,
    changedFiles: files,
    commits: committed
      ? [
          {
            hash: "76e0a9e",
            title: issueKeys.length > 0 ? `${issueKeys[0]} absorb session output (#42)` : "Absorb AI session output (#42)",
            committedAt: `${fallbackDate}T14:35:00+08:00`,
            files,
            mergedToDefaultBranch: merged
          }
        ]
      : [],
    committedAfterSession: committed,
    dirtyAfterSession: dirty,
    absorbed,
    testCommands: tests.map(([command, status]) => ({ command, status, source: "fallback_log" })),
    confidence: committed ? 0.82 : dirty || files.length > 0 ? 0.54 : 0.2,
    integration: {
      pullRequest: prUrl
        ? {
            provider: "github",
            number: 42,
            url: prUrl,
            branch: "feature/session-review",
            state: merged ? "closed" : "open",
            status: "inferred",
            mergeStatus: merged ? "merged" : "not_merged",
            source: "local_git"
          }
        : null,
      issues: issueKeys.map((key) => ({
        provider: key.startsWith("#") ? "github" : "linear_or_jira",
        key,
        url: key.startsWith("#") ? `https://github.com/qmkCamel/sessionary/issues/${key.slice(1)}` : null,
        title: null,
        state: null,
        status: "inferred",
        source: "local_text"
      })),
      ci: tests.length > 0
        ? { status: tests.some(([, status]) => status === "failed") ? "failed" : tests.some(([, status]) => status === "passed") ? "passed" : "unknown", source: "fallback_log", command: tests[0][0] }
        : { status: "not_recorded", source: "none", command: null },
      reviewCommentCount: null,
      attributionConfidence: prUrl || issueKeys.length > 0 ? 0.72 : tests.length > 0 ? 0.46 : 0.2
    }
  };
}

let sessions: SessionRecord[] = [
  {
    id: "fallback-codex-sessionary-1",
    source: "codex",
    sourceSessionId: "019e407b-sessionary",
    projectName: "sessionary",
    projectPath: "/Users/alex/work/sessionary",
    cwd: "/Users/alex/work/sessionary",
    startedAt: `${fallbackDate}T09:18:00+08:00`,
    endedAt: `${fallbackDate}T10:42:00+08:00`,
    durationSeconds: 5040,
    userMessageCount: 9,
    assistantMessageCount: 12,
    toolCallCount: 31,
    tokenCount: 48320,
    costAmount: 0.84,
    status: "needs_review",
    statusUpdatedAt: null,
    note: "Check whether the product docs and mockups still match the first runnable app.",
    confidence: 0.82,
    changedFiles: ["docs/product-interaction-design.md", "docs/technical-architecture.md", "src/App.tsx"],
    promptingSeconds: 1380,
    waitingSeconds: 2040,
    reviewSeconds: 720,
    repairSeconds: 0,
    reviewStartedAt: null,
    repairStartedAt: null,
    timeFields: {
      prompting: "estimated",
      waiting: "estimated",
      review: "estimated",
      repair: "estimated"
    },
    value: { category: "unreviewed", score: 50, reasons: ["needs_review"] },
    summary: "Shaped Sessionary into a local-first AI coding session inbox",
    sourceFile: "~/.codex/sessions/2026/05/19/sessionary.jsonl",
    gitBranch: "main",
    gitDirty: true,
    delivery: deliveryFixture({
      files: ["docs/product-interaction-design.md", "docs/technical-architecture.md", "src/App.tsx"],
      diffSummary: "3 dirty file(s): docs/product-interaction-design.md, docs/technical-architecture.md, src/App.tsx. Diff: 3 files changed, 240 insertions(+), 42 deletions(-)",
      committed: false,
      dirty: true,
      absorbed: false,
      tests: [["npm run typecheck", "passed"], ["npm test", "unknown"]]
    })
  },
  {
    id: "fallback-claude-marker-1",
    source: "claude",
    sourceSessionId: "claude-marker-ios-v1",
    projectName: "marker",
    projectPath: "/Users/alex/work/marker",
    cwd: "/Users/alex/work/marker",
    startedAt: `${fallbackDate}T10:05:00+08:00`,
    endedAt: `${fallbackDate}T11:10:00+08:00`,
    durationSeconds: 3900,
    userMessageCount: 6,
    assistantMessageCount: 8,
    toolCallCount: 22,
    tokenCount: 35140,
    costAmount: 0.61,
    status: "unknown",
    statusUpdatedAt: null,
    note: "",
    confidence: 0.74,
    changedFiles: ["PRODUCT_TODO.md", "Marker/Views/TodayView.swift"],
    promptingSeconds: 900,
    waitingSeconds: 1860,
    reviewSeconds: 420,
    repairSeconds: 300,
    reviewStartedAt: null,
    repairStartedAt: null,
    timeFields: {
      prompting: "estimated",
      waiting: "estimated",
      review: "estimated",
      repair: "estimated"
    },
    value: { category: "unreviewed", score: 50, reasons: ["needs_review"] },
    summary: "Continued Marker Today flow implementation and roadmap sync",
    sourceFile: "~/.claude/projects/marker/session.jsonl",
    gitBranch: "feature/ios-v1",
    gitDirty: false,
    delivery: deliveryFixture({
      files: ["PRODUCT_TODO.md", "Marker/Views/TodayView.swift"],
      diffSummary: "1 commit near session window. Working tree clean.",
      committed: true,
      dirty: false,
      absorbed: true,
      tests: [["xcodebuild test", "unknown"]],
      prUrl: "https://github.com/qmkCamel/marker/pull/42",
      issueKeys: ["MARKER-12"],
      merged: false
    })
  },
  {
    id: "fallback-codex-peoplelens-1",
    source: "codex",
    sourceSessionId: "peoplelens-storage-pass",
    projectName: "PeopleLens",
    projectPath: "/Users/alex/work/peoplelens",
    cwd: "/Users/alex/work/peoplelens",
    startedAt: `${fallbackDate}T13:20:00+08:00`,
    endedAt: `${fallbackDate}T14:06:00+08:00`,
    durationSeconds: 2760,
    userMessageCount: 5,
    assistantMessageCount: 7,
    toolCallCount: 18,
    tokenCount: 28600,
    costAmount: 0.49,
    status: "needs_repair",
    statusUpdatedAt: null,
    note: "Re-run extension persistence smoke test before marking useful.",
    confidence: 0.68,
    changedFiles: ["src/storage/adapter.ts", "src/sidePanel/App.tsx"],
    promptingSeconds: 780,
    waitingSeconds: 1200,
    reviewSeconds: 300,
    repairSeconds: 480,
    reviewStartedAt: null,
    repairStartedAt: null,
    timeFields: {
      prompting: "estimated",
      waiting: "estimated",
      review: "estimated",
      repair: "estimated"
    },
    value: { category: "needs_human_repair", score: 32, reasons: ["needs_repair", "high_repair_time"] },
    summary: "Patched browser storage adapter and side panel persistence behavior",
    sourceFile: "~/.codex/sessions/2026/05/19/peoplelens.jsonl",
    gitBranch: "add-storage-adapter",
    gitDirty: true,
    delivery: deliveryFixture({
      files: ["src/storage/adapter.ts", "src/sidePanel/App.tsx"],
      diffSummary: "2 dirty file(s): src/storage/adapter.ts, src/sidePanel/App.tsx. Diff: 2 files changed, 88 insertions(+), 18 deletions(-)",
      committed: false,
      dirty: true,
      absorbed: false,
      tests: [["npm test -- storage", "failed"]],
      issueKeys: ["PL-7"]
    })
  }
];

function sourceStatusFor(currentSessions: SessionRecord[]): SourceStatus[] {
  return settings.sourceConfigs.map((config) => {
    const matchingSessions = currentSessions.filter((session) => session.source === config.source);
    return {
      source: config.source,
      enabled: config.enabled,
      path: config.paths.join(", "),
      filesScanned: config.enabled ? Math.max(1, matchingSessions.length) : 0,
      sessionsFound: config.enabled ? matchingSessions.length : 0,
      errors: 0,
      lastScanAt: `${fallbackDate}T15:00:00+08:00`
    };
  });
}

function projectSummaries(currentSessions: SessionRecord[]): ProjectSummary[] {
  const grouped = new Map<string, SessionRecord[]>();
  for (const session of currentSessions) {
    grouped.set(session.projectPath, [...(grouped.get(session.projectPath) ?? []), session]);
  }

  return [...grouped.entries()].map(([path, projectSessions]) => {
    const startedAt = projectSessions.reduce((earliest, session) => session.startedAt < earliest ? session.startedAt : earliest, projectSessions[0].startedAt);
    const endedValues = projectSessions.map((session) => session.endedAt).filter((value): value is string => Boolean(value));
    return {
      name: projectSessions[0].projectName,
      path,
      sessionCount: projectSessions.length,
      startedAt,
      endedAt: endedValues.length > 0 ? endedValues.sort().at(-1) ?? null : null,
      activeSeconds: projectSessions.reduce((total, session) => total + session.durationSeconds, 0),
      sources: [...new Set(projectSessions.map((session) => session.source))],
      isParallel: projectSessions.some((session) => overlaps.some((overlap) => overlap.sessionIds.includes(session.id))),
      gitBranch: projectSessions[0].gitBranch,
      gitDirty: projectSessions.some((session) => session.gitDirty)
    };
  });
}

const overlaps: OverlapInterval[] = [
  {
    startedAt: `${fallbackDate}T10:05:00+08:00`,
    endedAt: `${fallbackDate}T10:42:00+08:00`,
    seconds: 2220,
    sessionIds: ["fallback-codex-sessionary-1", "fallback-claude-marker-1"],
    projectNames: ["sessionary", "marker"]
  }
];

const sessionOverlaps: OverlapInterval[] = [
  ...overlaps
];

function withValue(session: SessionRecord): SessionRecord {
  return {
    ...session,
    value: classifySessionValue(session)
  };
}

function secondsBetween(start: string, end: string) {
  return Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 1000));
}

function unionSeconds(currentSessions: SessionRecord[]) {
  const intervals = currentSessions
    .filter((session) => session.endedAt)
    .map((session) => [new Date(session.startedAt).getTime(), new Date(session.endedAt ?? session.startedAt).getTime()] as const)
    .sort((left, right) => left[0] - right[0]);
  if (intervals.length === 0) return 0;
  let total = 0;
  let [start, end] = intervals[0];
  for (const [nextStart, nextEnd] of intervals.slice(1)) {
    if (nextStart <= end) {
      end = Math.max(end, nextEnd);
    } else {
      total += Math.max(0, end - start);
      start = nextStart;
      end = nextEnd;
    }
  }
  return Math.round((total + Math.max(0, end - start)) / 1000);
}

function parallelSummaryFor(currentSessions: SessionRecord[], projectOverlaps: OverlapInterval[], sessionOverlapList: OverlapInterval[]): ParallelReviewSummary {
  const totalActiveSeconds = unionSeconds(currentSessions);
  const parallelProjectSeconds = projectOverlaps.reduce((total, overlap) => total + overlap.seconds, 0);
  const parallelSessionSeconds = sessionOverlapList.reduce((total, overlap) => total + overlap.seconds, 0);
  const reviewBacklogSessions = currentSessions.filter((session) =>
    session.endedAt && (session.status === "unknown" || session.status === "needs_review" || session.status === "needs_repair")
  );
  const generatedAt = `${currentSessions[0]?.startedAt.slice(0, 10) ?? fallbackDate}T15:00:00+08:00`;
  const reviewBacklogSeconds = reviewBacklogSessions.reduce((total, session) => total + secondsBetween(session.endedAt ?? generatedAt, generatedAt), 0);
  const ordered = [...currentSessions].sort((left, right) => left.startedAt.localeCompare(right.startedAt));
  let contextSwitchCount = 0;
  let shortContextSwitchCount = 0;
  for (let index = 1; index < ordered.length; index += 1) {
    const previous = ordered[index - 1];
    const next = ordered[index];
    if (previous.projectPath !== next.projectPath) {
      contextSwitchCount += 1;
      if (secondsBetween(previous.startedAt, next.startedAt) <= 20 * 60) shortContextSwitchCount += 1;
    }
  }
  const insights: ParallelInsight[] = [
    {
      kind: "parallel_payoff",
      severity: "info",
      seconds: 720,
      count: projectOverlaps.length,
      sessionIds: projectOverlaps.flatMap((overlap) => overlap.sessionIds),
      projectNames: [...new Set(projectOverlaps.flatMap((overlap) => overlap.projectNames))]
    },
    {
      kind: "review_bottleneck",
      severity: "warning",
      seconds: reviewBacklogSeconds,
      count: reviewBacklogSessions.length,
      sessionIds: reviewBacklogSessions.map((session) => session.id),
      projectNames: [...new Set(reviewBacklogSessions.map((session) => session.projectName))]
    }
  ];
  if (shortContextSwitchCount >= 2) {
    insights.push({
      kind: "context_switching",
      severity: "warning",
      seconds: 0,
      count: shortContextSwitchCount,
      sessionIds: ordered.map((session) => session.id),
      projectNames: [...new Set(ordered.map((session) => session.projectName))]
    });
  }

  return {
    totalActiveSeconds,
    parallelProjectSeconds,
    parallelSessionSeconds,
    parallelProjectRatio: totalActiveSeconds === 0 ? 0 : parallelProjectSeconds / totalActiveSeconds,
    parallelSessionRatio: totalActiveSeconds === 0 ? 0 : parallelSessionSeconds / totalActiveSeconds,
    maxConcurrentSessions: 2,
    maxConcurrentProjects: 2,
    aiWaitingHumanOverlapSeconds: 720,
    reviewBacklogSessionCount: reviewBacklogSessions.length,
    reviewBacklogSeconds,
    contextSwitchCount,
    shortContextSwitchCount,
    insights
  };
}

function deliverySummaryFor(currentSessions: SessionRecord[]): DeliveryReviewSummary {
  const sessionsWithFileChanges = currentSessions.filter((session) => session.delivery.changedFiles.length > 0 || session.changedFiles.length > 0).length;
  const sessionsWithCommits = currentSessions.filter((session) => session.delivery.committedAfterSession).length;
  const sessionsWithDirtyChanges = currentSessions.filter((session) => session.delivery.dirtyAfterSession || session.gitDirty).length;
  const absorbedSessions = currentSessions.filter((session) => session.delivery.absorbed).length;
  const sessionsWithTests = currentSessions.filter((session) => session.delivery.testCommands.length > 0).length;
  const sessionsWithPr = currentSessions.filter((session) => session.delivery.integration.pullRequest).length;
  const sessionsWithCiSignal = currentSessions.filter((session) => session.delivery.integration.ci.status !== "not_recorded").length;
  const sessionsWithIssues = currentSessions.filter((session) => session.delivery.integration.issues.length > 0).length;
  const mergedSessions = currentSessions.filter((session) =>
    session.delivery.integration.pullRequest?.mergeStatus === "merged" ||
    session.delivery.commits.some((commit) => commit.mergedToDefaultBranch)
  ).length;
  const insights: DeliveryInsight[] = [];
  const unabsorbed = currentSessions.filter((session) =>
    (session.delivery.changedFiles.length > 0 || session.delivery.committedAfterSession) && !session.delivery.absorbed
  );
  if (unabsorbed.length > 0) {
    insights.push({ kind: "unabsorbed_output", severity: "warning", count: unabsorbed.length, sessionIds: unabsorbed.map((session) => session.id) });
  }
  const dirty = currentSessions.filter((session) => session.delivery.dirtyAfterSession || session.gitDirty);
  if (dirty.length > 0) {
    insights.push({ kind: "dirty_after_session", severity: "warning", count: dirty.length, sessionIds: dirty.map((session) => session.id) });
  }
  const missingTests = currentSessions.filter((session) => session.delivery.changedFiles.length > 0 && session.delivery.testCommands.length === 0);
  if (missingTests.length > 0) {
    insights.push({ kind: "missing_tests", severity: "info", count: missingTests.length, sessionIds: missingTests.map((session) => session.id) });
  }
  const linked = currentSessions.filter((session) => session.delivery.integration.pullRequest || session.delivery.integration.issues.length > 0);
  if (linked.length > 0) {
    insights.push({ kind: "linked_delivery", severity: "info", count: linked.length, sessionIds: linked.map((session) => session.id) });
  }

  return {
    sessionsWithFileChanges,
    sessionsWithCommits,
    sessionsWithDirtyChanges,
    absorbedSessions,
    sessionsWithTests,
    sessionsWithPr,
    sessionsWithCiSignal,
    sessionsWithIssues,
    mergedSessions,
    reviewCommentKnownSessions: currentSessions.filter((session) => session.delivery.integration.reviewCommentCount != null).length,
    insights
  };
}

function taskTypeFor(session: SessionRecord): OperatingReviewSummary["taskTypes"][number]["taskType"] {
  const text = `${session.summary} ${session.note} ${session.gitBranch ?? ""} ${session.delivery.testCommands.map((command) => command.command).join(" ")}`.toLowerCase();
  const files = [...session.delivery.changedFiles, ...session.changedFiles].map((file) => file.toLowerCase());
  if (session.status === "needs_repair" || session.repairSeconds > 0 || /repair|bug|fix|failed/.test(text)) return "repair";
  if (files.some((file) => file.includes("test") || file.includes("spec")) || /test|typecheck/.test(text)) return "tests";
  if (files.some((file) => file.endsWith(".md") || file.includes("docs/") || file.includes("roadmap")) || /docs|roadmap/.test(text)) return "docs";
  if (files.some((file) => file.endsWith(".tsx") || file.endsWith(".jsx") || file.endsWith(".css") || file.includes("views/")) || /ui|frontend|layout/.test(text)) return "ui_frontend";
  if (/pr|ci|commit|release/.test(text) || files.some((file) => file.includes(".github/") || file.includes("workflow"))) return "delivery";
  if (files.some((file) => file.endsWith(".rs") || file.endsWith(".sql") || file.includes("src-tauri") || file.includes("api"))) return "backend";
  return "unknown";
}

function successful(session: SessionRecord) {
  return session.status === "useful" || session.status === "repaired" || session.value.category === "high_value" || session.value.category === "mixed_value";
}

function operatingSummaryFor(
  currentSessions: SessionRecord[],
  parallelReview: ParallelReviewSummary,
  deliveryReview: DeliveryReviewSummary
): OperatingReviewSummary {
  const totalSessions = currentSessions.length;
  const successfulSessions = currentSessions.filter(successful).length;
  const taskTypes = [...new Set(currentSessions.map(taskTypeFor))].map((taskType) => {
    const bucket = currentSessions.filter((session) => taskTypeFor(session) === taskType);
    const bySource = [...new Set(bucket.map((session) => session.source))]
      .map((source) => ({
        source,
        wins: bucket.filter((session) => session.source === source && successful(session)).length,
        score: bucket.filter((session) => session.source === source).reduce((total, session) => total + session.value.score, 0)
      }))
      .sort((left, right) => right.wins - left.wins || right.score - left.score);
    return {
      taskType,
      sessionCount: bucket.length,
      successfulSessions: bucket.filter(successful).length,
      repairSessions: bucket.filter((session) => session.status === "needs_repair" || session.status === "repaired" || session.repairSeconds > 0).length,
      averageValueScore: bucket.reduce((total, session) => total + session.value.score, 0) / Math.max(1, bucket.length),
      recommendedSource: bySource[0]?.source ?? null
    };
  });
  const toolPerformance = [...new Set(currentSessions.map((session) => session.source))].map((source) => {
    const bucket = currentSessions.filter((session) => session.source === source);
    const topTaskType = [...new Set(bucket.map(taskTypeFor))]
      .map((taskType) => ({ taskType, count: bucket.filter((session) => taskTypeFor(session) === taskType).length }))
      .sort((left, right) => right.count - left.count)[0]?.taskType ?? null;
    return {
      source,
      sessionCount: bucket.length,
      successfulSessions: bucket.filter(successful).length,
      averageValueScore: bucket.reduce((total, session) => total + session.value.score, 0) / Math.max(1, bucket.length),
      topTaskType
    };
  });
  const playbook: PlaybookItem[] = [];
  const reusable = taskTypes.find((task) => task.successfulSessions > 0 && task.averageValueScore >= 55);
  if (reusable) {
    playbook.push({
      kind: "reuse_pattern",
      title: `Reuse ${reusable.recommendedSource ?? "AI"} for ${reusable.taskType}`,
      detail: "This local pattern produced solid value in the current review window.",
      source: reusable.recommendedSource,
      taskType: reusable.taskType,
      sessionIds: currentSessions.filter((session) => taskTypeFor(session) === reusable.taskType).map((session) => session.id)
    });
  }
  if (parallelReview.reviewBacklogSessionCount >= 2) {
    playbook.push({
      kind: "clear_review_backlog",
      title: "Clear review backlog before opening more agents",
      detail: "Several completed sessions are still waiting for review or repair.",
      source: null,
      taskType: null,
      sessionIds: currentSessions.filter((session) => session.status === "unknown" || session.status === "needs_review" || session.status === "needs_repair").map((session) => session.id)
    });
  }
  if (deliveryReview.sessionsWithDirtyChanges > 0 || deliveryReview.absorbedSessions < deliveryReview.sessionsWithFileChanges) {
    playbook.push({
      kind: "absorb_before_more_agents",
      title: "Absorb or shelve delivery output before widening parallelism",
      detail: "There are local code changes that have not fully landed in the review loop.",
      source: null,
      taskType: "delivery",
      sessionIds: currentSessions.filter((session) => session.delivery.dirtyAfterSession || (!session.delivery.absorbed && session.delivery.changedFiles.length > 0)).map((session) => session.id)
    });
  }
  playbook.push({
    kind: "keep_parallel_limit_switches",
    title: "Keep parallel agents, cap short switching",
    detail: `${Math.round(parallelReview.parallelProjectRatio * 100)}% of active time was cross-project parallel in this sample.`,
    source: null,
    taskType: null,
    sessionIds: currentSessions.map((session) => session.id)
  });

  return {
    totalSessions,
    successfulSessions,
    successRate: totalSessions === 0 ? 0 : successfulSessions / totalSessions,
    crossToolSourceCount: new Set(currentSessions.map((session) => session.source)).size,
    crossProjectCount: new Set(currentSessions.map((session) => session.projectPath)).size,
    taskTypes,
    toolPerformance,
    playbook
  };
}

function metricsFor(
  date: string,
  currentSessions: SessionRecord[],
  parallelReview: ParallelReviewSummary,
  deliveryReview: DeliveryReviewSummary
): DayMetrics {
  return {
    date,
    projectCount: new Set(currentSessions.map((session) => session.projectPath)).size,
    sessionCount: currentSessions.length,
    aiWaitingSecondsEstimated: currentSessions.reduce((total, session) => total + session.waitingSeconds, 0),
    promptingSecondsEstimated: currentSessions.reduce((total, session) => total + session.promptingSeconds, 0),
    reviewSecondsEstimated: currentSessions.reduce((total, session) => total + session.reviewSeconds, 0),
    repairSecondsEstimated: currentSessions.reduce((total, session) => total + session.repairSeconds, 0),
    toolCallCount: currentSessions.reduce((total, session) => total + session.toolCallCount, 0),
    tokenCount: currentSessions.reduce((total, session) => total + (session.tokenCount ?? 0), 0),
    costAmount: currentSessions.reduce((total, session) => total + (session.costAmount ?? 0), 0),
    highValueCount: currentSessions.filter((session) => session.value.category === "high_value").length,
    lowValueCount: currentSessions.filter((session) => session.value.category === "low_value").length,
    needsRepairValueCount: currentSessions.filter((session) => session.value.category === "needs_human_repair").length,
    discardedValueCount: currentSessions.filter((session) => session.value.category === "discarded").length,
    parallelSeconds: parallelReview.parallelProjectSeconds,
    parallelSessionSeconds: parallelReview.parallelSessionSeconds,
    parallelProjectRatio: parallelReview.parallelProjectRatio,
    aiWaitingHumanOverlapSeconds: parallelReview.aiWaitingHumanOverlapSeconds,
    reviewBacklogSessionCount: parallelReview.reviewBacklogSessionCount,
    contextSwitchCount: parallelReview.contextSwitchCount,
    absorbedSessionCount: deliveryReview.absorbedSessions,
    committedSessionCount: deliveryReview.sessionsWithCommits,
    dirtyDeliverySessionCount: deliveryReview.sessionsWithDirtyChanges,
    prLinkedSessionCount: deliveryReview.sessionsWithPr,
    ciSignalSessionCount: deliveryReview.sessionsWithCiSignal,
    maxConcurrentSessions: 2,
    maxConcurrentProjects: 2,
    unknownCount: currentSessions.filter((session) => session.status === "unknown").length,
    needsReviewCount: currentSessions.filter((session) => session.status === "needs_review").length,
    needsRepairCount: currentSessions.filter((session) => session.status === "needs_repair").length,
    generatedAt: `${date}T15:00:00+08:00`
  };
}

export function fallbackLedger(date = fallbackDate): DayLedger {
  const currentSessions = clone(sessions).map((session) => ({
    ...session,
    startedAt: session.startedAt.replace(fallbackDate, date),
    endedAt: session.endedAt?.replace(fallbackDate, date) ?? null,
    statusUpdatedAt: session.statusUpdatedAt?.replace(fallbackDate, date) ?? null,
    reviewStartedAt: session.reviewStartedAt?.replace(fallbackDate, date) ?? null,
    repairStartedAt: session.repairStartedAt?.replace(fallbackDate, date) ?? null,
    delivery: {
      ...session.delivery,
      commits: session.delivery.commits.map((commit) => ({
        ...commit,
        committedAt: commit.committedAt.replace(fallbackDate, date)
      }))
    }
  })).map(withValue);
  const datedOverlaps = clone(overlaps).map((overlap) => ({
    ...overlap,
    startedAt: overlap.startedAt.replace(fallbackDate, date),
    endedAt: overlap.endedAt.replace(fallbackDate, date)
  }));
  const datedSessionOverlaps = clone(sessionOverlaps).map((overlap) => ({
    ...overlap,
    startedAt: overlap.startedAt.replace(fallbackDate, date),
    endedAt: overlap.endedAt.replace(fallbackDate, date)
  }));
  const parallelReview = parallelSummaryFor(currentSessions, datedOverlaps, datedSessionOverlaps);
  const deliveryReview = deliverySummaryFor(currentSessions);
  const operatingReview = operatingSummaryFor(currentSessions, parallelReview, deliveryReview);

  return {
    metrics: metricsFor(date, currentSessions, parallelReview, deliveryReview),
    projects: projectSummaries(currentSessions),
    sessions: currentSessions,
    overlaps: datedOverlaps,
    sessionOverlaps: datedSessionOverlaps,
    parallelReview,
    deliveryReview,
    operatingReview,
    sourceStatus: sourceStatusFor(currentSessions)
  };
}

export function fallbackScan(): ScanResult {
  const status = sourceStatusFor(sessions);
  return {
    startedAt: `${fallbackDate}T15:00:00+08:00`,
    finishedAt: `${fallbackDate}T15:00:02+08:00`,
    filesScanned: status.reduce((total, source) => total + source.filesScanned, 0),
    sessionsFound: status.reduce((total, source) => total + source.sessionsFound, 0),
    errors: 0,
    sourceStatus: status
  };
}

export function fallbackUpdate(id: string, patch: SessionPatch): SessionRecord {
  const current = sessions.find((session) => session.id === id) ?? sessions[0];
  const { absorbed, ...sessionPatch } = patch;
  const next: SessionRecord = withValue({
    ...current,
    ...sessionPatch,
    statusUpdatedAt: patch.status ? new Date().toISOString() : current.statusUpdatedAt,
    delivery: {
      ...current.delivery,
      absorbed: absorbed ?? current.delivery.absorbed
    },
    timeFields: {
      ...current.timeFields,
      prompting: patch.promptingSeconds == null ? current.timeFields.prompting : "manual",
      waiting: patch.waitingSeconds == null ? current.timeFields.waiting : "manual",
      review: patch.reviewSeconds == null ? current.timeFields.review : "manual",
      repair: patch.repairSeconds == null ? current.timeFields.repair : "manual"
    }
  });
  sessions = sessions.map((session) => (session.id === next.id ? next : session));
  return clone(next);
}

export function fallbackStartRepair(id: string): SessionRecord {
  const current = sessions.find((session) => session.id === id) ?? sessions[0];
  const next = withValue({
    ...current,
    status: "needs_repair",
    statusUpdatedAt: new Date().toISOString(),
    repairStartedAt: new Date().toISOString()
  });
  sessions = sessions.map((session) => (session.id === next.id ? next : session));
  return clone(next);
}

export function fallbackFinishRepair(id: string, status: SessionStatus = "repaired"): SessionRecord {
  const current = sessions.find((session) => session.id === id) ?? sessions[0];
  const elapsedSeconds = current.repairStartedAt
    ? Math.max(0, Math.round((Date.now() - new Date(current.repairStartedAt).getTime()) / 1000))
    : 0;
  const next = withValue({
    ...current,
    status,
    statusUpdatedAt: new Date().toISOString(),
    repairStartedAt: null,
    repairSeconds: current.repairSeconds + elapsedSeconds,
    timeFields: {
      ...current.timeFields,
      repair: "manual"
    }
  });
  sessions = sessions.map((session) => (session.id === next.id ? next : session));
  return clone(next);
}

export function fallbackSettings(): AppSettings {
  return clone(settings);
}

export function saveFallbackSettings(nextSettings: AppSettings): AppSettings {
  settings = clone({
    ...nextSettings,
    integrationSettings: {
      github: {
        ...nextSettings.integrationSettings.github,
        tokenSaved: nextSettings.integrationSettings.github.clearToken
          ? false
          : nextSettings.integrationSettings.github.tokenSaved ||
            Boolean(nextSettings.integrationSettings.github.token),
        token: "",
        clearToken: false
      },
      linear: {
        ...nextSettings.integrationSettings.linear,
        tokenSaved: nextSettings.integrationSettings.linear.clearToken
          ? false
          : nextSettings.integrationSettings.linear.tokenSaved ||
            Boolean(nextSettings.integrationSettings.linear.token),
        token: "",
        clearToken: false
      }
    }
  });
  return fallbackSettings();
}

export function fallbackSyncIntegrations(): IntegrationSyncResult {
  const startedAt = new Date().toISOString();
  let sessionsUpdated = 0;
  let githubLinked = 0;
  let linearLinked = 0;

  sessions = sessions.map((session) => {
    const next = clone(session);
    let changed = false;
    const pullRequest = next.delivery.integration.pullRequest;
    if (settings.integrationSettings.github.enabled && pullRequest) {
      pullRequest.status = "confirmed";
      pullRequest.source = "github_api";
      pullRequest.state = pullRequest.mergeStatus === "merged" ? "closed" : "open";
      next.delivery.integration.reviewCommentCount = next.delivery.integration.reviewCommentCount ?? 3;
      next.delivery.integration.attributionConfidence = Math.max(next.delivery.integration.attributionConfidence, 0.92);
      githubLinked += 2;
      changed = true;
    }
    if (settings.integrationSettings.linear.enabled) {
      for (const issue of next.delivery.integration.issues) {
        if (/^[A-Z][A-Z0-9]{1,9}-\d+$/.test(issue.key)) {
          issue.provider = "linear";
          issue.url = `https://linear.app/sessionary/issue/${issue.key}`;
          issue.title = `${issue.key} confirmed delivery task`;
          issue.state = "In Progress";
          issue.status = "confirmed";
          issue.source = "linear_api";
          next.delivery.integration.attributionConfidence = Math.max(next.delivery.integration.attributionConfidence, 0.88);
          linearLinked += 1;
          changed = true;
        }
      }
    }
    if (changed) sessionsUpdated += 1;
    return next;
  });

  return {
    startedAt,
    finishedAt: new Date().toISOString(),
    github: {
      enabled: settings.integrationSettings.github.enabled,
      attempted: settings.integrationSettings.github.enabled && settings.integrationSettings.github.tokenSaved,
      linked: githubLinked,
      errors: 0,
      message: settings.integrationSettings.github.enabled
        ? `GitHub linked ${githubLinked} remote signal(s)`
        : "GitHub disabled"
    },
    linear: {
      enabled: settings.integrationSettings.linear.enabled,
      attempted: settings.integrationSettings.linear.enabled && settings.integrationSettings.linear.tokenSaved,
      linked: linearLinked,
      errors: 0,
      message: settings.integrationSettings.linear.enabled
        ? `Linear linked ${linearLinked} remote signal(s)`
        : "Linear disabled"
    },
    sessionsUpdated
  };
}

export function fallbackDiagnoseIntegrations(): IntegrationDiagnosticsResult {
  return {
    checkedAt: new Date().toISOString(),
    github: {
      enabled: settings.integrationSettings.github.enabled,
      credentialPresent: settings.integrationSettings.github.tokenSaved,
      ok: settings.integrationSettings.github.enabled && settings.integrationSettings.github.tokenSaved,
      message:
        settings.integrationSettings.github.enabled && settings.integrationSettings.github.tokenSaved
          ? "GitHub diagnostics passed"
          : settings.integrationSettings.github.enabled
            ? "GitHub token missing"
            : "GitHub disabled",
      details: [
        {
          level: settings.integrationSettings.github.tokenSaved ? "success" : "warning",
          label: "Credential",
          value: settings.integrationSettings.github.tokenSaved ? "Token saved" : "No token saved"
        },
        { level: "info", label: "Rate limit remaining", value: "fallback" }
      ]
    },
    linear: {
      enabled: settings.integrationSettings.linear.enabled,
      credentialPresent: settings.integrationSettings.linear.tokenSaved,
      ok: settings.integrationSettings.linear.enabled && settings.integrationSettings.linear.tokenSaved,
      message:
        settings.integrationSettings.linear.enabled && settings.integrationSettings.linear.tokenSaved
          ? "Linear diagnostics passed"
          : settings.integrationSettings.linear.enabled
            ? "Linear token missing"
            : "Linear disabled",
      details: [
        {
          level: settings.integrationSettings.linear.tokenSaved ? "success" : "warning",
          label: "Credential",
          value: settings.integrationSettings.linear.tokenSaved ? "Token saved" : "No token saved"
        },
        { level: "info", label: "Issue keys", value: "2 local key(s)" }
      ]
    }
  };
}

export function fallbackCreateBackup(): BackupResult {
  return {
    path: "/tmp/sessionary-fallback-backup.sqlite",
    bytes: 128000,
    createdAt: new Date().toISOString(),
    message: "Backup created. Keychain tokens are not included."
  };
}

export function fallbackRestoreBackup(path: string): BackupResult {
  return {
    path,
    bytes: 128000,
    createdAt: new Date().toISOString(),
    message: "Backup restored from fallback path."
  };
}

export function fallbackReleaseReadiness(): ReleaseReadinessResult {
  return {
    checkedAt: new Date().toISOString(),
    version: "1.0.0",
    buildCommand: "npm run tauri:build",
    checks: [
      { id: "version", label: "Package and Tauri versions match", status: "pass", detail: "1.0.0" },
      { id: "bundle-active", label: "Tauri bundle is active", status: "pass", detail: "Required for npm run tauri:build" },
      { id: "icons", label: "Bundle icons configured", status: "pass", detail: "icons/icon.png" },
      { id: "signing", label: "Apple signing identity configured", status: "warning", detail: "Set APPLE_SIGNING_IDENTITY for signed builds" }
    ]
  };
}

export function fallbackReport(date = fallbackDate, locale: Locale = "en"): ReportResult {
  const ledger = fallbackLedger(date);
  const t = createTranslator(locale);
  const topProjects = ledger.projects.map((project) => `- ${project.name}: ${project.sessionCount} ${t("report.fallback.sessionUnit")}, ${Math.round(project.activeSeconds / 60)}m ${t("report.fallback.active")}`);
  const openItems = ledger.sessions
    .filter((session) => session.status === "unknown" || session.status === "needs_review" || session.status === "needs_repair")
    .map((session) => `- ${session.projectName}: ${session.summary} (${session.status})`);

  return {
    markdown: [
      `# ${t("report.fallback.title")} - ${date}`,
      "",
      `${t("report.fallback.sessions")}: ${ledger.metrics.sessionCount}`,
      `${t("report.fallback.projects")}: ${ledger.metrics.projectCount}`,
      `${t("report.fallback.parallelWork")}: ${Math.round(ledger.metrics.parallelSeconds / 60)}m`,
      `Parallel project ratio estimated: ${Math.round(ledger.parallelReview.parallelProjectRatio * 100)}%`,
      `AI waiting / human review overlap estimated: ${Math.round(ledger.parallelReview.aiWaitingHumanOverlapSeconds / 60)}m`,
      `Review backlog estimated: ${ledger.parallelReview.reviewBacklogSessionCount} session(s), ${Math.round(ledger.parallelReview.reviewBacklogSeconds / 60)}m`,
      `Context switches: ${ledger.parallelReview.contextSwitchCount} total, ${ledger.parallelReview.shortContextSwitchCount} short`,
      `Delivery absorbed: ${ledger.deliveryReview.absorbedSessions}/${ledger.metrics.sessionCount}`,
      `Delivery commits / dirty: ${ledger.deliveryReview.sessionsWithCommits} committed, ${ledger.deliveryReview.sessionsWithDirtyChanges} dirty`,
      `PR / CI / Issue signals: ${ledger.deliveryReview.sessionsWithPr} PR, ${ledger.deliveryReview.sessionsWithCiSignal} CI/local test, ${ledger.deliveryReview.sessionsWithIssues} issue-linked`,
      `Tool calls: ${ledger.metrics.toolCallCount}`,
      `Tokens: ${ledger.metrics.tokenCount}`,
      `Cost: $${ledger.metrics.costAmount.toFixed(4)}`,
      `Value mix: ${ledger.metrics.highValueCount} high, ${ledger.metrics.lowValueCount} low, ${ledger.metrics.needsRepairValueCount} repair, ${ledger.metrics.discardedValueCount} discarded`,
      "",
      "## Parallel Review",
      `- Parallel project ratio estimated: ${Math.round(ledger.parallelReview.parallelProjectRatio * 100)}%`,
      `- AI waiting / human review overlap estimated: ${Math.round(ledger.parallelReview.aiWaitingHumanOverlapSeconds / 60)}m`,
      `- Review backlog estimated: ${ledger.parallelReview.reviewBacklogSessionCount} session(s), ${Math.round(ledger.parallelReview.reviewBacklogSeconds / 60)}m`,
      `- Context switches: ${ledger.parallelReview.contextSwitchCount} total, ${ledger.parallelReview.shortContextSwitchCount} short`,
      "",
      "## Delivery Review",
      `- File-changing sessions: ${ledger.deliveryReview.sessionsWithFileChanges}`,
      `- Absorbed sessions: ${ledger.deliveryReview.absorbedSessions}`,
      `- Commit signals: ${ledger.deliveryReview.sessionsWithCommits}`,
      `- Dirty after session: ${ledger.deliveryReview.sessionsWithDirtyChanges}`,
      `- Delivery Integrations: ${ledger.deliveryReview.sessionsWithPr} PR, ${ledger.deliveryReview.sessionsWithIssues} issue-linked, ${ledger.deliveryReview.sessionsWithCiSignal} CI/local test signal(s), ${ledger.deliveryReview.mergedSessions} merged`,
      "",
      "## AI Dev Operating Review",
      `- Success rate estimated: ${Math.round(ledger.operatingReview.successRate * 100)}% (${ledger.operatingReview.successfulSessions}/${ledger.operatingReview.totalSessions})`,
      `- Cross-tool sources: ${ledger.operatingReview.crossToolSourceCount}, cross-projects: ${ledger.operatingReview.crossProjectCount}`,
      ...ledger.operatingReview.playbook.map((item) => `- ${item.title}: ${item.detail}`),
      "",
      `## ${t("report.fallback.projects")}`,
      ...topProjects,
      "",
      `## ${t("report.fallback.followUps")}`,
      ...(openItems.length > 0 ? openItems : [`- ${t("report.fallback.noOpenItems")}`])
    ].join("\n")
  };
}

function weekLabels(date: string): [string, string] {
  const [year, month, day] = date.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  const mondayOffset = (parsed.getUTCDay() + 6) % 7;
  const monday = new Date(parsed);
  monday.setUTCDate(parsed.getUTCDate() - mondayOffset);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  const format = (value: Date) => value.toISOString().slice(0, 10);
  return [format(monday), format(sunday)];
}

export function fallbackWeeklyReport(date = fallbackDate, locale: Locale = "en"): ReportResult {
  const ledger = fallbackLedger(date);
  const t = createTranslator(locale);
  const [start, end] = weekLabels(date);
  const topValue = [...ledger.sessions]
    .filter((session) => session.value.category === "high_value" || session.value.category === "mixed_value")
    .sort((left, right) => right.value.score - left.value.score)
    .slice(0, 8);
  const waste = [...ledger.sessions]
    .filter((session) =>
      session.value.category === "low_value" ||
      session.value.category === "needs_human_repair" ||
      session.value.category === "discarded"
    )
    .sort((left, right) => left.value.score - right.value.score)
    .slice(0, 8);
  const line = (session: SessionRecord) =>
    `- ${session.projectName}: ${session.summary} (${session.value.category}, score ${session.value.score}, tools ${session.toolCallCount}, cost ${session.costAmount == null ? "n/a" : `$${session.costAmount.toFixed(4)}`})`;

  return {
    markdown: [
      `# Weekly Report - ${start} to ${end}`,
      "",
      `${t("report.fallback.sessions")}: ${ledger.metrics.sessionCount}`,
      `${t("report.fallback.projects")}: ${ledger.metrics.projectCount}`,
      `Prompting estimated: ${Math.round(ledger.metrics.promptingSecondsEstimated / 60)}m`,
      `AI waiting estimated: ${Math.round(ledger.metrics.aiWaitingSecondsEstimated / 60)}m`,
      `Review estimated: ${Math.round(ledger.metrics.reviewSecondsEstimated / 60)}m`,
      `Repair estimated: ${Math.round(ledger.metrics.repairSecondsEstimated / 60)}m`,
      `Tool calls: ${ledger.metrics.toolCallCount}`,
      `Tokens: ${ledger.metrics.tokenCount}`,
      `Cost: $${ledger.metrics.costAmount.toFixed(4)}`,
      `Delivery absorbed: ${ledger.deliveryReview.absorbedSessions}/${ledger.metrics.sessionCount}`,
      `PR / CI / Issue signals: ${ledger.deliveryReview.sessionsWithPr} PR, ${ledger.deliveryReview.sessionsWithCiSignal} CI/local test, ${ledger.deliveryReview.sessionsWithIssues} issue-linked`,
      "",
      "## Most Valuable Sessions",
      ...(topValue.length > 0 ? topValue.map(line) : ["- No high-value sessions marked yet."]),
      "",
      "## Most Wasteful Sessions",
      ...(waste.length > 0 ? waste.map(line) : ["- No obvious waste sessions based on current marks."]),
      "",
      "## Workflow Notes",
      "- Review and repair are estimated until you confirm them in session detail.",
      "",
      "## Parallel Review",
      `- Parallel project ratio estimated: ${Math.round(ledger.parallelReview.parallelProjectRatio * 100)}%`,
      `- AI waiting / human review overlap estimated: ${Math.round(ledger.parallelReview.aiWaitingHumanOverlapSeconds / 60)}m`,
      `- Review backlog estimated: ${ledger.parallelReview.reviewBacklogSessionCount} session(s), ${Math.round(ledger.parallelReview.reviewBacklogSeconds / 60)}m`,
      `- Context switches: ${ledger.parallelReview.contextSwitchCount} total, ${ledger.parallelReview.shortContextSwitchCount} short`,
      "",
      "## Delivery Review",
      `- File-changing sessions: ${ledger.deliveryReview.sessionsWithFileChanges}`,
      `- Absorbed sessions: ${ledger.deliveryReview.absorbedSessions}`,
      `- Commit signals: ${ledger.deliveryReview.sessionsWithCommits}`,
      `- Dirty after session: ${ledger.deliveryReview.sessionsWithDirtyChanges}`,
      `- Delivery Integrations: ${ledger.deliveryReview.sessionsWithPr} PR, ${ledger.deliveryReview.sessionsWithIssues} issue-linked, ${ledger.deliveryReview.sessionsWithCiSignal} CI/local test signal(s), ${ledger.deliveryReview.mergedSessions} merged`,
      "",
      "## AI Dev Operating Review",
      `- Success rate estimated: ${Math.round(ledger.operatingReview.successRate * 100)}% (${ledger.operatingReview.successfulSessions}/${ledger.operatingReview.totalSessions})`,
      `- Cross-tool sources: ${ledger.operatingReview.crossToolSourceCount}, cross-projects: ${ledger.operatingReview.crossProjectCount}`,
      ...ledger.operatingReview.toolPerformance.map((tool) => `- ${tool.source}: ${tool.sessionCount} session(s), ${tool.successfulSessions} successful, avg score ${Math.round(tool.averageValueScore)}`),
      ...ledger.operatingReview.playbook.map((item) => `- ${item.title}: ${item.detail}`)
    ].join("\n")
  };
}
