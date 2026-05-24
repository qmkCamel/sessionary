import { AlertCircle, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  createBackup,
  diagnoseIntegrations,
  exportReport,
  exportWeeklyReport,
  finishReview,
  finishRepair,
  generateReport,
  generateWeeklyReport,
  getDay,
  getReleaseReadiness,
  getSettings,
  latestDate,
  patchSession,
  saveSettings,
  scanSources,
  startReview,
  startRepair,
  syncIntegrations,
  restoreBackup
} from "./api";
import { createTranslator, resolveLocale } from "./i18n";
import type {
  AppSettings,
  BackupResult,
  DayLedger,
  IntegrationDiagnosticsResult,
  IntegrationSyncResult,
  OverlapInterval,
  ReleaseReadinessResult,
  SessionPatch,
  SessionRecord,
  SessionStatus
} from "./shared/types";
import type { Filter, RangeSelection, ReportMode, View, ZoomMinutes } from "./app/types";
import { TranslationContext } from "./app/translation";
import { AppSidebar, WorkspaceHeader } from "./components/shared";
import { DetailPanel } from "./views/DetailPanel";
import { InboxView } from "./views/InboxView";
import { OperatingReviewView } from "./views/OperatingReviewView";
import { ProjectTimelineView } from "./views/ProjectTimelineView";
import { ReportView } from "./views/ReportView";
import { Onboarding, SettingsView } from "./views/SettingsView";
import { TodayView } from "./views/TodayView";

