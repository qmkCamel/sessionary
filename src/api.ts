import { invoke } from "@tauri-apps/api/core";
import type { DayLedger, ReportResult, ScanResult, SessionPatch, SessionRecord } from "./shared/types";
import { fallbackLedger, fallbackReport, fallbackScan, fallbackUpdate } from "./data/fallback";

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

export async function generateReport(date: string): Promise<ReportResult> {
  return invokeOrFallback("generate_report", { date }, () => fallbackReport(date));
}

export async function exportReport(date: string, markdown: string): Promise<ReportResult> {
  return invokeOrFallback("export_report", { date, markdown }, () => ({
    ...fallbackReport(date),
    markdown,
    exportedPath: "/tmp/sessionary-report.md"
  }));
}
