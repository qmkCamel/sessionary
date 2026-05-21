import { invoke } from "@tauri-apps/api/core";
import type { Locale } from "./i18n";
import type { AppSettings, DayLedger, ReportResult, ScanResult, SessionPatch, SessionRecord, SessionStatus } from "./shared/types";
import {
  fallbackFinishRepair,
  fallbackLedger,
  fallbackReport,
  fallbackScan,
  fallbackSettings,
  fallbackStartRepair,
  fallbackUpdate,
  fallbackWeeklyReport,
  saveFallbackSettings
} from "./data/fallback";

async function invokeOrFallback<T>(command: string, args: Record<string, unknown> | undefined, fallback: () => T): Promise<T> {
  try {
    return await invoke<T>(command, args);
  } catch {
    return fallback();
  }
}

export async function latestDate(): Promise<string> {
  return invokeOrFallback("latest_date", undefined, () => "2026-05-19");
}

export async function scanSources(): Promise<ScanResult> {
  return invokeOrFallback("scan_sources", undefined, fallbackScan);
}

export async function getDay(date?: string): Promise<DayLedger> {
  return invokeOrFallback("get_day", { date }, () => fallbackLedger(date));
}

export async function patchSession(id: string, patch: SessionPatch): Promise<SessionRecord> {
  return invokeOrFallback("update_session", { id, patch }, () => fallbackUpdate(id, patch));
}

export async function startReview(id: string): Promise<SessionRecord> {
  return invokeOrFallback("start_review", { id }, () => fallbackUpdate(id, { status: "needs_review" }));
}

export async function finishReview(id: string, status: SessionStatus = "useful"): Promise<SessionRecord> {
  return invokeOrFallback("finish_review", { id, status }, () => fallbackUpdate(id, { status }));
}

export async function startRepair(id: string): Promise<SessionRecord> {
  return invokeOrFallback("start_repair", { id }, () => fallbackStartRepair(id));
}

export async function finishRepair(id: string, status: SessionStatus = "repaired"): Promise<SessionRecord> {
  return invokeOrFallback("finish_repair", { id, status }, () => fallbackFinishRepair(id, status));
}

export async function getSettings(): Promise<AppSettings> {
  return invokeOrFallback("get_settings", undefined, fallbackSettings);
}

export async function saveSettings(settings: AppSettings): Promise<AppSettings> {
  return invokeOrFallback("save_settings", { settings }, () => saveFallbackSettings(settings));
}

export async function generateReport(date: string, locale: Locale = "en"): Promise<ReportResult> {
  return invokeOrFallback("generate_report", { date }, () => fallbackReport(date, locale));
}

export async function generateWeeklyReport(date: string, locale: Locale = "en"): Promise<ReportResult> {
  return invokeOrFallback("generate_weekly_report", { date }, () => fallbackWeeklyReport(date, locale));
}

export async function exportReport(date: string, markdown: string, locale: Locale = "en"): Promise<ReportResult> {
  return invokeOrFallback("export_report", { date, markdown }, () => ({
    ...fallbackReport(date, locale),
    markdown,
    exportedPath: "/tmp/sessionary-report.md"
  }));
}

export async function exportWeeklyReport(date: string, markdown: string, locale: Locale = "en"): Promise<ReportResult> {
  return invokeOrFallback("export_weekly_report", { date, markdown }, () => ({
    ...fallbackWeeklyReport(date, locale),
    markdown,
    exportedPath: "/tmp/sessionary-weekly-report.md"
  }));
}
