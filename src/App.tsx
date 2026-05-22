import {
  AlertCircle,
  Check,
  CircleDot,
  Clipboard,
  Clock3,
  Activity,
  Database,
  Download,
  FileText,
  GitBranch,
  Inbox,
  LayoutDashboard,
  Play,
  RefreshCw,
  Search,
  Settings,
  SlidersHorizontal,
  Square,
  Timer,
  Wrench,
  X
} from "lucide-react";
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  createBackup,
  diagnoseIntegrations,
  exportReport,
  exportWeeklyReport,
  finishReview,
  finishRepair,
  generateReport,
  generateWeeklyReport,
  getDay,
  getReleaseReadiness,
  getSettings,
  latestDate,
  patchSession,
  saveSettings,
  scanSources,
  startReview,
  startRepair,
  syncIntegrations,
  restoreBackup
} from "./api";
import { createTranslator, resolveLocale, type LanguageSetting, type Translator, type TranslationKey } from "./i18n";
import type {
  AppSettings,
  BackupResult,
  DayLedger,
  DeliveryInsight,
  DeliveryInsightKind,
  IntegrationDiagnosticsResult,
  IntegrationSyncResult,
  OverlapInterval,
  ParallelInsight,
  ParallelInsightKind,
  PlaybookItem,
  ReleaseReadinessResult,
  SessionPatch,
  SessionRecord,
  SessionStatus,
  SessionValueCategory,
  SessionValueReason,
  TaskType
} from "./shared/types";

type View = "today" | "inbox" | "timeline" | "operating" | "report" | "settings";
type Filter = "all" | SessionStatus;
type ZoomMinutes = 15 | 30 | 60;
type RangeSelection = { startedAt: string; endedAt: string };
type ReportMode = "daily" | "weekly";

const statusKeys: Record<SessionStatus, TranslationKey> = {
  unknown: "status.unknown",
  useful: "status.useful",
  needs_review: "status.needs_review",
  needs_repair: "status.needs_repair",
  repaired: "status.repaired",
  failed: "status.failed",
  discarded: "status.discarded"
};

const sourceLabels = {
  codex: "Codex",
  claude: "Claude"
};

const valueCategoryKeys: Record<SessionValueCategory, TranslationKey> = {
  high_value: "value.high_value",
  mixed_value: "value.mixed_value",
  low_value: "value.low_value",
  needs_human_repair: "value.needs_human_repair",
  discarded: "value.discarded",
  unreviewed: "value.unreviewed"
};

const valueReasonKeys: Record<SessionValueReason, TranslationKey> = {
  marked_useful: "valueReason.marked_useful",
  marked_repaired: "valueReason.marked_repaired",
  has_file_hints: "valueReason.has_file_hints",
  has_tool_calls: "valueReason.has_tool_calls",
  has_token_usage: "valueReason.has_token_usage",
  low_cost: "valueReason.low_cost",
  high_cost: "valueReason.high_cost",
  high_human_time: "valueReason.high_human_time",
  high_repair_time: "valueReason.high_repair_time",
  needs_review: "valueReason.needs_review",
  needs_repair: "valueReason.needs_repair",
  discarded: "valueReason.discarded",
  failed: "valueReason.failed",
  no_output_signals: "valueReason.no_output_signals"
};

const timeFieldKeys = {
  prompting: "time.prompting",
  waiting: "time.waiting",
  review: "time.review",
  repair: "time.repair"
} satisfies Record<"prompting" | "waiting" | "review" | "repair", TranslationKey>;

const parallelInsightKeys: Record<ParallelInsightKind, TranslationKey> = {
  parallel_payoff: "parallelInsight.parallel_payoff",
  review_bottleneck: "parallelInsight.review_bottleneck",
  context_switching: "parallelInsight.context_switching",
  low_parallelism: "parallelInsight.low_parallelism"
};

const deliveryInsightKeys: Record<DeliveryInsightKind, TranslationKey> = {
  unabsorbed_output: "deliveryInsight.unabsorbed_output",
  dirty_after_session: "deliveryInsight.dirty_after_session",
  missing_tests: "deliveryInsight.missing_tests",
  linked_delivery: "deliveryInsight.linked_delivery"
};

const taskTypeKeys: Record<TaskType, TranslationKey> = {
  ui_frontend: "taskType.ui_frontend",
  docs: "taskType.docs",
  tests: "taskType.tests",
  backend: "taskType.backend",
  delivery: "taskType.delivery",
  repair: "taskType.repair",
  unknown: "taskType.unknown"
};

const navItems: Array<{ id: View; labelKey: TranslationKey; icon: typeof LayoutDashboard }> = [
  { id: "today", labelKey: "nav.today", icon: LayoutDashboard },
  { id: "inbox", labelKey: "nav.inbox", icon: Inbox },
  { id: "timeline", labelKey: "nav.timeline", icon: Activity },
  { id: "operating", labelKey: "nav.operating", icon: GitBranch },
  { id: "report", labelKey: "nav.report", icon: FileText },
  { id: "settings", labelKey: "nav.settings", icon: Settings }
];

const TranslationContext = createContext<Translator>(createTranslator("en"));

function useTranslation() {
  return useContext(TranslationContext);
}

