import { AlertCircle, Check, Search, Wrench, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import type { DayLedger, SessionRecord, SessionStatus } from "../shared/types";
import type { Filter } from "../app/types";
import { compactNumber, costLabel, secondsLabel, timeLabel } from "../app/format";
import { sourceLabels, statusKeys } from "../app/labels";
import { useTranslation } from "../app/translation";
import { EmptyState, statusIcon, ValueChip } from "../components/shared";

export function InboxView({
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