export function App() {
  const [view, setView] = useState<View>("today");
  const [ledger, setLedger] = useState<DayLedger | null>(null);
  const [selectedId, setSelectedId] = useState<string>();
  const [date, setDate] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string>();
  const [markdown, setMarkdown] = useState("");
  const [exportedPath, setExportedPath] = useState<string>();
  const [reportMode, setReportMode] = useState<ReportMode>("daily");
  const [renderedReportKey, setRenderedReportKey] = useState("");
  const [settingsState, setSettingsState] = useState<AppSettings | null>(null);
  const [integrationSyncing, setIntegrationSyncing] = useState(false);
  const [integrationSyncResult, setIntegrationSyncResult] = useState<IntegrationSyncResult | null>(null);
  const [integrationDiagnosing, setIntegrationDiagnosing] = useState(false);
  const [integrationDiagnostics, setIntegrationDiagnostics] = useState<IntegrationDiagnosticsResult | null>(null);
  const [backupWorking, setBackupWorking] = useState(false);
  const [backupResult, setBackupResult] = useState<BackupResult | null>(null);
  const [restorePath, setRestorePath] = useState("");
  const [releaseChecking, setReleaseChecking] = useState(false);
  const [releaseReadiness, setReleaseReadiness] = useState<ReleaseReadinessResult | null>(null);
  const [zoomMinutes, setZoomMinutes] = useState<ZoomMinutes>(30);
  const [selectedOverlap, setSelectedOverlap] = useState<OverlapInterval>();
  const [selectedRange, setSelectedRange] = useState<RangeSelection>();
  const dateRef = useRef(date);
  const bootstrappedRef = useRef(false);
  const locale = resolveLocale(
    settingsState?.language ?? "system",
    typeof navigator === "undefined" ? undefined : navigator.language
  );
  const t = useMemo(() => createTranslator(locale), [locale]);

  const selected = useMemo(() => {
    if (!ledger) return undefined;
    if (!selectedId) return undefined;
    return ledger.sessions.find((session) => session.id === selectedId);
  }, [ledger, selectedId]);

  const load = async (targetDate?: string, shouldScan = false): Promise<boolean> => {
    setError(undefined);
    setLoading(true);
    try {
      let resolvedDate = targetDate || date;
      const loadedSettings = await getSettings();
      setSettingsState(loadedSettings);
      if (!loadedSettings.onboardingCompleted) {
        setLoading(false);
        return false;
      }
      if (!resolvedDate) resolvedDate = await latestDate();
      if (shouldScan) {
        setScanning(true);
        await scanSources();
        setScanning(false);
      }
      const nextLedger = await getDay(resolvedDate);
      setDate(nextLedger.metrics.date);
      dateRef.current = nextLedger.metrics.date;
      setLedger(nextLedger);
      setSelectedId((current) => current ?? nextLedger.sessions[0]?.id);
      return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      return false;
    } finally {
      setScanning(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    if (bootstrappedRef.current) return;
    bootstrappedRef.current = true;
    let cancelled = false;
    const bootstrap = async () => {
      const loaded = await load(undefined, false);
      if (!loaded || cancelled) return;

      const initialDate = dateRef.current;
      setScanning(true);
      try {
        await scanSources();
        if (cancelled) return;
        const refreshDate = dateRef.current === initialDate ? undefined : dateRef.current;
        await load(refreshDate, false);
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : String(caught));
      } finally {
        if (!cancelled) setScanning(false);
      }
    };

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (view !== "inbox" || !ledger || !selected) return;
      const index = ledger.sessions.findIndex((session) => session.id === selected.id);
      if (event.key.toLowerCase() === "j") setSelectedId(ledger.sessions[Math.min(ledger.sessions.length - 1, index + 1)]?.id);
      if (event.key.toLowerCase() === "k") setSelectedId(ledger.sessions[Math.max(0, index - 1)]?.id);
      if (event.key === "1") void applyPatch(selected, { status: "useful" });
      if (event.key === "2") void applyPatch(selected, { status: "needs_review" });
      if (event.key === "3") void applyPatch(selected, { status: "needs_repair" });
      if (event.key === "4") void applyPatch(selected, { status: "discarded" });
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [view, ledger, selected]);

  const applyPatch = async (session: SessionRecord, patch: SessionPatch) => {
    const updated = await patchSession(session.id, patch);
    const nextLedger = await getDay(date || ledger?.metrics.date);
    setLedger(nextLedger);
    setSelectedId(updated.id);
    setSelectedOverlap(undefined);
    setSelectedRange(undefined);
  };

  const selectSession = (session: SessionRecord) => {
    setSelectedId(session.id);
    setSelectedOverlap(undefined);
    setSelectedRange(undefined);
  };

  const selectOverlap = (overlap: OverlapInterval) => {
    setSelectedOverlap(overlap);
    setSelectedRange(undefined);
    setSelectedId(undefined);
  };

  const selectRange = (range: RangeSelection) => {
    setSelectedRange(range);
    setSelectedOverlap(undefined);
    setSelectedId(undefined);
  };

  const persistSettings = async (next?: AppSettings) => {
    const settingsToSave = next ?? settingsState;
    if (!settingsToSave) return;
    const saved = await saveSettings(settingsToSave);
    setSettingsState(saved);
  };

  const completeOnboarding = async () => {
    if (!settingsState) return;
    const saved = await saveSettings({ ...settingsState, onboardingCompleted: true });
    setSettingsState(saved);
    await load(date, true);
  };

  const saveAndScanSettings = async () => {
    await persistSettings();
    await load(date, true);
  };

  const runIntegrationSync = async () => {
    if (!settingsState) return;
    setError(undefined);
    setIntegrationSyncing(true);
    try {
      const saved = await saveSettings(settingsState);
      setSettingsState(saved);
      const result = await syncIntegrations();
      setIntegrationSyncResult(result);
      const nextLedger = await getDay(date || ledger?.metrics.date);
      setLedger(nextLedger);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setIntegrationSyncing(false);
    }
  };

  const runIntegrationDiagnostics = async () => {
    if (!settingsState) return;
    setError(undefined);
    setIntegrationDiagnosing(true);
    try {
      const saved = await saveSettings(settingsState);
      setSettingsState(saved);
      setIntegrationDiagnostics(await diagnoseIntegrations());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setIntegrationDiagnosing(false);
    }
  };

  const runCreateBackup = async () => {
    setError(undefined);
    setBackupWorking(true);
    try {
      setBackupResult(await createBackup());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBackupWorking(false);
    }
  };

  const runRestoreBackup = async () => {
    if (!restorePath.trim()) return;
    setError(undefined);
    setBackupWorking(true);
    try {
      setBackupResult(await restoreBackup(restorePath.trim()));
      await load(date, false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBackupWorking(false);
    }
  };

  const runReleaseCheck = async () => {
    setError(undefined);
    setReleaseChecking(true);
    try {
      setReleaseReadiness(await getReleaseReadiness());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setReleaseChecking(false);
    }
  };

  const runStartReview = async (session: SessionRecord) => {
    const updated = await startReview(session.id);
    const nextLedger = await getDay(date || ledger?.metrics.date);
    setLedger(nextLedger);
    setSelectedId(updated.id);
  };

  const runFinishReview = async (session: SessionRecord, status: SessionStatus = "useful") => {
    const updated = await finishReview(session.id, status);
    const nextLedger = await getDay(date || ledger?.metrics.date);
    setLedger(nextLedger);
    setSelectedId(updated.id);
  };

  const runStartRepair = async (session: SessionRecord) => {
    const updated = await startRepair(session.id);
    const nextLedger = await getDay(date || ledger?.metrics.date);
    setLedger(nextLedger);
    setSelectedId(updated.id);
  };

  const runFinishRepair = async (session: SessionRecord, status: SessionStatus = "repaired") => {
    const updated = await finishRepair(session.id, status);
    const nextLedger = await getDay(date || ledger?.metrics.date);
    setLedger(nextLedger);
    setSelectedId(updated.id);
  };

  const openView = (nextView: View, nextFilter?: Filter) => {
    setView(nextView);
    if (nextFilter) setFilter(nextFilter);
  };

  const refreshReport = async () => {
    if (!ledger) return;
    const result =
      reportMode === "weekly"
        ? await generateWeeklyReport(ledger.metrics.date, locale)
        : await generateReport(ledger.metrics.date, locale);
    setMarkdown(result.markdown);
    setExportedPath(result.exportedPath);
    setRenderedReportKey(`${reportMode}:${ledger.metrics.date}`);
  };

  useEffect(() => {
    const reportKey = ledger ? `${reportMode}:${ledger.metrics.date}` : "";
    if (view === "report" && ledger && renderedReportKey !== reportKey) void refreshReport();
  }, [view, ledger?.metrics.date, reportMode, renderedReportKey]);

  if (settingsState && !settingsState.onboardingCompleted) {
    return (
      <TranslationContext.Provider value={t}>
        <Onboarding settings={settingsState} onChange={setSettingsState} onComplete={completeOnboarding} />
      </TranslationContext.Provider>
    );
  }

  if (loading && !ledger) {
    return (
      <TranslationContext.Provider value={t}>
        <div className="boot-screen">
          <RefreshCw className="spin" />
          <span>{t("app.loading")}</span>
        </div>
      </TranslationContext.Provider>
    );
  }

  if (!ledger) {
    return (
      <TranslationContext.Provider value={t}>
        <div className="boot-screen">
          <AlertCircle />
          <span>{error ?? t("app.unableToLoad")}</span>
        </div>
      </TranslationContext.Provider>
    );
  }

  const detailPanel = (
    <DetailPanel
      session={selected}
      ledger={ledger}
      overlap={selectedOverlap}
      range={selectedRange}
      onPatch={(session, patch) => void applyPatch(session, patch)}
      onSelect={selectSession}
      onStartReview={(session) => void runStartReview(session)}
      onFinishReview={(session, status) => void runFinishReview(session, status)}
      onStartRepair={(session) => void runStartRepair(session)}
      onFinishRepair={(session, status) => void runFinishRepair(session, status)}
    />
  );

  return (
    <TranslationContext.Provider value={t}>
      <div className="app-shell">
        <AppSidebar
          view={view}
          date={date}
          ledger={ledger}
          error={error}
          onDateChange={(nextDate) => void load(nextDate)}
          onViewChange={setView}
        />
        <section className="app-workspace">
          <WorkspaceHeader ledger={ledger} scanning={scanning} onRescan={() => void load(date, true)} />

          {view === "today" && (
            <TodayView
              ledger={ledger}
              selectedId={selected?.id}
              zoomMinutes={zoomMinutes}
              selectedOverlap={selectedOverlap}
              selectedRange={selectedRange}
              onZoom={setZoomMinutes}
              onSelect={selectSession}
              onOverlapSelect={selectOverlap}
              onRangeSelect={selectRange}
              onNavigate={openView}
            />
          )}
          {view === "inbox" && (
            <InboxView
              ledger={ledger}
              selected={selected}
              filter={filter}
              search={search}
              onFilter={setFilter}
              onSearch={setSearch}
              onSelect={selectSession}
              onStatus={(session, status) => applyPatch(session, { status })}
              inspector={detailPanel}
            />
          )}
          {view === "timeline" && (
            <ProjectTimelineView
              ledger={ledger}
              selectedId={selected?.id}
              zoomMinutes={zoomMinutes}
              selectedOverlap={selectedOverlap}
              selectedRange={selectedRange}
              onZoom={setZoomMinutes}
              onSelect={selectSession}
              onOverlapSelect={selectOverlap}
              onRangeSelect={selectRange}
              inspector={selected || selectedOverlap || selectedRange ? detailPanel : undefined}
            />
          )}
          {view === "operating" && (
            <OperatingReviewView ledger={ledger} onSelect={(session) => {
              selectSession(session);
              setView("inbox");
            }} />
          )}
          {view === "report" && (
            <ReportView
              ledger={ledger}
              mode={reportMode}
              markdown={markdown}
              exportedPath={exportedPath}
              onModeChange={(mode) => {
                setReportMode(mode);
                setExportedPath(undefined);
              }}
              onGenerate={refreshReport}
              onChange={setMarkdown}
              onCopy={() => void navigator.clipboard.writeText(markdown)}
              onExport={async () => {
                const result =
                  reportMode === "weekly"
                    ? await exportWeeklyReport(ledger.metrics.date, markdown, locale)
                    : await exportReport(ledger.metrics.date, markdown, locale);
                setExportedPath(result.exportedPath);
              }}
            />
          )}
          {view === "settings" && settingsState && (
            <SettingsView
              settings={settingsState}
              onChange={setSettingsState}
              onSave={() => void persistSettings()}
              onScan={() => void saveAndScanSettings()}
              onSyncIntegrations={() => void runIntegrationSync()}
              onDiagnoseIntegrations={() => void runIntegrationDiagnostics()}
              onCreateBackup={() => void runCreateBackup()}
              onRestoreBackup={() => void runRestoreBackup()}
              onCheckRelease={() => void runReleaseCheck()}
              integrationSyncing={integrationSyncing}
              integrationSyncResult={integrationSyncResult}
              integrationDiagnostics={integrationDiagnostics}
              integrationDiagnosing={integrationDiagnosing}
              backupResult={backupResult}
              backupWorking={backupWorking}
              restorePath={restorePath}
              onRestorePathChange={setRestorePath}
              releaseReadiness={releaseReadiness}
              releaseChecking={releaseChecking}
            />
          )}
        </section>
      </div>
    </TranslationContext.Provider>
  );
}