function secondsLabel(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

function compactNumber(value: number): string {
  return new Intl.NumberFormat(undefined, { notation: value >= 10_000 ? "compact" : "standard", maximumFractionDigits: 1 }).format(value);
}

function costLabel(value: number | null | undefined): string {
  if (value == null) return "n/a";
  return `$${value.toFixed(value >= 10 ? 2 : 4)}`;
}

function percentLabel(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function timeLabel(iso: string | null, t?: Translator): string {
  if (!iso) return t ? t("common.open") : "open";
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function dayBounds(ledger: DayLedger, zoomMinutes: ZoomMinutes): [number, number] {
  const times = ledger.sessions.flatMap((session) => [
    new Date(session.startedAt).getTime(),
    new Date(session.endedAt ?? session.startedAt).getTime()
  ]);
  if (times.length === 0) {
    const now = Date.now();
    return [now - 60 * 60 * 1000, now + 60 * 60 * 1000];
  }
  const min = Math.min(...times);
  const max = Math.max(...times);
  const step = zoomMinutes * 60 * 1000;
  const padding = Math.max(step, (max - min) * 0.08);
  return [Math.floor((min - padding) / step) * step, Math.ceil((max + padding) / step) * step];
}

function positionFor(startIso: string, endIso: string | null, bounds: [number, number]) {
  const [min, max] = bounds;
  const start = new Date(startIso).getTime();
  const end = new Date(endIso ?? startIso).getTime();
  const span = Math.max(1, max - min);
  const left = Math.max(0, ((start - min) / span) * 100);
  const width = Math.max(1.2, ((Math.max(end, start + 60_000) - start) / span) * 100);
  return { left: `${left}%`, width: `${Math.min(width, 100 - left)}%` };
}

function statusIcon(status: SessionStatus) {
  if (status === "useful" || status === "repaired") return <Check size={14} />;
  if (status === "needs_repair") return <Wrench size={14} />;
  if (status === "failed" || status === "discarded") return <X size={14} />;
  if (status === "needs_review") return <AlertCircle size={14} />;
  return <CircleDot size={14} />;
}

function ValueChip({ session, showScore = false }: { session: SessionRecord; showScore?: boolean }) {
  const t = useTranslation();
  return (
    <span className={`value-chip ${session.value.category}`}>
      {t(valueCategoryKeys[session.value.category])}
      {showScore ? <small>{session.value.score}</small> : null}
    </span>
  );
}

function insightDetail(insight: ParallelInsight, t: Translator): string {
  if (insight.kind === "parallel_payoff") {
    return `${secondsLabel(insight.seconds)} ${t("parallelInsight.waitingReviewOverlap")}`;
  }
  if (insight.kind === "review_bottleneck") {
    return `${insight.count} ${t("common.sessions")} · ${secondsLabel(insight.seconds)} ${t("metric.estimated")}`;
  }
  if (insight.kind === "context_switching") {
    return `${insight.count} ${t("parallelInsight.shortSwitches")}`;
  }
  return `${insight.count} ${t("common.sessions")}`;
}

function ParallelInsightCard({ insight }: { insight: ParallelInsight }) {
  const t = useTranslation();
  return (
    <div className={`insight-card ${insight.severity}`}>
      <strong>{t(parallelInsightKeys[insight.kind])}</strong>
      <span>{insightDetail(insight, t)}</span>
      {insight.projectNames.length > 0 && <small>{insight.projectNames.join(" + ")}</small>}
    </div>
  );
}

function ParallelReviewStrip({ ledger }: { ledger: DayLedger }) {
  const t = useTranslation();
  return (
    <section className="parallel-strip">
      <Metric label={t("parallelReview.parallelRatio")} value={percentLabel(ledger.parallelReview.parallelProjectRatio)} hint={t("metric.estimated")} />
      <Metric label={t("parallelReview.waitingReviewOverlap")} value={secondsLabel(ledger.parallelReview.aiWaitingHumanOverlapSeconds)} hint={t("metric.estimated")} />
      <Metric label={t("parallelReview.reviewBacklog")} value={ledger.parallelReview.reviewBacklogSessionCount} hint={secondsLabel(ledger.parallelReview.reviewBacklogSeconds)} />
      <Metric label={t("parallelReview.shortSwitches")} value={ledger.parallelReview.shortContextSwitchCount} hint={`${ledger.parallelReview.contextSwitchCount} ${t("parallelReview.totalSwitches")}`} />
    </section>
  );
}

function ParallelReviewPanel({
  ledger,
  onOverlapSelect
}: {
  ledger: DayLedger;
  onOverlapSelect: (overlap: OverlapInterval) => void;
}) {
  const t = useTranslation();
  return (
    <section className="panel parallel-review-panel">
      <div className="panel-header">
        <h2>{t("parallelReview.title")}</h2>
        <span>{t("metric.estimated")}</span>
      </div>
      <dl className="parallel-review-stats">
        <div>
          <dt>{t("parallelReview.parallelRatio")}</dt>
          <dd>{percentLabel(ledger.parallelReview.parallelProjectRatio)}</dd>
        </div>
        <div>
          <dt>{t("parallelReview.sessionParallel")}</dt>
          <dd>{secondsLabel(ledger.parallelReview.parallelSessionSeconds)}</dd>
        </div>
        <div>
          <dt>{t("parallelReview.waitingReviewOverlap")}</dt>
          <dd>{secondsLabel(ledger.parallelReview.aiWaitingHumanOverlapSeconds)}</dd>
        </div>
        <div>
          <dt>{t("parallelReview.reviewBacklog")}</dt>
          <dd>{ledger.parallelReview.reviewBacklogSessionCount}</dd>
        </div>
        <div>
          <dt>{t("metric.maxAgents")}</dt>
          <dd>{ledger.parallelReview.maxConcurrentSessions}</dd>
        </div>
        <div>
          <dt>{t("parallelReview.shortSwitches")}</dt>
          <dd>{ledger.parallelReview.shortContextSwitchCount}</dd>
        </div>
      </dl>
      <div className="insight-list">
        {ledger.parallelReview.insights.length === 0 ? (
          <EmptyState title={t("parallelReview.noInsights")} />
        ) : (
          ledger.parallelReview.insights.map((insight) => (
            <ParallelInsightCard key={`${insight.kind}-${insight.count}-${insight.seconds}`} insight={insight} />
          ))
        )}
      </div>
      <div className="panel-header compact">
        <h2>{t("parallelReview.sessionOverlaps")}</h2>
        <span>{ledger.sessionOverlaps.length}</span>
      </div>
      <div className="overlap-list compact-overlap-list">
        {ledger.sessionOverlaps.length === 0 ? (
          <EmptyState title={t("parallelReview.noSessionOverlaps")} />
        ) : (
          ledger.sessionOverlaps.slice(0, 5).map((overlap) => (
            <button
              key={`${overlap.startedAt}-${overlap.endedAt}`}
              onClick={() => onOverlapSelect(overlap)}
            >
              <span>
                <strong>{overlap.sessionIds.length} {t("common.sessions")}</strong>
                <small>{timeLabel(overlap.startedAt, t)}-{timeLabel(overlap.endedAt, t)}</small>
              </span>
              <em>{secondsLabel(overlap.seconds)}</em>
            </button>
          ))
        )}
      </div>
    </section>
  );
}

function deliveryInsightDetail(insight: DeliveryInsight, t: Translator): string {
  if (insight.kind === "unabsorbed_output") return `${insight.count} ${t("deliveryReview.unabsorbed")}`;
  if (insight.kind === "dirty_after_session") return `${insight.count} ${t("deliveryReview.dirty")}`;
  if (insight.kind === "missing_tests") return `${insight.count} ${t("deliveryReview.missingTests")}`;
  return `${insight.count} ${t("deliveryReview.linkedSignals")}`;
}

function DeliveryInsightCard({ insight }: { insight: DeliveryInsight }) {
  const t = useTranslation();
  return (
    <div className={`insight-card ${insight.severity}`}>
      <strong>{t(deliveryInsightKeys[insight.kind])}</strong>
      <span>{deliveryInsightDetail(insight, t)}</span>
    </div>
  );
}

function DeliveryReviewStrip({ ledger }: { ledger: DayLedger }) {
  const t = useTranslation();
  return (
    <section className="delivery-strip">
      <Metric label={t("deliveryReview.absorbed")} value={`${ledger.deliveryReview.absorbedSessions}/${ledger.metrics.sessionCount}`} />
      <Metric label={t("deliveryReview.committed")} value={ledger.deliveryReview.sessionsWithCommits} />
      <Metric label={t("deliveryReview.dirty")} value={ledger.deliveryReview.sessionsWithDirtyChanges} />
      <Metric label={t("deliveryReview.tests")} value={ledger.deliveryReview.sessionsWithTests} />
      <Metric label={t("deliveryReview.prCiIssue")} value={`${ledger.deliveryReview.sessionsWithPr}/${ledger.deliveryReview.sessionsWithCiSignal}/${ledger.deliveryReview.sessionsWithIssues}`} />
    </section>
  );
}

function ciStatusLabel(status: SessionRecord["delivery"]["integration"]["ci"]["status"], t: Translator) {
  if (status === "passed") return t("deliveryReview.ciPassed");
  if (status === "failed") return t("deliveryReview.ciFailed");
  if (status === "running") return t("deliveryReview.ciRunning");
  if (status === "unknown") return t("deliveryReview.ciUnknown");
  return t("deliveryReview.ciNotRecorded");
}

function mergeStatusLabel(status: NonNullable<SessionRecord["delivery"]["integration"]["pullRequest"]>["mergeStatus"], t: Translator) {
  if (status === "merged") return t("deliveryReview.merged");
  if (status === "not_merged") return t("deliveryReview.notMerged");
  return t("deliveryReview.unknownRemote");
}

function issueLabel(issue: SessionRecord["delivery"]["integration"]["issues"][number]) {
  return [issue.key, issue.state, issue.title].filter(Boolean).join(" · ");
}

function byteLabel(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function playbookTitle(item: PlaybookItem, t: Translator) {
  const keys: Record<PlaybookItem["kind"], TranslationKey> = {
    reuse_pattern: "playbook.reuse_pattern",
    clear_review_backlog: "playbook.clear_review_backlog",
    absorb_before_more_agents: "playbook.absorb_before_more_agents",
    keep_parallel_limit_switches: "playbook.keep_parallel_limit_switches",
    add_test_loop: "playbook.add_test_loop"
  };
  return t(keys[item.kind]);
}

function playbookDetail(item: PlaybookItem, t: Translator) {
  const keys: Record<PlaybookItem["kind"], TranslationKey> = {
    reuse_pattern: "playbookDetail.reuse_pattern",
    clear_review_backlog: "playbookDetail.clear_review_backlog",
    absorb_before_more_agents: "playbookDetail.absorb_before_more_agents",
    keep_parallel_limit_switches: "playbookDetail.keep_parallel_limit_switches",
    add_test_loop: "playbookDetail.add_test_loop"
  };
  return t(keys[item.kind]);
}

function overlapsEqual(left?: OverlapInterval, right?: OverlapInterval) {
  return Boolean(left && right && left.startedAt === right.startedAt && left.endedAt === right.endedAt);
}

function sessionsInRange(ledger: DayLedger, range?: RangeSelection) {
  if (!range) return [];
  const start = new Date(range.startedAt).getTime();
  const end = new Date(range.endedAt).getTime();
  return ledger.sessions.filter((session) => {
    const sessionStart = new Date(session.startedAt).getTime();
    const sessionEnd = new Date(session.endedAt ?? session.startedAt).getTime();
    return sessionStart < end && sessionEnd > start;
  });
}

function openLoopCount(ledger: DayLedger) {
  return ledger.metrics.unknownCount + ledger.metrics.needsReviewCount + ledger.metrics.needsRepairCount;
}

function humanTimeEstimateSeconds(ledger: DayLedger) {
  return ledger.metrics.promptingSecondsEstimated + ledger.metrics.reviewSecondsEstimated + ledger.metrics.repairSecondsEstimated;
}

function prioritySessions(ledger: DayLedger) {
  const priority: Record<SessionStatus, number> = {
    needs_repair: 0,
    needs_review: 1,
    unknown: 2,
    useful: 3,
    repaired: 4,
    failed: 5,
    discarded: 6
  };
  return [...ledger.sessions]
    .filter((session) => session.status === "unknown" || session.status === "needs_review" || session.status === "needs_repair")
    .sort((left, right) => priority[left.status] - priority[right.status] || new Date(left.startedAt).getTime() - new Date(right.startedAt).getTime());
}

function SourceHealthChips({ ledger }: { ledger: DayLedger }) {
  const t = useTranslation();
  return (
    <div className="source-summary" aria-label={t("settings.sources")}>
      {ledger.sourceStatus.map((source) => (
        <span className="source-pill" key={source.source}>
          <span className={`source-dot ${source.source}`} />
          <strong>{sourceLabels[source.source]}</strong>
          <span>{source.enabled ? t("common.connected") : t("common.disabled")}</span>
        </span>
      ))}
    </div>
  );
}

function WorkspaceHeader({
  ledger,
  scanning,
  onRescan
}: {
  ledger: DayLedger;
  scanning: boolean;
  onRescan: () => void;
}) {
  const t = useTranslation();
  return (
    <header className="workspace-header">
      <div className="workspace-status">
        <SourceHealthChips ledger={ledger} />
        <span className="freshness">
          {t("common.lastScan")} {timeLabel(ledger.metrics.generatedAt, t)}
        </span>
      </div>
      <button className="rescan-button" title={t("sources.rescan")} onClick={onRescan}>
        <RefreshCw size={15} className={scanning ? "spin" : ""} />
        <span>{t("sources.rescan")}</span>
      </button>
    </header>
  );
}

function AppSidebar({
  view,
  date,
  ledger,
  error,
  onDateChange,
  onViewChange
}: {
  view: View;
  date: string;
  ledger: DayLedger;
  error?: string;
  onDateChange: (date: string) => void;
  onViewChange: (view: View) => void;
}) {
  const t = useTranslation();
  return (
    <aside className="sidebar">
      <div className="brand">
        <strong>Sessionary</strong>
        <span>{t("brand.tagline")}</span>
      </div>
      <input className="date-input" type="date" value={date} onChange={(event) => onDateChange(event.target.value)} />
      <nav aria-label="Sessionary">
        {navItems.map((item) => {
          const Icon = item.icon;
          const badge = item.id === "inbox" ? openLoopCount(ledger) : undefined;
          return (
            <button key={item.id} className={view === item.id ? "active" : ""} onClick={() => onViewChange(item.id)}>
              <Icon size={17} />
              <span>{t(item.labelKey)}</span>
              {badge ? <small>{badge}</small> : null}
            </button>
          );
        })}
      </nav>
      <div className="sidebar-footer">
        <span>{t("common.localOnly")}</span>
        <span>{ledger.sourceStatus.length} {t("settings.sources")}</span>
      </div>
      {error && <p className="sidebar-error">{error}</p>}
    </aside>
  );
}

function EmptyState({ title }: { title: string }) {
  return (
    <div className="empty-state">
      <Database size={24} />
      <strong>{title}</strong>
    </div>
  );
}

function Metric({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <section className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
      {hint && <small>{hint}</small>}
    </section>
  );
}

function SessionPill({ session, selected, onSelect }: { session: SessionRecord; selected: boolean; onSelect: () => void }) {
  const t = useTranslation();
  return (
    <button className={`session-row ${selected ? "selected" : ""}`} onClick={onSelect}>
      <span className={`source-dot ${session.source}`} />
      <span className="session-row-main">
        <strong>{session.summary || session.sourceSessionId}</strong>
        <small>
          {sourceLabels[session.source]} · {session.projectName} · {secondsLabel(session.durationSeconds)}
        </small>
      </span>
      <span className={`status-chip ${session.status}`}>{t(statusKeys[session.status])}</span>
    </button>
  );
}

function TimelineCanvas({
  ledger,
  selectedId,
  zoomMinutes,
  selectedOverlap,
  selectedRange,
  onSelect,
  onOverlapSelect,
  onRangeSelect
}: {
  ledger: DayLedger;
  selectedId?: string;
  zoomMinutes: ZoomMinutes;
  selectedOverlap?: OverlapInterval;
  selectedRange?: RangeSelection;
  onSelect: (session: SessionRecord) => void;
  onOverlapSelect?: (overlap: OverlapInterval) => void;
  onRangeSelect?: (range: RangeSelection) => void;
}) {
  const t = useTranslation();
  const bounds = useMemo(() => dayBounds(ledger, zoomMinutes), [ledger, zoomMinutes]);
  const [dragStart, setDragStart] = useState<number | null>(null);
  const [dragEnd, setDragEnd] = useState<number | null>(null);
  const dragStartRef = useRef<number | null>(null);
  const dragEndRef = useRef<number | null>(null);
  const tracks = useMemo(() => {
    const grouped = new Map<string, SessionRecord[]>();
    for (const session of ledger.sessions) {
      grouped.set(session.projectName, [...(grouped.get(session.projectName) ?? []), session]);
    }
    return [...grouped.entries()];
  }, [ledger.sessions]);

  if (ledger.sessions.length === 0) return <EmptyState title={t("timeline.noSessions")} />;

  const timeFromClientX = (clientX: number, element: HTMLElement) => {
    const rect = element.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return bounds[0] + ratio * (bounds[1] - bounds[0]);
  };

  const beginDrag = (clientX: number, element: HTMLElement) => {
    const time = timeFromClientX(clientX, element);
    dragStartRef.current = time;
    dragEndRef.current = time;
    setDragStart(time);
    setDragEnd(time);
  };

  const moveDrag = (clientX: number, element: HTMLElement) => {
    if (dragStartRef.current == null) return;
    const time = timeFromClientX(clientX, element);
    dragEndRef.current = time;
    setDragEnd(time);
  };

  const finishDrag = (clientX: number, element: HTMLElement) => {
    const startValue = dragStartRef.current;
    if (startValue == null) return;
    const endValue = timeFromClientX(clientX, element);
    const start = Math.min(startValue, endValue);
    const end = Math.max(startValue, endValue);
    if (end - start > 60_000) {
      onRangeSelect?.({ startedAt: new Date(start).toISOString(), endedAt: new Date(end).toISOString() });
    }
    clearDrag();
  };

  const clearDrag = () => {
    dragStartRef.current = null;
    dragEndRef.current = null;
    setDragStart(null);
    setDragEnd(null);
  };

  const activeDrag =
    dragStart != null && dragEnd != null
      ? {
          startedAt: new Date(Math.min(dragStart, dragEnd)).toISOString(),
          endedAt: new Date(Math.max(dragStart, dragEnd)).toISOString()
        }
      : selectedRange;

  return (
    <div className="timeline-canvas">
      <div className="timeline-ruler">
        <span>{timeLabel(new Date(bounds[0]).toISOString(), t)}</span>
        <span>{timeLabel(new Date((bounds[0] + bounds[1]) / 2).toISOString(), t)}</span>
        <span>{timeLabel(new Date(bounds[1]).toISOString(), t)}</span>
      </div>
      <div className="timeline-body">
        {ledger.sessionOverlaps.map((overlap) => (
          <button
            key={`session-${overlap.startedAt}-${overlap.endedAt}`}
            className={`session-overlap-band ${overlapsEqual(selectedOverlap, overlap) ? "selected" : ""}`}
            style={positionFor(overlap.startedAt, overlap.endedAt, bounds)}
            title={`${overlap.sessionIds.length} ${t("common.sessions")} · ${secondsLabel(overlap.seconds)}`}
            onClick={() => onOverlapSelect?.(overlap)}
          />
        ))}
        {ledger.overlaps.map((overlap) => (
          <button
            key={`project-${overlap.startedAt}-${overlap.endedAt}`}
            className={`overlap-band ${overlapsEqual(selectedOverlap, overlap) ? "selected" : ""}`}
            style={positionFor(overlap.startedAt, overlap.endedAt, bounds)}
            title={`${overlap.projectNames.join(", ")} · ${secondsLabel(overlap.seconds)}`}
            onClick={() => onOverlapSelect?.(overlap)}
          />
        ))}
        {activeDrag && (
          <div
            className="range-band"
            style={positionFor(activeDrag.startedAt, activeDrag.endedAt, bounds)}
          />
        )}
        {tracks.map(([project, sessions]) => (
          <div className="project-track" key={project}>
            <div className="track-label">
              <strong>{project}</strong>
              <small>{sessions.length} sessions</small>
            </div>
            <div
              className="track-line"
              onMouseDown={(event) => {
                event.preventDefault();
                beginDrag(event.clientX, event.currentTarget);
              }}
              onMouseMove={(event) => {
                if (event.buttons !== 1) return;
                moveDrag(event.clientX, event.currentTarget);
              }}
              onMouseUp={(event) => {
                finishDrag(event.clientX, event.currentTarget);
              }}
              onMouseLeave={clearDrag}
            >
              {sessions.map((session) => (
                <button
                  key={session.id}
                  className={`timeline-block ${session.source} ${session.status} ${selectedId === session.id ? "selected" : ""}`}
                  style={positionFor(session.startedAt, session.endedAt, bounds)}
                  title={`${sourceLabels[session.source]} · ${timeLabel(session.startedAt, t)}-${timeLabel(session.endedAt, t)} · ${session.toolCallCount} ${t("common.tools")}`}
                  onMouseDown={(event) => event.stopPropagation()}
                  onClick={() => onSelect(session)}
                >
                  <span>{session.userMessageCount}</span>
                  <small>{secondsLabel(session.durationSeconds)}</small>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TodayView({
  ledger,
  selectedId,
  zoomMinutes,
  selectedOverlap,
  selectedRange,
  onZoom,
  onSelect,
  onOverlapSelect,
  onRangeSelect,
  onNavigate
}: {
  ledger: DayLedger;
  selectedId?: string;
  zoomMinutes: ZoomMinutes;
  selectedOverlap?: OverlapInterval;
  selectedRange?: RangeSelection;
  onZoom: (zoom: ZoomMinutes) => void;
  onSelect: (session: SessionRecord) => void;
  onOverlapSelect: (overlap: OverlapInterval) => void;
  onRangeSelect: (range: RangeSelection) => void;
  onNavigate: (view: View, filter?: Filter) => void;
}) {
  const t = useTranslation();
  const queue = prioritySessions(ledger);
  const visibleQueue = queue.slice(0, 5);
  return (
    <main className="workspace today-workspace">
      <div className="page-title">
        <div>
          <p>{ledger.metrics.date}</p>
          <h1>{t("nav.today")}</h1>
          <span>{t("today.openLoops")}</span>
        </div>
        <span className="status-chip needs_review">{openLoopCount(ledger)} {t("today.needsAttention")}</span>
      </div>

      <div className="metrics-grid">
        <Metric label={t("today.reviewQueue")} value={openLoopCount(ledger)} />
        <Metric label={t("metric.repair")} value={ledger.metrics.needsRepairCount} />
        <Metric label={t("metric.parallel")} value={secondsLabel(ledger.metrics.parallelSeconds)} />
        <Metric label={t("today.humanTime")} value={secondsLabel(humanTimeEstimateSeconds(ledger))} hint={t("metric.estimated")} />
        <Metric label={t("metric.highValue")} value={ledger.metrics.highValueCount} />
        <Metric label={t("metric.tools")} value={compactNumber(ledger.metrics.toolCallCount)} />
        <Metric label={t("metric.tokens")} value={compactNumber(ledger.metrics.tokenCount)} />
        <Metric label={t("metric.cost")} value={costLabel(ledger.metrics.costAmount)} />
      </div>

      <ParallelReviewStrip ledger={ledger} />
      <DeliveryReviewStrip ledger={ledger} />

      {ledger.parallelReview.insights.length > 0 && (
        <section className="insight-grid" aria-label={t("parallelReview.insights")}>
          {ledger.parallelReview.insights.slice(0, 3).map((insight) => (
            <ParallelInsightCard key={`${insight.kind}-${insight.count}-${insight.seconds}`} insight={insight} />
          ))}
        </section>
      )}

      {ledger.deliveryReview.insights.length > 0 && (
        <section className="insight-grid" aria-label={t("deliveryReview.insights")}>
          {ledger.deliveryReview.insights.slice(0, 3).map((insight) => (
            <DeliveryInsightCard key={`${insight.kind}-${insight.count}`} insight={insight} />
          ))}
        </section>
      )}

      <div className="today-primary-grid">
        <section className="panel review-queue-panel">
          <div className="panel-header">
            <h2>{t("today.reviewQueue")}</h2>
            <span>{t("today.nextActions")}</span>
          </div>
          <div className="review-queue">
            {visibleQueue.length === 0 ? (
              <EmptyState title={t("inbox.clear")} />
            ) : (
              visibleQueue.map((session) => (
                <button
                  className={`queue-card ${selectedId === session.id ? "selected" : ""}`}
                  key={session.id}
                  onClick={() => onSelect(session)}
                >
                  <span className={`source-dot ${session.source}`} />
                  <span>
                    <strong>{session.projectName}</strong>
                    <small>{t(statusKeys[session.status])} · {secondsLabel(session.durationSeconds)} · {session.toolCallCount} {t("common.tools")}</small>
                  </span>
                  <span className={`status-chip ${session.status}`}>{t(statusKeys[session.status])}</span>
                </button>
              ))
            )}
          </div>
          <div className="queue-actions">
            <button onClick={() => onNavigate("inbox", "unknown")}>{t("status.unknown")} {ledger.metrics.unknownCount}</button>
            <button onClick={() => onNavigate("inbox", "needs_review")}>{t("inbox.review")} {ledger.metrics.needsReviewCount}</button>
            <button onClick={() => onNavigate("inbox", "needs_repair")}>{t("inbox.repair")} {ledger.metrics.needsRepairCount}</button>
          </div>
        </section>

        <section className="panel timeline-preview-panel">
          <div className="panel-header">
            <h2>{t("today.dayTimeline")}</h2>
            <div className="segmented-control">
              {([15, 30, 60] as ZoomMinutes[]).map((zoom) => (
                <button key={zoom} className={zoomMinutes === zoom ? "active" : ""} onClick={() => onZoom(zoom)}>
                  {zoom}m
                </button>
              ))}
            </div>
          </div>
          <TimelineCanvas
            ledger={ledger}
            selectedId={selectedId}
            zoomMinutes={zoomMinutes}
            selectedOverlap={selectedOverlap}
            selectedRange={selectedRange}
            onSelect={onSelect}
            onOverlapSelect={onOverlapSelect}
            onRangeSelect={onRangeSelect}
          />
        </section>
      </div>

      <section className="panel project-work-panel">
        <div className="panel-header">
          <h2>{t("today.projectWork")}</h2>
          <span>{ledger.projects.filter((project) => project.isParallel).length} {t("common.parallel")}</span>
        </div>
        <div className="project-table">
          <div className="project-table-row table-head">
            <span>{t("metric.projects")}</span>
            <span>{t("metric.sessions")}</span>
            <span>{t("metric.aiWaiting")}</span>
            <span>{t("metric.review")}</span>
            <span>{t("metric.parallel")}</span>
            <span>{t("common.status")}</span>
          </div>
          {ledger.projects.map((project) => {
            const projectSessions = ledger.sessions.filter((session) => session.projectPath === project.path);
            const waiting = projectSessions.reduce((total, session) => total + session.waitingSeconds, 0);
            const review = projectSessions.reduce((total, session) => total + session.reviewSeconds, 0);
            const hasRepair = projectSessions.some((session) => session.status === "needs_repair");
            const hasReview = projectSessions.some((session) => session.status === "needs_review" || session.status === "unknown");
            const status = hasRepair ? "needs_repair" : hasReview ? "needs_review" : "useful";
            return (
              <button
                key={project.path}
                className="project-table-row"
                onClick={() => onSelect(projectSessions[0] ?? ledger.sessions[0])}
              >
                <span className="project-name">
                  <GitBranch size={14} />
                  <span>
                    <strong>{project.name}</strong>
                    <small>{project.path}</small>
                  </span>
                </span>
                <span>{project.sessionCount}</span>
                <span>{secondsLabel(waiting)}</span>
                <span>{secondsLabel(review)}</span>
                <span>{project.isParallel ? secondsLabel(project.activeSeconds) : "0m"}</span>
                <span className={`status-chip ${status}`}>{t(statusKeys[status])}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="panel recent-sessions-panel">
        <div className="panel-header">
          <h2>{t("nav.inbox")}</h2>
          <span>{ledger.metrics.sessionCount} {t("common.sessions")}</span>
        </div>
        <div className="compact-list">
          {ledger.sessions.slice(0, 5).map((session) => (
            <SessionPill key={session.id} session={session} selected={selectedId === session.id} onSelect={() => onSelect(session)} />
          ))}
        </div>
      </section>
    </main>
  );
}

function InboxView({
  ledger,
  selected,
  filter,
  search,
  onFilter,
  onSearch,
  onSelect,
  onStatus,
  inspector
}: {
  ledger: DayLedger;
  selected?: SessionRecord;
  filter: Filter;
  search: string;
  onFilter: (filter: Filter) => void;
  onSearch: (search: string) => void;
  onSelect: (session: SessionRecord) => void;
  onStatus: (session: SessionRecord, status: SessionStatus) => Promise<void>;
  inspector: ReactNode;
}) {
  const t = useTranslation();
  const [recentlyUpdatedId, setRecentlyUpdatedId] = useState<string>();
  const filtered = ledger.sessions.filter((session) => {
    const matchesFilter = filter === "all" || session.status === filter || session.id === recentlyUpdatedId;
    const text = `${session.summary} ${session.projectName} ${session.source}`.toLowerCase();
    return matchesFilter && text.includes(search.toLowerCase());
  });

  const markStatus = async (session: SessionRecord, status: SessionStatus) => {
    const currentIndex = filtered.findIndex((item) => item.id === session.id);
    const next = filtered[currentIndex + 1] ?? filtered[currentIndex - 1];
    setRecentlyUpdatedId(session.id);
    await onStatus(session, status);
    window.setTimeout(() => {
      setRecentlyUpdatedId(undefined);
      if (next) onSelect(next);
    }, 650);
  };

  return (
    <main className="workspace inbox-workspace">
      <div className="inbox-layout">
        <div className="inbox-main">
          <div className="page-title">
            <div>
              <p>{ledger.metrics.date}</p>
              <h1>{t("nav.inbox")}</h1>
              <span>{t("inbox.subhead")}</span>
            </div>
            <div className="search-box">
              <Search size={16} />
              <input value={search} onChange={(event) => onSearch(event.target.value)} placeholder={t("inbox.search")} />
            </div>
          </div>

          <div className="filter-bar">
            {(["all", "unknown", "useful", "needs_review", "needs_repair", "discarded"] as Filter[]).map((item) => (
              <button key={item} className={filter === item ? "active" : ""} onClick={() => onFilter(item)}>
                {item === "all" ? t("common.all") : t(statusKeys[item])}
              </button>
            ))}
          </div>

          <section className="panel inbox-panel">
            {filtered.length === 0 ? (
              <EmptyState title={t("inbox.clear")} />
            ) : (
              filtered.map((session) => (
                <article className={`inbox-card ${selected?.id === session.id ? "selected" : ""}`} key={session.id} onClick={() => onSelect(session)}>
                  <div className="inbox-card-main">
                    <span className={`source-dot ${session.source}`} />
                    <div>
                      <h2>{session.summary || session.sourceSessionId}</h2>
                      <p>
                        {sourceLabels[session.source]} · {session.projectName} · {timeLabel(session.startedAt, t)}-{timeLabel(session.endedAt, t)}
                      </p>
                    </div>
                  </div>
                  <div className="session-stats">
                    <span>{session.userMessageCount} {t("inbox.prompts")}</span>
                    <span>{session.assistantMessageCount} {t("inbox.replies")}</span>
                    <span>{session.toolCallCount} {t("common.tools")}</span>
                    <span>{secondsLabel(session.durationSeconds)}</span>
                    <span>{compactNumber(session.tokenCount ?? 0)} {t("metric.tokens")}</span>
                    <span>{costLabel(session.costAmount)}</span>
                    <span>{session.changedFiles.length} {t("detail.files")}</span>
                  </div>
                  <div className="quick-actions" onClick={(event) => event.stopPropagation()}>
                    <button title={t("status.useful")} onClick={() => void markStatus(session, "useful")}>
                      <Check size={16} />
                    </button>
                    <button title={t("status.needs_review")} onClick={() => void markStatus(session, "needs_review")}>
                      <AlertCircle size={16} />
                    </button>
                    <button title={t("status.needs_repair")} onClick={() => void markStatus(session, "needs_repair")}>
                      <Wrench size={16} />
                    </button>
                    <button title={t("status.discarded")} onClick={() => void markStatus(session, "discarded")}>
                      <X size={16} />
                    </button>
                  </div>
                  <div className="session-badges">
                    <ValueChip session={session} />
                    <span className={`status-chip ${session.status}`}>
                      {statusIcon(session.status)}
                      {t(statusKeys[session.status])}
                    </span>
                  </div>
                </article>
              ))
            )}
          </section>
        </div>
        <aside className="page-inspector inbox-inspector">{inspector}</aside>
      </div>
    </main>
  );
}

function ProjectTimelineView({
  ledger,
  selectedId,
  zoomMinutes,
  selectedOverlap,
  selectedRange,
  onZoom,
  onSelect,
  onOverlapSelect,
  onRangeSelect,
  inspector
}: {
  ledger: DayLedger;
  selectedId?: string;
  zoomMinutes: ZoomMinutes;
  selectedOverlap?: OverlapInterval;
  selectedRange?: RangeSelection;
  onZoom: (zoom: ZoomMinutes) => void;
  onSelect: (session: SessionRecord) => void;
  onOverlapSelect: (overlap: OverlapInterval) => void;
  onRangeSelect: (range: RangeSelection) => void;
  inspector?: ReactNode;
}) {
  const t = useTranslation();
  const rangeSessions = sessionsInRange(ledger, selectedRange);
  const rangeProjects = [...new Set(rangeSessions.map((session) => session.projectName))];

  return (
    <main className="workspace timeline-workspace">
      <div className="page-title">
        <div>
          <p>{ledger.metrics.date}</p>
          <h1>{t("nav.timeline")}</h1>
        </div>
        <span className="freshness">
          {ledger.metrics.maxConcurrentProjects} {t("metric.projects")} · {secondsLabel(ledger.metrics.parallelSeconds)}
        </span>
      </div>

      <div className={`timeline-layout ${inspector ? "with-inspector" : ""}`}>
        <section className="panel tall timeline-canvas-panel">
          <div className="timeline-toolbar">
            <div className="segmented-control">
              {([15, 30, 60] as ZoomMinutes[]).map((zoom) => (
                <button key={zoom} className={zoomMinutes === zoom ? "active" : ""} onClick={() => onZoom(zoom)}>
                  {zoom}m
                </button>
              ))}
            </div>
            {selectedRange && (
              <span>
                {timeLabel(selectedRange.startedAt, t)}-{timeLabel(selectedRange.endedAt, t)} · {rangeSessions.length} {t("common.sessions")} · {rangeProjects.length} {t("metric.projects")}
              </span>
            )}
          </div>
          <TimelineCanvas
            ledger={ledger}
            selectedId={selectedId}
            zoomMinutes={zoomMinutes}
            selectedOverlap={selectedOverlap}
            selectedRange={selectedRange}
            onSelect={onSelect}
            onOverlapSelect={onOverlapSelect}
            onRangeSelect={onRangeSelect}
          />
        </section>

        {inspector && <aside className="page-inspector timeline-inspector">{inspector}</aside>}
      </div>

      <ParallelReviewPanel ledger={ledger} onOverlapSelect={onOverlapSelect} />

      <section className="panel overlap-summary-panel">
        <div className="panel-header">
          <h2>{t("projectTimeline.overlapSummary")}</h2>
          <span>{ledger.overlaps.length} {t("projectTimeline.intervals")}</span>
        </div>
        <div className="overlap-list">
          {ledger.overlaps.length === 0 ? (
            <EmptyState title={t("projectTimeline.noParallel")} />
          ) : (
            ledger.overlaps.slice(0, 4).map((overlap) => (
              <button
                key={`${overlap.startedAt}-${overlap.endedAt}`}
                className={overlapsEqual(selectedOverlap, overlap) ? "selected" : ""}
                onClick={() => onOverlapSelect(overlap)}
              >
                <span>
                  <strong>{overlap.projectNames.join(" + ")}</strong>
                  <small>
                    {timeLabel(overlap.startedAt, t)}-{timeLabel(overlap.endedAt, t)}
                  </small>
                </span>
                <em>{secondsLabel(overlap.seconds)}</em>
              </button>
            ))
          )}
        </div>
      </section>
    </main>
  );
}

function ReportOverview({ ledger }: { ledger: DayLedger }) {
  const t = useTranslation();
  const totalTime =
    ledger.metrics.promptingSecondsEstimated +
    ledger.metrics.aiWaitingSecondsEstimated +
    ledger.metrics.reviewSecondsEstimated +
    ledger.metrics.repairSecondsEstimated;
  const topProjects = [...ledger.projects].sort((left, right) => right.activeSeconds - left.activeSeconds).slice(0, 5);

  return (
    <aside className="report-overview">
      <section className="panel">
        <div className="panel-header">
          <h2>{t("report.keyMetrics")}</h2>
        </div>
        <dl className="overview-list">
          <div>
            <dt>{t("metric.projects")}</dt>
            <dd>{ledger.metrics.projectCount}</dd>
          </div>
          <div>
            <dt>{t("metric.sessions")}</dt>
            <dd>{ledger.metrics.sessionCount}</dd>
          </div>
          <div>
            <dt>{t("status.needs_review")}</dt>
            <dd>{ledger.metrics.needsReviewCount}</dd>
          </div>
          <div>
            <dt>{t("status.needs_repair")}</dt>
            <dd>{ledger.metrics.needsRepairCount}</dd>
          </div>
          <div>
            <dt>{t("metric.highValue")}</dt>
            <dd>{ledger.metrics.highValueCount}</dd>
          </div>
          <div>
            <dt>{t("metric.lowValue")}</dt>
            <dd>{ledger.metrics.lowValueCount}</dd>
          </div>
        </dl>
      </section>

      <section className="panel">
        <div className="panel-header">
          <h2>{t("report.timeTotal")}</h2>
          <span>{secondsLabel(totalTime)}</span>
        </div>
        <dl className="overview-list">
          <div>
            <dt>{t("metric.prompting")}</dt>
            <dd>{secondsLabel(ledger.metrics.promptingSecondsEstimated)}</dd>
          </div>
          <div>
            <dt>{t("metric.aiWaiting")}</dt>
            <dd>{secondsLabel(ledger.metrics.aiWaitingSecondsEstimated)}</dd>
          </div>
          <div>
            <dt>{t("metric.review")}</dt>
            <dd>{secondsLabel(ledger.metrics.reviewSecondsEstimated)}</dd>
          </div>
          <div>
            <dt>{t("metric.repair")}</dt>
            <dd>{secondsLabel(ledger.metrics.repairSecondsEstimated)}</dd>
          </div>
        </dl>
      </section>

      <section className="panel">
        <div className="panel-header">
          <h2>{t("report.topProjects")}</h2>
        </div>
        <div className="compact-list">
          {topProjects.map((project, index) => (
            <div className="overview-row" key={project.path}>
              <span>{index + 1}. {project.name}</span>
              <strong>{secondsLabel(project.activeSeconds)}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <h2>{t("detail.activity")}</h2>
        </div>
        <dl className="overview-list">
          <div>
            <dt>{t("metric.tools")}</dt>
            <dd>{compactNumber(ledger.metrics.toolCallCount)}</dd>
          </div>
          <div>
            <dt>{t("metric.tokens")}</dt>
            <dd>{compactNumber(ledger.metrics.tokenCount)}</dd>
          </div>
          <div>
            <dt>{t("metric.cost")}</dt>
            <dd>{costLabel(ledger.metrics.costAmount)}</dd>
          </div>
          <div>
            <dt>{t("value.needs_human_repair")}</dt>
            <dd>{ledger.metrics.needsRepairValueCount}</dd>
          </div>
        </dl>
      </section>

      <section className="panel">
        <div className="panel-header">
          <h2>{t("parallelReview.title")}</h2>
          <span>{t("metric.estimated")}</span>
        </div>
        <dl className="overview-list">
          <div>
            <dt>{t("parallelReview.parallelRatio")}</dt>
            <dd>{percentLabel(ledger.parallelReview.parallelProjectRatio)}</dd>
          </div>
          <div>
            <dt>{t("parallelReview.waitingReviewOverlap")}</dt>
            <dd>{secondsLabel(ledger.parallelReview.aiWaitingHumanOverlapSeconds)}</dd>
          </div>
          <div>
            <dt>{t("parallelReview.reviewBacklog")}</dt>
            <dd>{ledger.parallelReview.reviewBacklogSessionCount}</dd>
          </div>
          <div>
            <dt>{t("parallelReview.shortSwitches")}</dt>
            <dd>{ledger.parallelReview.shortContextSwitchCount}</dd>
          </div>
        </dl>
      </section>

      <section className="panel">
        <div className="panel-header">
          <h2>{t("deliveryReview.title")}</h2>
        </div>
        <dl className="overview-list">
          <div>
            <dt>{t("deliveryReview.absorbed")}</dt>
            <dd>{ledger.deliveryReview.absorbedSessions}/{ledger.metrics.sessionCount}</dd>
          </div>
          <div>
            <dt>{t("deliveryReview.committed")}</dt>
            <dd>{ledger.deliveryReview.sessionsWithCommits}</dd>
          </div>
          <div>
            <dt>{t("deliveryReview.prLinked")}</dt>
            <dd>{ledger.deliveryReview.sessionsWithPr}</dd>
          </div>
          <div>
            <dt>{t("deliveryReview.ciSignals")}</dt>
            <dd>{ledger.deliveryReview.sessionsWithCiSignal}</dd>
          </div>
        </dl>
      </section>

      <section className="panel">
        <div className="panel-header">
          <h2>{t("operatingReview.title")}</h2>
          <span>{percentLabel(ledger.operatingReview.successRate)}</span>
        </div>
        <dl className="overview-list">
          <div>
            <dt>{t("operatingReview.sources")}</dt>
            <dd>{ledger.operatingReview.crossToolSourceCount}</dd>
          </div>
          <div>
            <dt>{t("operatingReview.projects")}</dt>
            <dd>{ledger.operatingReview.crossProjectCount}</dd>
          </div>
          <div>
            <dt>{t("operatingReview.playbook")}</dt>
            <dd>{ledger.operatingReview.playbook.length}</dd>
          </div>
        </dl>
      </section>

      <section className="panel privacy-panel">
        <div className="panel-header">
          <h2>{t("common.localOnly")}</h2>
        </div>
        <p>{t("report.privacyNote")}</p>
      </section>
    </aside>
  );
}

function OperatingReviewView({ ledger, onSelect }: { ledger: DayLedger; onSelect: (session: SessionRecord) => void }) {
  const t = useTranslation();
  const deliveryRows = ledger.sessions
    .filter((session) => session.delivery.changedFiles.length > 0 || session.delivery.committedAfterSession || session.delivery.integration.pullRequest)
    .slice(0, 8);

  return (
    <main className="workspace operating-workspace">
      <div className="page-title">
        <div>
          <p>{ledger.metrics.date}</p>
          <h1>{t("nav.operating")}</h1>
          <span>{t("operatingReview.subhead")}</span>
        </div>
        <span className="freshness">
          {percentLabel(ledger.operatingReview.successRate)} · {ledger.operatingReview.playbook.length} {t("operatingReview.playbook")}
        </span>
      </div>

      <div className="metrics-grid operating-metrics">
        <Metric label={t("operatingReview.successRate")} value={percentLabel(ledger.operatingReview.successRate)} hint={`${ledger.operatingReview.successfulSessions}/${ledger.operatingReview.totalSessions}`} />
        <Metric label={t("operatingReview.sources")} value={ledger.operatingReview.crossToolSourceCount} />
        <Metric label={t("operatingReview.projects")} value={ledger.operatingReview.crossProjectCount} />
        <Metric label={t("deliveryReview.absorbed")} value={`${ledger.deliveryReview.absorbedSessions}/${ledger.deliveryReview.sessionsWithFileChanges}`} />
        <Metric label={t("deliveryReview.prLinked")} value={ledger.deliveryReview.sessionsWithPr} />
        <Metric label={t("deliveryReview.ciSignals")} value={ledger.deliveryReview.sessionsWithCiSignal} />
      </div>

      <section className="panel playbook-panel">
        <div className="panel-header">
          <h2>{t("operatingReview.playbook")}</h2>
          <span>{ledger.operatingReview.playbook.length}</span>
        </div>
        <div className="playbook-list">
          {ledger.operatingReview.playbook.length === 0 ? (
            <EmptyState title={t("operatingReview.noPlaybook")} />
          ) : (
            ledger.operatingReview.playbook.map((item) => (
              <article key={`${item.kind}-${item.sessionIds.join("-")}`} className="playbook-card">
                <strong>{playbookTitle(item, t)}</strong>
                <span>{playbookDetail(item, t)}</span>
                <small>
                  {item.source ? sourceLabels[item.source] : t("common.localOnly")}
                  {item.taskType ? ` · ${t(taskTypeKeys[item.taskType])}` : ""}
                </small>
              </article>
            ))
          )}
        </div>
      </section>

      <div className="operating-grid">
        <section className="panel">
          <div className="panel-header">
            <h2>{t("operatingReview.toolPerformance")}</h2>
          </div>
          <div className="operating-table">
            <div className="operating-table-row table-head">
              <span>{t("settings.sources")}</span>
              <span>{t("metric.sessions")}</span>
              <span>{t("operatingReview.successful")}</span>
              <span>{t("detail.value")}</span>
              <span>{t("operatingReview.topTask")}</span>
            </div>
            {ledger.operatingReview.toolPerformance.map((tool) => (
              <div className="operating-table-row" key={tool.source}>
                <span>{sourceLabels[tool.source]}</span>
                <span>{tool.sessionCount}</span>
                <span>{tool.successfulSessions}</span>
                <span>{Math.round(tool.averageValueScore)}</span>
                <span>{tool.topTaskType ? t(taskTypeKeys[tool.topTaskType]) : t("taskType.unknown")}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <h2>{t("operatingReview.taskTypes")}</h2>
          </div>
          <div className="operating-table">
            <div className="operating-table-row table-head">
              <span>{t("operatingReview.task")}</span>
              <span>{t("metric.sessions")}</span>
              <span>{t("operatingReview.successful")}</span>
              <span>{t("metric.repair")}</span>
              <span>{t("operatingReview.bestTool")}</span>
            </div>
            {ledger.operatingReview.taskTypes.map((task) => (
              <div className="operating-table-row" key={task.taskType}>
                <span>{t(taskTypeKeys[task.taskType])}</span>
                <span>{task.sessionCount}</span>
                <span>{task.successfulSessions}</span>
                <span>{task.repairSessions}</span>
                <span>{task.recommendedSource ? sourceLabels[task.recommendedSource] : t("common.notAvailable")}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="panel delivery-chain-panel">
        <div className="panel-header">
          <h2>{t("deliveryReview.chain")}</h2>
          <span>{t("deliveryReview.localAttribution")}</span>
        </div>
        <div className="delivery-table">
          <div className="delivery-table-row table-head">
            <span>{t("metric.sessions")}</span>
            <span>{t("deliveryReview.absorbed")}</span>
            <span>{t("deliveryReview.committed")}</span>
            <span>{t("deliveryReview.dirty")}</span>
            <span>{t("deliveryReview.prLinked")}</span>
            <span>{t("deliveryReview.ciSignals")}</span>
            <span>{t("deliveryReview.issues")}</span>
          </div>
          {deliveryRows.map((session) => (
            <button className="delivery-table-row" key={session.id} onClick={() => onSelect(session)}>
              <span>
                <strong>{session.projectName}</strong>
                <small>{session.summary}</small>
              </span>
              <span>{session.delivery.absorbed ? t("common.enabled") : t("common.off")}</span>
              <span>{session.delivery.committedAfterSession ? session.delivery.commits.length : 0}</span>
              <span>{session.delivery.dirtyAfterSession ? t("common.enabled") : t("common.off")}</span>
              <span>{session.delivery.integration.pullRequest ? mergeStatusLabel(session.delivery.integration.pullRequest.mergeStatus, t) : t("common.notAvailable")}</span>
              <span>{ciStatusLabel(session.delivery.integration.ci.status, t)}</span>
              <span>{session.delivery.integration.issues.map(issueLabel).join(", ") || t("common.notAvailable")}</span>
            </button>
          ))}
        </div>
      </section>
    </main>
  );
}

function ReportView({
  ledger,
  mode,
  markdown,
  exportedPath,
  onModeChange,
  onGenerate,
  onChange,
  onCopy,
  onExport
}: {
  ledger: DayLedger;
  mode: ReportMode;
  markdown: string;
  exportedPath?: string;
  onModeChange: (mode: ReportMode) => void;
  onGenerate: () => void;
  onChange: (value: string) => void;
  onCopy: () => void;
  onExport: () => void;
}) {
  const t = useTranslation();
  return (
    <main className="workspace report-view">
      <div className="page-title">
        <div>
          <p>{ledger.metrics.date}</p>
          <h1>{t("nav.report")}</h1>
        </div>
        <div className="report-actions">
          <div className="segmented-control">
            {(["daily", "weekly"] as ReportMode[]).map((item) => (
              <button key={item} className={mode === item ? "active" : ""} onClick={() => onModeChange(item)}>
                {t(item === "daily" ? "report.daily" : "report.weekly")}
              </button>
            ))}
          </div>
          <div className="toolbar">
            <button title={t("report.generate")} onClick={onGenerate}>
              <RefreshCw size={16} />
            </button>
            <button title={t("report.copy")} onClick={onCopy}>
              <Clipboard size={16} />
            </button>
            <button title={t("report.export")} onClick={onExport}>
              <Download size={16} />
            </button>
          </div>
        </div>
      </div>
      <div className="report-layout">
        <section className="report-document">
          <textarea className="report-editor" value={markdown} onChange={(event) => onChange(event.target.value)} />
          {exportedPath && <p className="export-path">{t("report.exportedTo")} {exportedPath}</p>}
        </section>
        <ReportOverview ledger={ledger} />
      </div>
    </main>
  );
}

function SettingsEditor({
  settings,
  onChange,
  onSave,
  onScan,
  onSyncIntegrations,
  onDiagnoseIntegrations,
  onCreateBackup,
  onRestoreBackup,
  onCheckRelease,
  integrationSyncing = false,
  integrationSyncResult,
  integrationDiagnostics,
  integrationDiagnosing = false,
  backupResult,
  backupWorking = false,
  restorePath,
  onRestorePathChange,
  releaseReadiness,
  releaseChecking = false,
  compact = false
}: {
  settings: AppSettings;
  onChange: (settings: AppSettings) => void;
  onSave: () => void;
  onScan?: () => void;
  onSyncIntegrations?: () => void;
  onDiagnoseIntegrations?: () => void;
  onCreateBackup?: () => void;
  onRestoreBackup?: () => void;
  onCheckRelease?: () => void;
  integrationSyncing?: boolean;
  integrationSyncResult?: IntegrationSyncResult | null;
  integrationDiagnostics?: IntegrationDiagnosticsResult | null;
  integrationDiagnosing?: boolean;
  backupResult?: BackupResult | null;
  backupWorking?: boolean;
  restorePath?: string;
  onRestorePathChange?: (value: string) => void;
  releaseReadiness?: ReleaseReadinessResult | null;
  releaseChecking?: boolean;
  compact?: boolean;
}) {
  const t = useTranslation();
  const updatePaths = (source: "codex" | "claude", value: string) => {
    onChange({
      ...settings,
      sourceConfigs: settings.sourceConfigs.map((config) =>
        config.source === source ? { ...config, paths: value.split("\n").map((line) => line.trim()).filter(Boolean) } : config
      )
    });
  };

  const toggleSource = (source: "codex" | "claude") => {
    onChange({
      ...settings,
      sourceConfigs: settings.sourceConfigs.map((config) =>
        config.source === source ? { ...config, enabled: !config.enabled } : config
      )
    });
  };

  const updateLanguage = (language: LanguageSetting) => {
    onChange({
      ...settings,
      language
    });
  };

  const updateIntegration = (
    provider: "github" | "linear",
    patch: Partial<AppSettings["integrationSettings"]["github"]>
  ) => {
    onChange({
      ...settings,
      integrationSettings: {
        ...settings.integrationSettings,
        [provider]: {
          ...settings.integrationSettings[provider],
          ...patch
        }
      }
    });
  };

  return (
    <div className={compact ? "settings-editor compact" : "settings-editor"}>
      <section className="panel">
        <div className="panel-header">
          <h2>{t("settings.language")}</h2>
          <span>{t("settings.languageHint")}</span>
        </div>
        <div className="segmented-control language-control">
          {([
            ["system", "language.system"],
            ["en", "language.english"],
            ["zh-CN", "language.simplifiedChinese"]
          ] as Array<[LanguageSetting, TranslationKey]>).map(([value, labelKey]) => (
            <button key={value} className={(settings.language ?? "system") === value ? "active" : ""} onClick={() => updateLanguage(value)}>
              {t(labelKey)}
            </button>
          ))}
        </div>
      </section>
      {settings.sourceConfigs.map((config) => (
        <section className="panel" key={config.source}>
          <div className="panel-header">
            <h2>{sourceLabels[config.source]}</h2>
            <label className="switch">
              <input type="checkbox" checked={config.enabled} onChange={() => toggleSource(config.source)} />
              <span>{config.enabled ? t("common.enabled") : t("common.off")}</span>
            </label>
          </div>
          <textarea
            value={config.paths.join("\n")}
            onChange={(event) => updatePaths(config.source, event.target.value)}
            spellCheck={false}
          />
        </section>
      ))}
      <section className="panel">
        <div className="panel-header">
          <h2>{t("settings.projectRoots")}</h2>
          <span>{t("common.optional")}</span>
        </div>
        <textarea
          value={settings.projectRoots.join("\n")}
          onChange={(event) =>
            onChange({
              ...settings,
              projectRoots: event.target.value.split("\n").map((line) => line.trim()).filter(Boolean)
            })
          }
          spellCheck={false}
        />
      </section>
      {!compact && (
        <section className="panel integrations-panel">
          <div className="panel-header">
            <div>
              <h2>{t("settings.integrations")}</h2>
              <span>{t("settings.integrationsHint")}</span>
            </div>
            {integrationSyncResult && (
              <span>{integrationSyncResult.sessionsUpdated} {t("settings.sessionsUpdated")}</span>
            )}
          </div>
          <div className="integration-provider-list">
            {([
              ["github", "GitHub", "settings.githubToken"],
              ["linear", "Linear", "settings.linearToken"]
            ] as Array<["github" | "linear", string, TranslationKey]>).map(([provider, label, placeholderKey]) => (
              <div className="integration-provider" key={provider}>
                <div className="integration-provider-head">
                  <strong>{label}</strong>
                  <label className="switch">
                    <input
                      type="checkbox"
                      checked={settings.integrationSettings[provider].enabled}
                      onChange={() =>
                        updateIntegration(provider, {
                          enabled: !settings.integrationSettings[provider].enabled
                        })
                      }
                    />
                    <span>{settings.integrationSettings[provider].enabled ? t("common.enabled") : t("common.off")}</span>
                  </label>
                </div>
                <input
                  type="password"
                  value={settings.integrationSettings[provider].token}
                  placeholder={t(placeholderKey)}
                  onChange={(event) => updateIntegration(provider, { token: event.target.value })}
                  spellCheck={false}
                />
                {settings.integrationSettings[provider].tokenSaved && !settings.integrationSettings[provider].token && (
                  <small>
                    {t("settings.tokenSaved")}
                  </small>
                )}
                {settings.integrationSettings[provider].tokenSaved && (
                  <button
                    className="quiet-button"
                    onClick={() => updateIntegration(provider, { token: "", tokenSaved: false, clearToken: true })}
                  >
                    {t("settings.clearToken")}
                  </button>
                )}
                {integrationSyncResult && <small>{integrationSyncResult[provider].message}</small>}
              </div>
            ))}
          </div>
          <div className="release-actions">
            <button className="sync-button" onClick={onSyncIntegrations} disabled={integrationSyncing}>
              <RefreshCw className={integrationSyncing ? "spin" : ""} size={15} />
              {integrationSyncing ? t("settings.syncingIntegrations") : t("settings.syncIntegrations")}
            </button>
            <button className="sync-button" onClick={onDiagnoseIntegrations} disabled={integrationDiagnosing}>
              <Activity className={integrationDiagnosing ? "spin" : ""} size={15} />
              {integrationDiagnosing ? t("settings.runningDiagnostics") : t("settings.runDiagnostics")}
            </button>
          </div>
          {integrationDiagnostics && (
            <div className="diagnostic-grid">
              {(["github", "linear"] as const).map((provider) => (
                <div className={`diagnostic-card ${integrationDiagnostics[provider].ok ? "pass" : "warning"}`} key={provider}>
                  <strong>{provider === "github" ? "GitHub" : "Linear"}</strong>
                  <span>{integrationDiagnostics[provider].message}</span>
                  {integrationDiagnostics[provider].details.map((detail) => (
                    <small className={`diagnostic-detail ${detail.level}`} key={`${provider}-${detail.label}-${detail.value}`}>
                      {detail.label}: {detail.value}
                    </small>
                  ))}
                </div>
              ))}
            </div>
          )}
        </section>
      )}
      {!compact && (
        <section className="panel release-panel">
          <div className="panel-header">
            <div>
              <h2>{t("settings.backupRestore")}</h2>
              <span>{t("settings.backupHint")}</span>
            </div>
          </div>
          <div className="release-actions">
            <button className="sync-button" onClick={onCreateBackup} disabled={backupWorking}>
              <Download size={15} />
              {t("settings.createBackup")}
            </button>
          </div>
          {backupResult && (
            <div className="result-box">
              <strong>{backupResult.message}</strong>
              <small>{backupResult.path}</small>
              <small>{byteLabel(backupResult.bytes)}</small>
            </div>
          )}
          <input
            type="text"
            value={restorePath ?? ""}
            placeholder={t("settings.restorePath")}
            onChange={(event) => onRestorePathChange?.(event.target.value)}
            spellCheck={false}
          />
          <button className="sync-button" onClick={onRestoreBackup} disabled={backupWorking || !(restorePath ?? "").trim()}>
            <RefreshCw size={15} />
            {t("settings.restoreBackup")}
          </button>
        </section>
      )}
      {!compact && (
        <section className="panel release-panel">
          <div className="panel-header">
            <div>
              <h2>{t("settings.releaseReadiness")}</h2>
              <span>{t("settings.releaseHint")}</span>
            </div>
            {releaseReadiness && <span>{releaseReadiness.version}</span>}
          </div>
          <button className="sync-button" onClick={onCheckRelease} disabled={releaseChecking}>
            <Check size={15} />
            {releaseChecking ? t("settings.checkingRelease") : t("settings.checkRelease")}
          </button>
          {releaseReadiness && (
            <div className="release-check-list">
              {releaseReadiness.checks.map((check) => (
                <div className={`release-check ${check.status}`} key={check.id}>
                  <strong>{check.label}</strong>
                  <span>{check.status}</span>
                  <small>{check.detail}</small>
                </div>
              ))}
              <code>{releaseReadiness.buildCommand}</code>
            </div>
          )}
        </section>
      )}
      <div className="settings-actions">
        <button className="primary-button" onClick={onSave}>{t("common.save")}</button>
        {onScan && <button onClick={onScan}>{t("common.saveAndScan")}</button>}
      </div>
    </div>
  );
}

function SettingsView({
  settings,
  onChange,
  onSave,
  onScan,
  onSyncIntegrations,
  onDiagnoseIntegrations,
  onCreateBackup,
  onRestoreBackup,
  onCheckRelease,
  integrationSyncing,
  integrationSyncResult,
  integrationDiagnostics,
  integrationDiagnosing,
  backupResult,
  backupWorking,
  restorePath,
  onRestorePathChange,
  releaseReadiness,
  releaseChecking
}: {
  settings: AppSettings;
  onChange: (settings: AppSettings) => void;
  onSave: () => void;
  onScan: () => void;
  onSyncIntegrations: () => void;
  onDiagnoseIntegrations: () => void;
  onCreateBackup: () => void;
  onRestoreBackup: () => void;
  onCheckRelease: () => void;
  integrationSyncing: boolean;
  integrationSyncResult: IntegrationSyncResult | null;
  integrationDiagnostics: IntegrationDiagnosticsResult | null;
  integrationDiagnosing: boolean;
  backupResult: BackupResult | null;
  backupWorking: boolean;
  restorePath: string;
  onRestorePathChange: (value: string) => void;
  releaseReadiness: ReleaseReadinessResult | null;
  releaseChecking: boolean;
}) {
  const t = useTranslation();
  return (
    <main className="workspace">
      <div className="page-title">
        <div>
          <p>{t("common.localOnly")}</p>
          <h1>{t("nav.settings")}</h1>
        </div>
      </div>
      <SettingsEditor
        settings={settings}
        onChange={onChange}
        onSave={onSave}
        onScan={onScan}
        onSyncIntegrations={onSyncIntegrations}
        onDiagnoseIntegrations={onDiagnoseIntegrations}
        onCreateBackup={onCreateBackup}
        onRestoreBackup={onRestoreBackup}
        onCheckRelease={onCheckRelease}
        integrationSyncing={integrationSyncing}
        integrationSyncResult={integrationSyncResult}
        integrationDiagnostics={integrationDiagnostics}
        integrationDiagnosing={integrationDiagnosing}
        backupResult={backupResult}
        backupWorking={backupWorking}
        restorePath={restorePath}
        onRestorePathChange={onRestorePathChange}
        releaseReadiness={releaseReadiness}
        releaseChecking={releaseChecking}
      />
    </main>
  );
}

function Onboarding({
  settings,
  onChange,
  onComplete
}: {
  settings: AppSettings;
  onChange: (settings: AppSettings) => void;
  onComplete: () => void;
}) {
  const t = useTranslation();
  return (
    <div className="onboarding-shell">
      <div className="onboarding-copy">
        <strong>Sessionary</strong>
        <h1>{t("onboarding.title")}</h1>
        <p>{t("onboarding.body")}</p>
      </div>
      <SettingsEditor settings={settings} onChange={onChange} onSave={onComplete} onScan={onComplete} compact />
    </div>
  );
}

function DetailPanel({
  session,
  ledger,
  overlap,
  range,
  onPatch,
  onSelect,
  onStartReview,
  onFinishReview,
  onStartRepair,
  onFinishRepair
}: {
  session?: SessionRecord;
  ledger: DayLedger;
  overlap?: OverlapInterval;
  range?: RangeSelection;
  onPatch: (session: SessionRecord, patch: SessionPatch) => void;
  onSelect: (session: SessionRecord) => void;
  onStartReview: (session: SessionRecord) => void;
  onFinishReview: (session: SessionRecord, status?: SessionStatus) => void;
  onStartRepair: (session: SessionRecord) => void;
  onFinishRepair: (session: SessionRecord, status?: SessionStatus) => void;
}) {
  const t = useTranslation();
  const [note, setNote] = useState("");
  const [times, setTimes] = useState({ prompting: 0, waiting: 0, review: 0, repair: 0 });

  useEffect(() => {
    setNote(session?.note ?? "");
    setTimes({
      prompting: Math.round((session?.promptingSeconds ?? 0) / 60),
      waiting: Math.round((session?.waitingSeconds ?? 0) / 60),
      review: Math.round((session?.reviewSeconds ?? 0) / 60),
      repair: Math.round((session?.repairSeconds ?? 0) / 60)
    });
  }, [session]);

  if (overlap) {
    const overlapSessions = ledger.sessions.filter((item) => overlap.sessionIds.includes(item.id));
    return (
      <aside className="detail-panel">
        <div className="detail-title">
          <span className="overlap-dot" />
          <div>
            <h2>{t("projectTimeline.overlapSummary")}</h2>
            <p>{overlap.projectNames.join(" + ")}</p>
          </div>
        </div>
        <section className="detail-section">
          <h3>{t("detail.interval")}</h3>
          <dl className="detail-stats">
            <div>
              <dt>{t("detail.started")}</dt>
              <dd>{timeLabel(overlap.startedAt, t)}</dd>
            </div>
            <div>
              <dt>{t("detail.ended")}</dt>
              <dd>{timeLabel(overlap.endedAt, t)}</dd>
            </div>
            <div>
              <dt>{t("detail.duration")}</dt>
              <dd>{secondsLabel(overlap.seconds)}</dd>
            </div>
            <div>
              <dt>{t("detail.sessions")}</dt>
              <dd>{overlap.sessionIds.length}</dd>
            </div>
          </dl>
        </section>
        <section className="detail-section">
          <h3>{t("detail.sessions")}</h3>
          <div className="compact-list">
            {overlapSessions.map((item) => (
              <SessionPill key={item.id} session={item} selected={false} onSelect={() => onSelect(item)} />
            ))}
          </div>
        </section>
      </aside>
    );
  }

  if (range) {
    const rangeSessions = sessionsInRange(ledger, range);
    const projects = [...new Set(rangeSessions.map((item) => item.projectName))];
    return (
      <aside className="detail-panel">
        <div className="detail-title">
          <SlidersHorizontal size={18} />
          <div>
            <h2>{t("detail.selectedRange")}</h2>
            <p>
              {timeLabel(range.startedAt, t)}-{timeLabel(range.endedAt, t)}
            </p>
          </div>
        </div>
        <section className="detail-section">
          <h3>{t("detail.range")}</h3>
          <dl className="detail-stats">
            <div>
              <dt>{t("detail.projects")}</dt>
              <dd>{projects.length}</dd>
            </div>
            <div>
              <dt>{t("detail.sessions")}</dt>
              <dd>{rangeSessions.length}</dd>
            </div>
          </dl>
        </section>
        <section className="detail-section">
          <h3>{t("detail.projects")}</h3>
          <div className="file-list">{projects.map((project) => <span key={project}>{project}</span>)}</div>
        </section>
      </aside>
    );
  }

  if (!session) {
    return (
      <aside className="detail-panel">
        <EmptyState title={t("detail.selectSession")} />
      </aside>
    );
  }

  return (
    <aside className="detail-panel">
      <div className="detail-title">
        <span className={`source-dot ${session.source}`} />
        <div>
          <h2>{session.summary || session.sourceSessionId}</h2>
          <p>{session.projectPath}</p>
        </div>
      </div>

      <div className="status-grid">
        {(["useful", "needs_review", "needs_repair", "repaired", "failed", "discarded"] as SessionStatus[]).map((status) => (
          <button key={status} className={session.status === status ? "active" : ""} onClick={() => onPatch(session, { status })}>
            {statusIcon(status)}
            {t(statusKeys[status])}
          </button>
        ))}
      </div>

      <section className="detail-section">
        <h3>{t("detail.value")}</h3>
        <div className="value-summary">
          <ValueChip session={session} showScore />
          <span>{session.value.score}/100</span>
        </div>
        <div className="file-list">
          {session.value.reasons.map((reason) => (
            <span key={reason}>{t(valueReasonKeys[reason])}</span>
          ))}
        </div>
      </section>

      <section className="detail-section delivery-detail-section">
        <h3>{t("deliveryReview.title")}</h3>
        <div className="delivery-state-row">
          <button
            className={session.delivery.absorbed ? "active" : ""}
            onClick={() => onPatch(session, { absorbed: !session.delivery.absorbed })}
          >
            <Check size={15} />
            {session.delivery.absorbed ? t("deliveryReview.absorbed") : t("deliveryReview.markAbsorbed")}
          </button>
          <span>{Math.round(session.delivery.confidence * 100)}% {t("deliveryReview.confidence")}</span>
        </div>
        <dl className="detail-stats">
          <div>
            <dt>{t("deliveryReview.committed")}</dt>
            <dd>{session.delivery.committedAfterSession ? session.delivery.commits.length : 0}</dd>
          </div>
          <div>
            <dt>{t("deliveryReview.dirty")}</dt>
            <dd>{session.delivery.dirtyAfterSession ? t("common.enabled") : t("common.off")}</dd>
          </div>
          <div>
            <dt>{t("deliveryReview.tests")}</dt>
            <dd>{session.delivery.testCommands.length}</dd>
          </div>
          <div>
            <dt>{t("deliveryReview.ciSignals")}</dt>
            <dd>{ciStatusLabel(session.delivery.integration.ci.status, t)}</dd>
          </div>
        </dl>
        {session.delivery.diffSummary && <p className="delivery-summary">{session.delivery.diffSummary}</p>}
        <div className="delivery-link-list">
          {session.delivery.integration.pullRequest && (
            <span>
              {t("deliveryReview.prLinked")}: {session.delivery.integration.pullRequest.url ?? t("deliveryReview.unknownRemote")} · {mergeStatusLabel(session.delivery.integration.pullRequest.mergeStatus, t)}
              {session.delivery.integration.pullRequest.state ? ` · ${session.delivery.integration.pullRequest.state}` : ""}
            </span>
          )}
          {session.delivery.integration.issues.length > 0 && (
            <span>
              {t("deliveryReview.issues")}: {session.delivery.integration.issues.map(issueLabel).join(", ")}
            </span>
          )}
          <span>
            {t("deliveryReview.reviewComments")}: {session.delivery.integration.reviewCommentCount ?? t("deliveryReview.unknownRemote")}
          </span>
        </div>
        {session.delivery.testCommands.length > 0 && (
          <div className="file-list command-list">
            {session.delivery.testCommands.slice(0, 5).map((command) => (
              <span key={command.command}>{command.command} · {command.status}</span>
            ))}
          </div>
        )}
      </section>

      <section className="detail-section">
        <h3>{t("detail.reviewFlow")}</h3>
        <div className="review-actions">
          <button className={session.reviewStartedAt ? "active" : ""} onClick={() => onStartReview(session)}>
            <Play size={15} />
            {t("detail.startReview")}
          </button>
          <button onClick={() => onFinishReview(session, "useful")}>
            <Square size={15} />
            {t("detail.done")}
          </button>
          <button onClick={() => onFinishReview(session, "needs_repair")}>
            <Wrench size={15} />
            {t("detail.needsRepair")}
          </button>
        </div>
        {session.reviewStartedAt && <small>{t("detail.reviewRunningSince")} {timeLabel(session.reviewStartedAt, t)}</small>}
      </section>

      <section className="detail-section">
        <h3>{t("detail.repairFlow")}</h3>
        <div className="review-actions">
          <button className={session.repairStartedAt ? "active" : ""} onClick={() => onStartRepair(session)}>
            <Play size={15} />
            {t("detail.startRepair")}
          </button>
          <button onClick={() => onFinishRepair(session, "repaired")}>
            <Square size={15} />
            {t("detail.markRepaired")}
          </button>
          <button onClick={() => onPatch(session, { status: "needs_repair" })}>
            <Wrench size={15} />
            {t("detail.needsRepair")}
          </button>
        </div>
        {session.repairStartedAt && <small>{t("detail.repairRunningSince")} {timeLabel(session.repairStartedAt, t)}</small>}
      </section>

      <section className="detail-section">
        <h3>{t("detail.time")}</h3>
        <div className="time-grid">
          {(["prompting", "waiting", "review", "repair"] as const).map((field) => (
            <label key={field}>
              <span>
                {t(timeFieldKeys[field])}
                <small>{session.timeFields[field] === "manual" ? t("common.manual") : t("metric.estimated")}</small>
              </span>
              <input
                type="number"
                min="0"
                value={times[field]}
                onChange={(event) => setTimes({ ...times, [field]: Number(event.target.value) })}
              />
            </label>
          ))}
        </div>
        <button
          className="primary-button"
          onClick={() =>
            onPatch(session, {
              promptingSeconds: times.prompting * 60,
              waitingSeconds: times.waiting * 60,
              reviewSeconds: times.review * 60,
              repairSeconds: times.repair * 60
            })
          }
        >
          {t("detail.saveTime")}
        </button>
      </section>

      <section className="detail-section">
        <h3>{t("detail.activity")}</h3>
        <dl className="detail-stats">
          <div>
            <dt>{t("detail.started")}</dt>
            <dd>{timeLabel(session.startedAt, t)}</dd>
          </div>
          <div>
            <dt>{t("detail.ended")}</dt>
            <dd>{timeLabel(session.endedAt, t)}</dd>
          </div>
          <div>
            <dt>{t("detail.duration")}</dt>
            <dd>{secondsLabel(session.durationSeconds)}</dd>
          </div>
          <div>
            <dt>{t("detail.tokens")}</dt>
            <dd>{session.tokenCount?.toLocaleString() ?? t("common.notAvailable")}</dd>
          </div>
          <div>
            <dt>{t("metric.tools")}</dt>
            <dd>{session.toolCallCount}</dd>
          </div>
          <div>
            <dt>{t("detail.cost")}</dt>
            <dd>{session.costAmount == null ? "n/a" : `$${session.costAmount.toFixed(4)}`}</dd>
          </div>
        </dl>
      </section>

      <section className="detail-section">
        <h3>{t("detail.files")}</h3>
        <div className="file-list">
          {session.changedFiles.length === 0 ? <span>{t("detail.noFileHints")}</span> : session.changedFiles.map((file) => <span key={file}>{file}</span>)}
        </div>
      </section>

      <section className="detail-section">
        <h3>{t("detail.note")}</h3>
        <textarea value={note} onChange={(event) => setNote(event.target.value)} />
        <button className="primary-button" onClick={() => onPatch(session, { note })}>
          {t("detail.saveNote")}
        </button>
      </section>
    </aside>
  );
}

export function App() {
  const [view, setView] = useState<View>("today");
  const [ledger, setLedger] = useState<DayLedger | null>(null);
  const [selectedId, setSelectedId] = useState<string>();
  const [date, setDate] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string>();
  const [markdown, setMarkdown] = useState("");
  const [exportedPath, setExportedPath] = useState<string>();
  const [reportMode, setReportMode] = useState<ReportMode>("daily");
  const [renderedReportKey, setRenderedReportKey] = useState("");
  const [settingsState, setSettingsState] = useState<AppSettings | null>(null);
  const [integrationSyncing, setIntegrationSyncing] = useState(false);
  const [integrationSyncResult, setIntegrationSyncResult] = useState<IntegrationSyncResult | null>(null);
  const [integrationDiagnosing, setIntegrationDiagnosing] = useState(false);
  const [integrationDiagnostics, setIntegrationDiagnostics] = useState<IntegrationDiagnosticsResult | null>(null);
  const [backupWorking, setBackupWorking] = useState(false);
  const [backupResult, setBackupResult] = useState<BackupResult | null>(null);
  const [restorePath, setRestorePath] = useState("");
  const [releaseChecking, setReleaseChecking] = useState(false);
  const [releaseReadiness, setReleaseReadiness] = useState<ReleaseReadinessResult | null>(null);
  const [zoomMinutes, setZoomMinutes] = useState<ZoomMinutes>(30);
  const [selectedOverlap, setSelectedOverlap] = useState<OverlapInterval>();
  const [selectedRange, setSelectedRange] = useState<RangeSelection>();
  const locale = resolveLocale(
    settingsState?.language ?? "system",
    typeof navigator === "undefined" ? undefined : navigator.language
  );
  const t = useMemo(() => createTranslator(locale), [locale]);

  const selected = useMemo(() => {
    if (!ledger) return undefined;
    if (!selectedId) return undefined;
    return ledger.sessions.find((session) => session.id === selectedId);
  }, [ledger, selectedId]);

  const load = async (targetDate?: string, shouldScan = false) => {
    setError(undefined);
    setLoading(true);
    try {
      let resolvedDate = targetDate || date;
      const loadedSettings = await getSettings();
      setSettingsState(loadedSettings);
      if (!loadedSettings.onboardingCompleted) {
        setLoading(false);
        return;
      }
      if (!resolvedDate) resolvedDate = await latestDate();
      if (shouldScan) {
        setScanning(true);
        await scanSources();
        setScanning(false);
      }
      const nextLedger = await getDay(resolvedDate);
      setDate(nextLedger.metrics.date);
      setLedger(nextLedger);
      setSelectedId((current) => current ?? nextLedger.sessions[0]?.id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setScanning(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    void load(undefined, true);
  }, []);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (view !== "inbox" || !ledger || !selected) return;
      const index = ledger.sessions.findIndex((session) => session.id === selected.id);
      if (event.key.toLowerCase() === "j") setSelectedId(ledger.sessions[Math.min(ledger.sessions.length - 1, index + 1)]?.id);
      if (event.key.toLowerCase() === "k") setSelectedId(ledger.sessions[Math.max(0, index - 1)]?.id);
      if (event.key === "1") void applyPatch(selected, { status: "useful" });
      if (event.key === "2") void applyPatch(selected, { status: "needs_review" });
      if (event.key === "3") void applyPatch(selected, { status: "needs_repair" });
      if (event.key === "4") void applyPatch(selected, { status: "discarded" });
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [view, ledger, selected]);

  const applyPatch = async (session: SessionRecord, patch: SessionPatch) => {
    const updated = await patchSession(session.id, patch);
    const nextLedger = await getDay(date || ledger?.metrics.date);
    setLedger(nextLedger);
    setSelectedId(updated.id);
    setSelectedOverlap(undefined);
    setSelectedRange(undefined);
  };

  const selectSession = (session: SessionRecord) => {
    setSelectedId(session.id);
    setSelectedOverlap(undefined);
    setSelectedRange(undefined);
  };

  const selectOverlap = (overlap: OverlapInterval) => {
    setSelectedOverlap(overlap);
    setSelectedRange(undefined);
    setSelectedId(undefined);
  };

  const selectRange = (range: RangeSelection) => {
    setSelectedRange(range);
    setSelectedOverlap(undefined);
    setSelectedId(undefined);
  };

  const persistSettings = async (next?: AppSettings) => {
    const settingsToSave = next ?? settingsState;
    if (!settingsToSave) return;
    const saved = await saveSettings(settingsToSave);
    setSettingsState(saved);
  };

  const completeOnboarding = async () => {
    if (!settingsState) return;
    const saved = await saveSettings({ ...settingsState, onboardingCompleted: true });
    setSettingsState(saved);
    await load(date, true);
  };

  const saveAndScanSettings = async () => {
    await persistSettings();
    await load(date, true);
  };

  const runIntegrationSync = async () => {
    if (!settingsState) return;
    setError(undefined);
    setIntegrationSyncing(true);
    try {
      const saved = await saveSettings(settingsState);
      setSettingsState(saved);
      const result = await syncIntegrations();
      setIntegrationSyncResult(result);
      const nextLedger = await getDay(date || ledger?.metrics.date);
      setLedger(nextLedger);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setIntegrationSyncing(false);
    }
  };

  const runIntegrationDiagnostics = async () => {
    if (!settingsState) return;
    setError(undefined);
    setIntegrationDiagnosing(true);
    try {
      const saved = await saveSettings(settingsState);
      setSettingsState(saved);
      setIntegrationDiagnostics(await diagnoseIntegrations());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setIntegrationDiagnosing(false);
    }
  };

  const runCreateBackup = async () => {
    setError(undefined);
    setBackupWorking(true);
    try {
      setBackupResult(await createBackup());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBackupWorking(false);
    }
  };

  const runRestoreBackup = async () => {
    if (!restorePath.trim()) return;
    setError(undefined);
    setBackupWorking(true);
    try {
      setBackupResult(await restoreBackup(restorePath.trim()));
      await load(date, false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBackupWorking(false);
    }
  };

  const runReleaseCheck = async () => {
    setError(undefined);
    setReleaseChecking(true);
    try {
      setReleaseReadiness(await getReleaseReadiness());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setReleaseChecking(false);
    }
  };

  const runStartReview = async (session: SessionRecord) => {
    const updated = await startReview(session.id);
    const nextLedger = await getDay(date || ledger?.metrics.date);
    setLedger(nextLedger);
    setSelectedId(updated.id);
  };

  const runFinishReview = async (session: SessionRecord, status: SessionStatus = "useful") => {
    const updated = await finishReview(session.id, status);
    const nextLedger = await getDay(date || ledger?.metrics.date);
    setLedger(nextLedger);
    setSelectedId(updated.id);
  };

  const runStartRepair = async (session: SessionRecord) => {
    const updated = await startRepair(session.id);
    const nextLedger = await getDay(date || ledger?.metrics.date);
    setLedger(nextLedger);
    setSelectedId(updated.id);
  };

  const runFinishRepair = async (session: SessionRecord, status: SessionStatus = "repaired") => {
    const updated = await finishRepair(session.id, status);
    const nextLedger = await getDay(date || ledger?.metrics.date);
    setLedger(nextLedger);
    setSelectedId(updated.id);
  };

  const openView = (nextView: View, nextFilter?: Filter) => {
    setView(nextView);
    if (nextFilter) setFilter(nextFilter);
  };

  const refreshReport = async () => {
    if (!ledger) return;
    const result =
      reportMode === "weekly"
        ? await generateWeeklyReport(ledger.metrics.date, locale)
        : await generateReport(ledger.metrics.date, locale);
    setMarkdown(result.markdown);
    setExportedPath(result.exportedPath);
    setRenderedReportKey(`${reportMode}:${ledger.metrics.date}`);
  };

  useEffect(() => {
    const reportKey = ledger ? `${reportMode}:${ledger.metrics.date}` : "";
    if (view === "report" && ledger && renderedReportKey !== reportKey) void refreshReport();
  }, [view, ledger?.metrics.date, reportMode, renderedReportKey]);

  if (settingsState && !settingsState.onboardingCompleted) {
    return (
      <TranslationContext.Provider value={t}>
        <Onboarding settings={settingsState} onChange={setSettingsState} onComplete={completeOnboarding} />
      </TranslationContext.Provider>
    );
  }

  if (loading && !ledger) {
    return (
      <TranslationContext.Provider value={t}>
        <div className="boot-screen">
          <RefreshCw className="spin" />
          <span>{t("app.loading")}</span>
        </div>
      </TranslationContext.Provider>
    );
  }

  if (!ledger) {
    return (
      <TranslationContext.Provider value={t}>
        <div className="boot-screen">
          <AlertCircle />
          <span>{error ?? t("app.unableToLoad")}</span>
        </div>
      </TranslationContext.Provider>
    );
  }

  const detailPanel = (
    <DetailPanel
      session={selected}
      ledger={ledger}
      overlap={selectedOverlap}
      range={selectedRange}
      onPatch={(session, patch) => void applyPatch(session, patch)}
      onSelect={selectSession}
      onStartReview={(session) => void runStartReview(session)}
      onFinishReview={(session, status) => void runFinishReview(session, status)}
      onStartRepair={(session) => void runStartRepair(session)}
      onFinishRepair={(session, status) => void runFinishRepair(session, status)}
    />
  );

  return (
    <TranslationContext.Provider value={t}>
      <div className="app-shell">
        <AppSidebar
          view={view}
          date={date}
          ledger={ledger}
          error={error}
          onDateChange={(nextDate) => void load(nextDate)}
          onViewChange={setView}
        />
        <section className="app-workspace">
          <WorkspaceHeader ledger={ledger} scanning={scanning} onRescan={() => void load(date, true)} />

          {view === "today" && (
            <TodayView
              ledger={ledger}
              selectedId={selected?.id}
              zoomMinutes={zoomMinutes}
              selectedOverlap={selectedOverlap}
              selectedRange={selectedRange}
              onZoom={setZoomMinutes}
              onSelect={selectSession}
              onOverlapSelect={selectOverlap}
              onRangeSelect={selectRange}
              onNavigate={openView}
            />
          )}
          {view === "inbox" && (
            <InboxView
              ledger={ledger}
              selected={selected}
              filter={filter}
              search={search}
              onFilter={setFilter}
              onSearch={setSearch}
              onSelect={selectSession}
              onStatus={(session, status) => applyPatch(session, { status })}
              inspector={detailPanel}
            />
          )}
          {view === "timeline" && (
            <ProjectTimelineView
              ledger={ledger}
              selectedId={selected?.id}
              zoomMinutes={zoomMinutes}
              selectedOverlap={selectedOverlap}
              selectedRange={selectedRange}
              onZoom={setZoomMinutes}
              onSelect={selectSession}
              onOverlapSelect={selectOverlap}
              onRangeSelect={selectRange}
              inspector={selected || selectedOverlap || selectedRange ? detailPanel : undefined}
            />
          )}
          {view === "operating" && (
            <OperatingReviewView ledger={ledger} onSelect={(session) => {
              selectSession(session);
              setView("inbox");
            }} />
          )}
          {view === "report" && (
            <ReportView
              ledger={ledger}
              mode={reportMode}
              markdown={markdown}
              exportedPath={exportedPath}
              onModeChange={(mode) => {
                setReportMode(mode);
                setExportedPath(undefined);
              }}
              onGenerate={refreshReport}
              onChange={setMarkdown}
              onCopy={() => void navigator.clipboard.writeText(markdown)}
              onExport={async () => {
                const result =
                  reportMode === "weekly"
                    ? await exportWeeklyReport(ledger.metrics.date, markdown, locale)
                    : await exportReport(ledger.metrics.date, markdown, locale);
                setExportedPath(result.exportedPath);
              }}
            />
          )}
          {view === "settings" && settingsState && (
            <SettingsView
              settings={settingsState}
              onChange={setSettingsState}
              onSave={() => void persistSettings()}
              onScan={() => void saveAndScanSettings()}
              onSyncIntegrations={() => void runIntegrationSync()}
              onDiagnoseIntegrations={() => void runIntegrationDiagnostics()}
              onCreateBackup={() => void runCreateBackup()}
              onRestoreBackup={() => void runRestoreBackup()}
              onCheckRelease={() => void runReleaseCheck()}
              integrationSyncing={integrationSyncing}
              integrationSyncResult={integrationSyncResult}
              integrationDiagnostics={integrationDiagnostics}
              integrationDiagnosing={integrationDiagnosing}
              backupResult={backupResult}
              backupWorking={backupWorking}
              restorePath={restorePath}
              onRestorePathChange={setRestorePath}
              releaseReadiness={releaseReadiness}
              releaseChecking={releaseChecking}
            />
          )}
        </section>
      </div>
    </TranslationContext.Provider>
  );
}
