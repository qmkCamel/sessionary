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
import { useEffect, useMemo, useRef, useState } from "react";
import {
  exportReport,
  finishReview,
  generateReport,
  getDay,
  getSettings,
  latestDate,
  patchSession,
  saveSettings,
  scanSources,
  startReview
} from "./api";
import type { AppSettings, DayLedger, OverlapInterval, SessionPatch, SessionRecord, SessionStatus } from "./shared/types";

type View = "today" | "inbox" | "timeline" | "report" | "settings";
type Filter = "all" | SessionStatus;
type ZoomMinutes = 15 | 30 | 60;
type RangeSelection = { startedAt: string; endedAt: string };

const statusLabels: Record<SessionStatus, string> = {
  unknown: "Unknown",
  useful: "Useful",
  needs_review: "Needs review",
  needs_repair: "Needs repair",
  repaired: "Repaired",
  failed: "Failed",
  discarded: "Discarded"
};

const sourceLabels = {
  codex: "Codex",
  claude: "Claude"
};

const navItems: Array<{ id: View; label: string; icon: typeof LayoutDashboard }> = [
  { id: "today", label: "Today", icon: LayoutDashboard },
  { id: "inbox", label: "Session Inbox", icon: Inbox },
  { id: "timeline", label: "Project Timeline", icon: Activity },
  { id: "report", label: "Daily Report", icon: FileText },
  { id: "settings", label: "Settings", icon: Settings }
];

