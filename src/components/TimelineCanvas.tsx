import { useMemo, useRef, useState } from "react";
import type { DayLedger, OverlapInterval, SessionRecord } from "../shared/types";
import type { RangeSelection, ZoomMinutes } from "../app/types";
import { sourceLabels } from "../app/labels";
import { secondsLabel, timeLabel } from "../app/format";
import { dayBounds, overlapsEqual, positionFor } from "../app/timeline";
import { useTranslation } from "../app/translation";
import { EmptyState } from "./shared";

export function TimelineCanvas({
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
