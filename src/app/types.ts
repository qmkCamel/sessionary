import type { SessionStatus } from "../shared/types";

export type View = "today" | "inbox" | "timeline" | "operating" | "report" | "settings";
export type Filter = "all" | SessionStatus;
export type ZoomMinutes = 15 | 30 | 60;
export type RangeSelection = { startedAt: string; endedAt: string };
export type ReportMode = "daily" | "weekly";
