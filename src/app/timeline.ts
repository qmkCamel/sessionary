import type { DayLedger, OverlapInterval } from "../shared/types";
import type { RangeSelection, ZoomMinutes } from "./types";

export function dayBounds(ledger: DayLedger, zoomMinutes: ZoomMinutes): [number, number] {
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

export function positionFor(startIso: string, endIso: string | null, bounds: [number, number]) {
  const [min, max] = bounds;
  const start = new Date(startIso).getTime();
  const end = new Date(endIso ?? startIso).getTime();
  const span = Math.max(1, max - min);
  const left = Math.max(0, ((start - min) / span) * 100);
  const width = Math.max(1.2, ((Math.max(end, start + 60_000) - start) / span) * 100);
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
