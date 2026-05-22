import type { ReactNode } from "react";
import type { DayLedger, OverlapInterval, SessionRecord } from "../shared/types";
import type { RangeSelection, ZoomMinutes } from "../app/types";
import { secondsLabel, timeLabel } from "../app/format";
import { overlapsEqual, sessionsInRange } from "../app/timeline";
import { useTranslation } from "../app/translation";
import { EmptyState } from "../components/shared";
import { ParallelReviewPanel } from "../components/reviews";
import { TimelineCanvas } from "../components/TimelineCanvas";

export function ProjectTimelineView({
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
