import type { DayLedger, OverlapInterval, SessionRecord } from "../shared/types";
import type { RangeSelection, ZoomMinutes } from "./types";

const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * MINUTE_MS;

export interface VisibleInterval {
  startedAt: string;
  endedAt: string;
  seconds: number;
}

export function dayWindowFor(date: string): [number, number] {
  const start = new Date(`${date}T00:00:00+08:00`).getTime();
  return [start, start + DAY_MS];
}

export function visibleIntervalFor(
  startedAt: string,
  endedAt: string | null,
  bounds: [number, number]
): VisibleInterval | null {
  const [min, max] = bounds;
  const start = new Date(startedAt).getTime();
  const end = new Date(endedAt ?? startedAt).getTime();
  const clippedStart = Math.max(start, min);
  const clippedEnd = Math.min(Math.max(end, start + MINUTE_MS), max);
  if (clippedEnd <= clippedStart) return null;
  return {
    startedAt: new Date(clippedStart).toISOString(),
    endedAt: new Date(clippedEnd).toISOString(),
    seconds: Math.round((clippedEnd - clippedStart) / 1000)
  };
}

export function visibleSessionInterval(session: SessionRecord, bounds: [number, number]) {
  return visibleIntervalFor(session.startedAt, session.endedAt, bounds);
}

export function dayBounds(ledger: DayLedger, zoomMinutes: ZoomMinutes): [number, number] {
  const dayWindow = dayWindowFor(ledger.metrics.date);
  const intervals = ledger.sessions
    .map((session) => visibleSessionInterval(session, dayWindow))
    .filter((interval): interval is VisibleInterval => interval != null);
  if (intervals.length === 0) return dayWindow;

  const times = intervals.flatMap((interval) => [
    new Date(interval.startedAt).getTime(),
    new Date(interval.endedAt).getTime()
  ]);
  const min = Math.max(dayWindow[0], Math.min(...times));
  const max = Math.min(dayWindow[1], Math.max(...times));
  const step = zoomMinutes * MINUTE_MS;
  const padding = Math.max(step, (max - min) * 0.08);
  return [
    Math.max(dayWindow[0], Math.floor((min - padding) / step) * step),
    Math.min(dayWindow[1], Math.ceil((max + padding) / step) * step)
  ];
}

export function positionFor(startIso: string, endIso: string | null, bounds: [number, number]) {
  const [min, max] = bounds;
  const visible = visibleIntervalFor(startIso, endIso, bounds);
  const span = Math.max(1, max - min);
  if (!visible) return { left: "0%", width: "0%" };

  const start = new Date(visible.startedAt).getTime();
  const end = new Date(visible.endedAt).getTime();
  const left = Math.max(0, Math.min(100, ((start - min) / span) * 100));
  const width = Math.max(1.2, ((end - start) / span) * 100);
  return { left: `${left}%`, width: `${Math.min(width, 100 - left)}%` };
}

export function overlapsEqual(left?: OverlapInterval, right?: OverlapInterval) {
  return Boolean(left && right && left.startedAt === right.startedAt && left.endedAt === right.endedAt);
}

export function sessionsInRange(ledger: DayLedger, range?: RangeSelection) {
  if (!range) return [];
  const start = new Date(range.startedAt).getTime();
  const end = new Date(range.endedAt).getTime();
  return ledger.sessions.filter((session) => {
    const sessionStart = new Date(session.startedAt).getTime();
    const sessionEnd = new Date(session.endedAt ?? session.startedAt).getTime();
    return sessionStart < end && sessionEnd > start;
  });
}
