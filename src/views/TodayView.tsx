import { GitBranch } from "lucide-react";
import type { DayLedger, OverlapInterval, SessionRecord } from "../shared/types";
import type { Filter, RangeSelection, View, ZoomMinutes } from "../app/types";
import { compactNumber, costLabel, secondsLabel } from "../app/format";
import { statusKeys } from "../app/labels";
import { humanTimeEstimateSeconds, openLoopCount, prioritySessions } from "../app/operating";
import { useTranslation } from "../app/translation";
import { EmptyState, Metric, SessionPill } from "../components/shared";
import { DeliveryInsightCard, DeliveryReviewStrip, ParallelInsightCard, ParallelReviewStrip } from "../components/reviews";
import { TimelineCanvas } from "../components/TimelineCanvas";

export function TodayView({
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
