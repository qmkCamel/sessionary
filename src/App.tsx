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
  RefreshCw,
  Search,
  Wrench,
  X
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { exportReport, generateReport, getDay, latestDate, patchSession, scanSources } from "./api";
import type { DayLedger, SessionPatch, SessionRecord, SessionStatus } from "./shared/types";

type View = "today" | "inbox" | "timeline" | "report";
type Filter = "all" | SessionStatus;

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
  { id: "report", label: "Daily Report", icon: FileText }
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

function dayBounds(ledger: DayLedger): [number, number] {
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
  const padding = Math.max(15 * 60 * 1000, (max - min) * 0.08);
  return [min - padding, max + padding];
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
  onSelect
}: {
  ledger: DayLedger;
  selectedId?: string;
  onSelect: (session: SessionRecord) => void;
}) {
  const bounds = useMemo(() => dayBounds(ledger), [ledger]);
  const tracks = useMemo(() => {
    const grouped = new Map<string, SessionRecord[]>();
    for (const session of ledger.sessions) {
      grouped.set(session.projectName, [...(grouped.get(session.projectName) ?? []), session]);
    }
    return [...grouped.entries()];
  }, [ledger.sessions]);

  if (ledger.sessions.length === 0) return <EmptyState title="No sessions for this day" />;

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
            className="overlap-band"
            style={positionFor(overlap.startedAt, overlap.endedAt, bounds)}
            title={`${overlap.projectNames.join(", ")} · ${secondsLabel(overlap.seconds)}`}
          />
        ))}
        {tracks.map(([project, sessions]) => (
          <div className="project-track" key={project}>
            <div className="track-label">
              <strong>{project}</strong>
              <small>{sessions.length} sessions</small>
            </div>
            <div className="track-line">
              {sessions.map((session) => (
                <button
                  key={session.id}
                  className={`timeline-block ${session.source} ${session.status} ${selectedId === session.id ? "selected" : ""}`}
                  style={positionFor(session.startedAt, session.endedAt, bounds)}
                  title={`${sourceLabels[session.source]} · ${timeLabel(session.startedAt)}-${timeLabel(session.endedAt)} · ${session.toolCallCount} tools`}
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
  onSelect,
  onNavigate
}: {
  ledger: DayLedger;
  selectedId?: string;
  onSelect: (session: SessionRecord) => void;
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
          <span>{ledger.overlaps.length} overlap intervals</span>
        </div>
        <TimelineCanvas ledger={ledger} selectedId={selectedId} onSelect={onSelect} />
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
  onStatus: (session: SessionRecord, status: SessionStatus) => void;
}) {
  const filtered = ledger.sessions.filter((session) => {
    const matchesFilter = filter === "all" || session.status === filter;
    const text = `${session.summary} ${session.projectName} ${session.source}`.toLowerCase();
    return matchesFilter && text.includes(search.toLowerCase());
  });

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
                <button title="Useful" onClick={() => onStatus(session, "useful")}>
                  <Check size={16} />
                </button>
                <button title="Needs review" onClick={() => onStatus(session, "needs_review")}>
                  <AlertCircle size={16} />
                </button>
                <button title="Needs repair" onClick={() => onStatus(session, "needs_repair")}>
                  <Wrench size={16} />
                </button>
                <button title="Discarded" onClick={() => onStatus(session, "discarded")}>
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
  onSelect
}: {
  ledger: DayLedger;
  selectedId?: string;
  onSelect: (session: SessionRecord) => void;
}) {
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
        <TimelineCanvas ledger={ledger} selectedId={selectedId} onSelect={onSelect} />
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
              <button key={`${overlap.startedAt}-${overlap.endedAt}`} onClick={() => onSelect(ledger.sessions.find((session) => overlap.sessionIds.includes(session.id))!)}>
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

function DetailPanel({
  session,
  onPatch
}: {
  session?: SessionRecord;
  onPatch: (session: SessionRecord, patch: SessionPatch) => void;
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

  const selected = useMemo(() => ledger?.sessions.find((session) => session.id === selectedId) ?? ledger?.sessions[0], [ledger, selectedId]);

  const load = async (targetDate?: string, shouldScan = false) => {
    setError(undefined);
    setLoading(true);
    try {
      let resolvedDate = targetDate || date;
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
                  {source.sessionsFound} sessions · {source.errors} errors
                </small>
              </div>
            </div>
          ))}
        </div>
        {error && <p className="sidebar-error">{error}</p>}
      </aside>

      {view === "today" && <TodayView ledger={ledger} selectedId={selected?.id} onSelect={(session) => setSelectedId(session.id)} onNavigate={openView} />}
      {view === "inbox" && (
        <InboxView
          ledger={ledger}
          selected={selected}
          filter={filter}
          search={search}
          onFilter={setFilter}
          onSearch={setSearch}
          onSelect={(session) => setSelectedId(session.id)}
          onStatus={(session, status) => void applyPatch(session, { status })}
        />
      )}
      {view === "timeline" && <ProjectTimelineView ledger={ledger} selectedId={selected?.id} onSelect={(session) => setSelectedId(session.id)} />}
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

      <DetailPanel session={selected} onPatch={(session, patch) => void applyPatch(session, patch)} />
    </div>
  );
}