function secondsLabel(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

function timeLabel(iso: string | null): string {
  if (!iso) return "open";
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
  return (
    <button className={`session-row ${selected ? "selected" : ""}`} onClick={onSelect}>
      <span className={`source-dot ${session.source}`} />
      <span className="session-row-main">
        <strong>{session.summary || session.sourceSessionId}</strong>
        <small>
          {sourceLabels[session.source]} · {session.projectName} · {secondsLabel(session.durationSeconds)}
        </small>
      </span>
      <span className={`status-chip ${session.status}`}>{statusLabels[session.status]}</span>
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

  if (ledger.sessions.length === 0) return <EmptyState title="No sessions for this day" />;

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
        <span>{timeLabel(new Date(bounds[0]).toISOString())}</span>
        <span>{timeLabel(new Date((bounds[0] + bounds[1]) / 2).toISOString())}</span>
        <span>{timeLabel(new Date(bounds[1]).toISOString())}</span>
      </div>
      <div className="timeline-body">
        {ledger.overlaps.map((overlap) => (
          <button
            key={`${overlap.startedAt}-${overlap.endedAt}`}
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
                  title={`${sourceLabels[session.source]} · ${timeLabel(session.startedAt)}-${timeLabel(session.endedAt)} · ${session.toolCallCount} tools`}
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
  return (
    <main className="workspace">
      <div className="page-title">
        <div>
          <p>{ledger.metrics.date}</p>
          <h1>Today</h1>
        </div>
        <span className="freshness">Updated {timeLabel(ledger.metrics.generatedAt)}</span>
      </div>

      <div className="metrics-grid">
        <Metric label="Projects" value={ledger.metrics.projectCount} />
        <Metric label="Sessions" value={ledger.metrics.sessionCount} />
        <Metric label="AI waiting" value={secondsLabel(ledger.metrics.aiWaitingSecondsEstimated)} hint="estimated" />
        <Metric label="Prompting" value={secondsLabel(ledger.metrics.promptingSecondsEstimated)} hint="estimated" />
        <Metric label="Review" value={secondsLabel(ledger.metrics.reviewSecondsEstimated)} hint="estimated" />
        <Metric label="Repair" value={secondsLabel(ledger.metrics.repairSecondsEstimated)} hint="estimated" />
        <Metric label="Parallel" value={secondsLabel(ledger.metrics.parallelSeconds)} />
        <Metric label="Max agents" value={ledger.metrics.maxConcurrentSessions} />
      </div>

      <section className="panel">
        <div className="panel-header">
          <h2>Session Timeline</h2>
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

      <div className="split-grid">
        <section className="panel">
          <div className="panel-header">
            <h2>Projects</h2>
            <span>{ledger.projects.filter((project) => project.isParallel).length} parallel</span>
          </div>
          <div className="project-list">
            {ledger.projects.map((project) => (
              <button
                key={project.path}
                className="project-item"
                onClick={() => onSelect(ledger.sessions.find((session) => session.projectPath === project.path) ?? ledger.sessions[0])}
              >
                <span>
                  <strong>{project.name}</strong>
                  <small>{project.path}</small>
                </span>
                <span className="project-meta">
                  <GitBranch size={14} />
                  {project.gitBranch ?? "no branch"}
                </span>
                <span className={project.isParallel ? "parallel-tag" : "quiet-tag"}>
                  {project.isParallel ? "parallel" : "solo"}
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <h2>Inbox</h2>
            <span>{ledger.metrics.unknownCount + ledger.metrics.needsReviewCount + ledger.metrics.needsRepairCount} open</span>
          </div>
          <div className="queue-actions">
            <button onClick={() => onNavigate("inbox", "unknown")}>Unknown {ledger.metrics.unknownCount}</button>
            <button onClick={() => onNavigate("inbox", "needs_review")}>Review {ledger.metrics.needsReviewCount}</button>
            <button onClick={() => onNavigate("inbox", "needs_repair")}>Repair {ledger.metrics.needsRepairCount}</button>
          </div>
          <div className="compact-list">
            {ledger.sessions.slice(0, 5).map((session) => (
              <SessionPill key={session.id} session={session} selected={selectedId === session.id} onSelect={() => onSelect(session)} />
            ))}
          </div>
        </section>
      </div>
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
  onStatus
}: {
  ledger: DayLedger;
  selected?: SessionRecord;
  filter: Filter;
  search: string;
  onFilter: (filter: Filter) => void;
  onSearch: (search: string) => void;
  onSelect: (session: SessionRecord) => void;
  onStatus: (session: SessionRecord, status: SessionStatus) => Promise<void>;
}) {
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
    <main className="workspace">
      <div className="page-title">
        <div>
          <p>{ledger.metrics.date}</p>
          <h1>Session Inbox</h1>
        </div>
        <div className="search-box">
          <Search size={16} />
          <input value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Search sessions" />
        </div>
      </div>

      <div className="filter-bar">
        {(["all", "unknown", "useful", "needs_review", "needs_repair", "discarded"] as Filter[]).map((item) => (
          <button key={item} className={filter === item ? "active" : ""} onClick={() => onFilter(item)}>
            {item === "all" ? "All" : statusLabels[item]}
          </button>
        ))}
      </div>

      <section className="panel inbox-panel">
        {filtered.length === 0 ? (
          <EmptyState title="Inbox is clear for this filter" />
        ) : (
          filtered.map((session) => (
            <article className={`inbox-card ${selected?.id === session.id ? "selected" : ""}`} key={session.id} onClick={() => onSelect(session)}>
              <div className="inbox-card-main">
                <span className={`source-dot ${session.source}`} />
                <div>
                  <h2>{session.summary || session.sourceSessionId}</h2>
                  <p>
                    {sourceLabels[session.source]} · {session.projectName} · {timeLabel(session.startedAt)}-{timeLabel(session.endedAt)}
                  </p>
                </div>
              </div>
              <div className="session-stats">
                <span>{session.userMessageCount} prompts</span>
                <span>{session.assistantMessageCount} replies</span>
                <span>{session.toolCallCount} tools</span>
                <span>{secondsLabel(session.durationSeconds)}</span>
              </div>
              <div className="quick-actions" onClick={(event) => event.stopPropagation()}>
                <button title="Useful" onClick={() => void markStatus(session, "useful")}>
                  <Check size={16} />
                </button>
                <button title="Needs review" onClick={() => void markStatus(session, "needs_review")}>
                  <AlertCircle size={16} />
                </button>
                <button title="Needs repair" onClick={() => void markStatus(session, "needs_repair")}>
                  <Wrench size={16} />
                </button>
                <button title="Discarded" onClick={() => void markStatus(session, "discarded")}>
                  <X size={16} />
                </button>
              </div>
              <span className={`status-chip ${session.status}`}>
                {statusIcon(session.status)}
                {statusLabels[session.status]}
              </span>
            </article>
          ))
        )}
      </section>
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
  onRangeSelect
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
}) {
  const rangeSessions = sessionsInRange(ledger, selectedRange);
  const rangeProjects = [...new Set(rangeSessions.map((session) => session.projectName))];

  return (
    <main className="workspace">
      <div className="page-title">
        <div>
          <p>{ledger.metrics.date}</p>
          <h1>Project Timeline</h1>
        </div>
        <span className="freshness">
          {ledger.metrics.maxConcurrentProjects} projects · {secondsLabel(ledger.metrics.parallelSeconds)}
        </span>
      </div>

      <section className="panel tall">
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
              {timeLabel(selectedRange.startedAt)}-{timeLabel(selectedRange.endedAt)} · {rangeSessions.length} sessions · {rangeProjects.length} projects
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

      <section className="panel">
        <div className="panel-header">
          <h2>Overlap Summary</h2>
          <span>{ledger.overlaps.length} intervals</span>
        </div>
        <div className="overlap-list">
          {ledger.overlaps.length === 0 ? (
            <EmptyState title="No parallel project intervals" />
          ) : (
            ledger.overlaps.map((overlap) => (
              <button
                key={`${overlap.startedAt}-${overlap.endedAt}`}
                className={overlapsEqual(selectedOverlap, overlap) ? "selected" : ""}
                onClick={() => onOverlapSelect(overlap)}
              >
                <span>
                  <strong>{overlap.projectNames.join(" + ")}</strong>
                  <small>
                    {timeLabel(overlap.startedAt)}-{timeLabel(overlap.endedAt)}
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

function ReportView({
  ledger,
  markdown,
  exportedPath,
  onGenerate,
  onChange,
  onCopy,
  onExport
}: {
  ledger: DayLedger;
  markdown: string;
  exportedPath?: string;
  onGenerate: () => void;
  onChange: (value: string) => void;
  onCopy: () => void;
  onExport: () => void;
}) {
  return (
    <main className="workspace report-view">
      <div className="page-title">
        <div>
          <p>{ledger.metrics.date}</p>
          <h1>Daily Report</h1>
        </div>
        <div className="toolbar">
          <button title="Generate report" onClick={onGenerate}>
            <RefreshCw size={16} />
          </button>
          <button title="Copy Markdown" onClick={onCopy}>
            <Clipboard size={16} />
          </button>
          <button title="Export Markdown" onClick={onExport}>
            <Download size={16} />
          </button>
        </div>
      </div>
      <textarea className="report-editor" value={markdown} onChange={(event) => onChange(event.target.value)} />
      {exportedPath && <p className="export-path">Exported to {exportedPath}</p>}
    </main>
  );
}

function SettingsEditor({
  settings,
  onChange,
  onSave,
  onScan,
  compact = false
}: {
  settings: AppSettings;
  onChange: (settings: AppSettings) => void;
  onSave: () => void;
  onScan?: () => void;
  compact?: boolean;
}) {
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

  return (
    <div className={compact ? "settings-editor compact" : "settings-editor"}>
      {settings.sourceConfigs.map((config) => (
        <section className="panel" key={config.source}>
          <div className="panel-header">
            <h2>{sourceLabels[config.source]}</h2>
            <label className="switch">
              <input type="checkbox" checked={config.enabled} onChange={() => toggleSource(config.source)} />
              <span>{config.enabled ? "Enabled" : "Off"}</span>
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
          <h2>Project Roots</h2>
          <span>optional</span>
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
      <div className="settings-actions">
        <button className="primary-button" onClick={onSave}>Save</button>
        {onScan && <button onClick={onScan}>Save and Scan</button>}
      </div>
    </div>
  );
}

function SettingsView({
  settings,
  onChange,
  onSave,
  onScan
}: {
  settings: AppSettings;
  onChange: (settings: AppSettings) => void;
  onSave: () => void;
  onScan: () => void;
}) {
  return (
    <main className="workspace">
      <div className="page-title">
        <div>
          <p>Local only</p>
          <h1>Settings</h1>
        </div>
      </div>
      <SettingsEditor settings={settings} onChange={onChange} onSave={onSave} onScan={onScan} />
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
  return (
    <div className="onboarding-shell">
      <div className="onboarding-copy">
        <strong>Sessionary</strong>
        <h1>Set up local session sources</h1>
        <p>Sessionary reads local AI coding logs and stores metadata on this Mac. Source code, full prompts, and full responses are not uploaded.</p>
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
  onFinishReview
}: {
  session?: SessionRecord;
  ledger: DayLedger;
  overlap?: OverlapInterval;
  range?: RangeSelection;
  onPatch: (session: SessionRecord, patch: SessionPatch) => void;
  onSelect: (session: SessionRecord) => void;
  onStartReview: (session: SessionRecord) => void;
  onFinishReview: (session: SessionRecord, status?: SessionStatus) => void;
}) {
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
            <h2>Overlap Summary</h2>
            <p>{overlap.projectNames.join(" + ")}</p>
          </div>
        </div>
        <section className="detail-section">
          <h3>Interval</h3>
          <dl className="detail-stats">
            <div>
              <dt>Started</dt>
              <dd>{timeLabel(overlap.startedAt)}</dd>
            </div>
            <div>
              <dt>Ended</dt>
              <dd>{timeLabel(overlap.endedAt)}</dd>
            </div>
            <div>
              <dt>Duration</dt>
              <dd>{secondsLabel(overlap.seconds)}</dd>
            </div>
            <div>
              <dt>Sessions</dt>
              <dd>{overlap.sessionIds.length}</dd>
            </div>
          </dl>
        </section>
        <section className="detail-section">
          <h3>Sessions</h3>
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
            <h2>Selected Range</h2>
            <p>
              {timeLabel(range.startedAt)}-{timeLabel(range.endedAt)}
            </p>
          </div>
        </div>
        <section className="detail-section">
          <h3>Range</h3>
          <dl className="detail-stats">
            <div>
              <dt>Projects</dt>
              <dd>{projects.length}</dd>
            </div>
            <div>
              <dt>Sessions</dt>
              <dd>{rangeSessions.length}</dd>
            </div>
          </dl>
        </section>
        <section className="detail-section">
          <h3>Projects</h3>
          <div className="file-list">{projects.map((project) => <span key={project}>{project}</span>)}</div>
        </section>
      </aside>
    );
  }

  if (!session) {
    return (
      <aside className="detail-panel">
        <EmptyState title="Select a session" />
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
            {statusLabels[status]}
          </button>
        ))}
      </div>

      <section className="detail-section">
        <h3>Review Flow</h3>
        <div className="review-actions">
          <button className={session.reviewStartedAt ? "active" : ""} onClick={() => onStartReview(session)}>
            <Play size={15} />
            Start Review
          </button>
          <button onClick={() => onFinishReview(session, "useful")}>
            <Square size={15} />
            Done
          </button>
          <button onClick={() => onFinishReview(session, "needs_repair")}>
            <Wrench size={15} />
            Needs Repair
          </button>
        </div>
        {session.reviewStartedAt && <small>Review running since {timeLabel(session.reviewStartedAt)}</small>}
      </section>

      <section className="detail-section">
        <h3>Time</h3>
        <div className="time-grid">
          {(["prompting", "waiting", "review", "repair"] as const).map((field) => (
            <label key={field}>
              <span>
                {field}
                <small>{session.timeFields[field]}</small>
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
          Save time
        </button>
      </section>

      <section className="detail-section">
        <h3>Activity</h3>
        <dl className="detail-stats">
          <div>
            <dt>Started</dt>
            <dd>{timeLabel(session.startedAt)}</dd>
          </div>
          <div>
            <dt>Ended</dt>
            <dd>{timeLabel(session.endedAt)}</dd>
          </div>
          <div>
            <dt>Duration</dt>
            <dd>{secondsLabel(session.durationSeconds)}</dd>
          </div>
          <div>
            <dt>Tokens</dt>
            <dd>{session.tokenCount?.toLocaleString() ?? "n/a"}</dd>
          </div>
          <div>
            <dt>Cost</dt>
            <dd>{session.costAmount == null ? "n/a" : `$${session.costAmount.toFixed(4)}`}</dd>
          </div>
        </dl>
      </section>

      <section className="detail-section">
        <h3>Files</h3>
        <div className="file-list">
          {session.changedFiles.length === 0 ? <span>No file hints</span> : session.changedFiles.map((file) => <span key={file}>{file}</span>)}
        </div>
      </section>

      <section className="detail-section">
        <h3>Note</h3>
        <textarea value={note} onChange={(event) => setNote(event.target.value)} />
        <button className="primary-button" onClick={() => onPatch(session, { note })}>
          Save note
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
  const [settingsState, setSettingsState] = useState<AppSettings | null>(null);
  const [zoomMinutes, setZoomMinutes] = useState<ZoomMinutes>(30);
  const [selectedOverlap, setSelectedOverlap] = useState<OverlapInterval>();
  const [selectedRange, setSelectedRange] = useState<RangeSelection>();

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
    setLedger((current) =>
      current
        ? {
            ...current,
            sessions: current.sessions.map((item) => (item.id === updated.id ? updated : item))
          }
        : current
    );
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

  const runStartReview = async (session: SessionRecord) => {
    const updated = await startReview(session.id);
    setLedger((current) => current ? { ...current, sessions: current.sessions.map((item) => item.id === updated.id ? updated : item) } : current);
    setSelectedId(updated.id);
  };

  const runFinishReview = async (session: SessionRecord, status: SessionStatus = "useful") => {
    const updated = await finishReview(session.id, status);
    setLedger((current) => current ? { ...current, sessions: current.sessions.map((item) => item.id === updated.id ? updated : item) } : current);
    setSelectedId(updated.id);
  };

  const openView = (nextView: View, nextFilter?: Filter) => {
    setView(nextView);
    if (nextFilter) setFilter(nextFilter);
  };

  const refreshReport = async () => {
    if (!ledger) return;
    const result = await generateReport(ledger.metrics.date);
    setMarkdown(result.markdown);
    setExportedPath(result.exportedPath);
  };

  useEffect(() => {
    if (view === "report" && ledger && markdown.length === 0) void refreshReport();
  }, [view, ledger]);

  if (settingsState && !settingsState.onboardingCompleted) {
    return <Onboarding settings={settingsState} onChange={setSettingsState} onComplete={completeOnboarding} />;
  }

  if (loading && !ledger) {
    return (
      <div className="boot-screen">
        <RefreshCw className="spin" />
        <span>Scanning local sessions</span>
      </div>
    );
  }

  if (!ledger) {
    return (
      <div className="boot-screen">
        <AlertCircle />
        <span>{error ?? "Unable to load Sessionary"}</span>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <strong>Sessionary</strong>
          <span>AI Coding Session Inbox</span>
        </div>
        <input className="date-input" type="date" value={date} onChange={(event) => void load(event.target.value)} />
        <nav>
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button key={item.id} className={view === item.id ? "active" : ""} onClick={() => setView(item.id)}>
                <Icon size={17} />
                {item.label}
              </button>
            );
          })}
        </nav>
        <div className="sources">
          <div className="sources-header">
            <span>Sources</span>
            <button title="Rescan" onClick={() => void load(date, true)}>
              <RefreshCw size={15} className={scanning ? "spin" : ""} />
            </button>
          </div>
          {ledger.sourceStatus.map((source) => (
            <div className="source-status" key={source.source}>
              <span className={`source-dot ${source.source}`} />
              <div>
                <strong>{sourceLabels[source.source]}</strong>
                <small>
                  {source.enabled ? `${source.sessionsFound} sessions · ${source.errors} errors` : "disabled"}
                </small>
              </div>
            </div>
          ))}
        </div>
        {error && <p className="sidebar-error">{error}</p>}
      </aside>

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
        />
      )}
      {view === "report" && (
        <ReportView
          ledger={ledger}
          markdown={markdown}
          exportedPath={exportedPath}
          onGenerate={refreshReport}
          onChange={setMarkdown}
          onCopy={() => void navigator.clipboard.writeText(markdown)}
          onExport={async () => {
            const result = await exportReport(ledger.metrics.date, markdown);
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
        />
      )}

      <DetailPanel
        session={selected}
        ledger={ledger}
        overlap={selectedOverlap}
        range={selectedRange}
        onPatch={(session, patch) => void applyPatch(session, patch)}
        onSelect={selectSession}
        onStartReview={(session) => void runStartReview(session)}
        onFinishReview={(session, status) => void runFinishReview(session, status)}
      />
    </div>
  );
}
