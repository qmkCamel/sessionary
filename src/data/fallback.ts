import type {
  AppSettings,
  DayLedger,
  DayMetrics,
  OverlapInterval,
  ProjectSummary,
  ReportResult,
  ScanResult,
  SessionPatch,
  SessionRecord,
  SourceStatus
} from "../shared/types";
import { createTranslator, type Locale } from "../i18n";

const fallbackDate = "2026-05-19";

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

let settings: AppSettings = {
  onboardingCompleted: true,
  language: "system",
  sourceConfigs: [
    { source: "codex", enabled: true, paths: ["~/.codex/sessions", "~/.codex/archived_sessions"] },
    { source: "claude", enabled: true, paths: ["~/.claude/projects", "~/.claude"] }
  ],
  projectRoots: ["/Users/alex/work/sessionary", "/Users/alex/work/marker"]
};

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
    timeFields: {
      prompting: "estimated",
      waiting: "estimated",
      review: "estimated",
      repair: "estimated"
    },
    summary: "Shaped Sessionary into a local-first AI coding session inbox",
    sourceFile: "~/.codex/sessions/2026/05/19/sessionary.jsonl",
    gitBranch: "main",
    gitDirty: true
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
    timeFields: {
      prompting: "estimated",
      waiting: "estimated",
      review: "estimated",
      repair: "estimated"
    },
    summary: "Continued Marker Today flow implementation and roadmap sync",
    sourceFile: "~/.claude/projects/marker/session.jsonl",
    gitBranch: "feature/ios-v1",
    gitDirty: false
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
    timeFields: {
      prompting: "estimated",
      waiting: "estimated",
      review: "estimated",
      repair: "estimated"
    },
    summary: "Patched browser storage adapter and side panel persistence behavior",
    sourceFile: "~/.codex/sessions/2026/05/19/peoplelens.jsonl",
    gitBranch: "add-storage-adapter",
    gitDirty: true
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

function metricsFor(date: string, currentSessions: SessionRecord[]): DayMetrics {
  return {
    date,
    projectCount: new Set(currentSessions.map((session) => session.projectPath)).size,
    sessionCount: currentSessions.length,
    aiWaitingSecondsEstimated: currentSessions.reduce((total, session) => total + session.waitingSeconds, 0),
    promptingSecondsEstimated: currentSessions.reduce((total, session) => total + session.promptingSeconds, 0),
    reviewSecondsEstimated: currentSessions.reduce((total, session) => total + session.reviewSeconds, 0),
    repairSecondsEstimated: currentSessions.reduce((total, session) => total + session.repairSeconds, 0),
    parallelSeconds: overlaps.reduce((total, overlap) => total + overlap.seconds, 0),
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
    reviewStartedAt: session.reviewStartedAt?.replace(fallbackDate, date) ?? null
  }));

  return {
    metrics: metricsFor(date, currentSessions),
    projects: projectSummaries(currentSessions),
    sessions: currentSessions,
    overlaps: clone(overlaps).map((overlap) => ({
      ...overlap,
      startedAt: overlap.startedAt.replace(fallbackDate, date),
      endedAt: overlap.endedAt.replace(fallbackDate, date)
    })),
    sessionOverlaps: clone(overlaps).map((overlap) => ({
      ...overlap,
      startedAt: overlap.startedAt.replace(fallbackDate, date),
      endedAt: overlap.endedAt.replace(fallbackDate, date)
    })),
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
  const next: SessionRecord = {
    ...current,
    ...patch,
    statusUpdatedAt: patch.status ? new Date().toISOString() : current.statusUpdatedAt,
    timeFields: {
      ...current.timeFields,
      prompting: patch.promptingSeconds == null ? current.timeFields.prompting : "manual",
      waiting: patch.waitingSeconds == null ? current.timeFields.waiting : "manual",
      review: patch.reviewSeconds == null ? current.timeFields.review : "manual",
      repair: patch.repairSeconds == null ? current.timeFields.repair : "manual"
    }
  };
  sessions = sessions.map((session) => (session.id === next.id ? next : session));
  return clone(next);
}

export function fallbackSettings(): AppSettings {
  return clone(settings);
}

export function saveFallbackSettings(nextSettings: AppSettings): AppSettings {
  settings = clone(nextSettings);
  return fallbackSettings();
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
      "",
      `## ${t("report.fallback.projects")}`,
      ...topProjects,
      "",
      `## ${t("report.fallback.followUps")}`,
      ...(openItems.length > 0 ? openItems : [`- ${t("report.fallback.noOpenItems")}`])
    ].join("\n")
  };
}
