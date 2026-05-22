import { AlertCircle, Check, CircleDot, Database, RefreshCw, Wrench, X } from "lucide-react";
import type { DayLedger, SessionRecord, SessionStatus } from "../shared/types";
import type { View } from "../app/types";
import { useTranslation } from "../app/translation";
import { navItems, sourceLabels, statusKeys, valueCategoryKeys } from "../app/labels";
import { costLabel, secondsLabel, timeLabel } from "../app/format";
import { openLoopCount } from "../app/operating";

export function statusIcon(status: SessionStatus) {
  if (status === "useful" || status === "repaired") return <Check size={14} />;
  if (status === "needs_repair") return <Wrench size={14} />;
  if (status === "failed" || status === "discarded") return <X size={14} />;
  if (status === "needs_review") return <AlertCircle size={14} />;
  return <CircleDot size={14} />;
}

export function ValueChip({ session, showScore = false }: { session: SessionRecord; showScore?: boolean }) {
  const t = useTranslation();
  return (
    <span className={`value-chip ${session.value.category}`}>
      {t(valueCategoryKeys[session.value.category])}
      {showScore ? <small>{session.value.score}</small> : null}
    </span>
  );
}

export function SourceHealthChips({ ledger }: { ledger: DayLedger }) {
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

export function WorkspaceHeader({
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

export function AppSidebar({
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

export function EmptyState({ title }: { title: string }) {
  return (
    <div className="empty-state">
      <Database size={24} />
      <strong>{title}</strong>
    </div>
  );
}

export function Metric({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <section className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
      {hint && <small>{hint}</small>}
    </section>
  );
}

export function SessionPill({ session, selected, onSelect }: { session: SessionRecord; selected: boolean; onSelect: () => void }) {
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
