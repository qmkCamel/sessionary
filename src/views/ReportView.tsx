import { Clipboard, Download, RefreshCw } from "lucide-react";
import type { DayLedger } from "../shared/types";
import type { ReportMode } from "../app/types";
import { compactNumber, costLabel, percentLabel, secondsLabel } from "../app/format";
import { useTranslation } from "../app/translation";

export function ReportOverview({ ledger }: { ledger: DayLedger }) {
  const t = useTranslation();
  const promptingSeconds = ledger.metrics.promptingSecondsEstimated + ledger.metrics.promptingSecondsManual;
  const aiWaitingSeconds = ledger.metrics.aiWaitingSecondsEstimated + ledger.metrics.aiWaitingSecondsManual;
  const reviewSeconds = ledger.metrics.reviewSecondsEstimated + ledger.metrics.reviewSecondsManual;
  const repairSeconds = ledger.metrics.repairSecondsEstimated + ledger.metrics.repairSecondsManual;
  const totalTime =
    promptingSeconds +
    aiWaitingSeconds +
    reviewSeconds +
    repairSeconds;
  const topProjects = [...ledger.projects].sort((left, right) => right.activeSeconds - left.activeSeconds).slice(0, 5);

  return (
    <aside className="report-overview">
      <section className="panel">
        <div className="panel-header">
          <h2>{t("report.keyMetrics")}</h2>
        </div>
        <dl className="overview-list">
          <div>
            <dt>{t("metric.projects")}</dt>
            <dd>{ledger.metrics.projectCount}</dd>
          </div>
          <div>
            <dt>{t("metric.sessions")}</dt>
            <dd>{ledger.metrics.sessionCount}</dd>
          </div>
          <div>
            <dt>{t("status.needs_review")}</dt>
            <dd>{ledger.metrics.needsReviewCount}</dd>
          </div>
          <div>
            <dt>{t("status.needs_repair")}</dt>
            <dd>{ledger.metrics.needsRepairCount}</dd>
          </div>
          <div>
            <dt>{t("metric.highValue")}</dt>
            <dd>{ledger.metrics.highValueCount}</dd>
          </div>
          <div>
            <dt>{t("metric.lowValue")}</dt>
            <dd>{ledger.metrics.lowValueCount}</dd>
          </div>
        </dl>
      </section>

      <section className="panel">
        <div className="panel-header">
          <h2>{t("report.timeTotal")}</h2>
          <span>{secondsLabel(totalTime)}</span>
        </div>
        <dl className="overview-list">
          <div>
            <dt>{t("metric.prompting")}</dt>
            <dd>{secondsLabel(promptingSeconds)}</dd>
          </div>
          <div>
            <dt>{t("metric.aiWaiting")}</dt>
            <dd>{secondsLabel(aiWaitingSeconds)}</dd>
          </div>
          <div>
            <dt>{t("metric.review")}</dt>
            <dd>{secondsLabel(reviewSeconds)}</dd>
          </div>
          <div>
            <dt>{t("metric.repair")}</dt>
            <dd>{secondsLabel(repairSeconds)}</dd>
          </div>
        </dl>
      </section>

      <section className="panel">
        <div className="panel-header">
          <h2>{t("report.topProjects")}</h2>
        </div>
        <div className="compact-list">
          {topProjects.map((project, index) => (
            <div className="overview-row" key={project.path}>
              <span>{index + 1}. {project.name}</span>
              <strong>{secondsLabel(project.activeSeconds)}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <h2>{t("detail.activity")}</h2>
        </div>
        <dl className="overview-list">
          <div>
            <dt>{t("metric.tools")}</dt>
            <dd>{compactNumber(ledger.metrics.toolCallCount)}</dd>
          </div>
          <div>
            <dt>{t("metric.tokens")}</dt>
            <dd>{compactNumber(ledger.metrics.tokenCount)}</dd>
          </div>
          <div>
            <dt>{t("metric.cost")}</dt>
            <dd>{costLabel(ledger.metrics.costAmount)}</dd>
          </div>
          <div>
            <dt>{t("value.needs_human_repair")}</dt>
            <dd>{ledger.metrics.needsRepairValueCount}</dd>
          </div>
        </dl>
      </section>

      <section className="panel">
        <div className="panel-header">
          <h2>{t("parallelReview.title")}</h2>
          <span>{t("metric.estimated")}</span>
        </div>
        <dl className="overview-list">
          <div>
            <dt>{t("parallelReview.parallelRatio")}</dt>
            <dd>{percentLabel(ledger.parallelReview.parallelProjectRatio)}</dd>
          </div>
          <div>
            <dt>{t("parallelReview.waitingReviewOverlap")}</dt>
            <dd>{secondsLabel(ledger.parallelReview.aiWaitingHumanOverlapSeconds)}</dd>
          </div>
          <div>
            <dt>{t("parallelReview.reviewBacklog")}</dt>
            <dd>{ledger.parallelReview.reviewBacklogSessionCount}</dd>
          </div>
          <div>
            <dt>{t("parallelReview.shortSwitches")}</dt>
            <dd>{ledger.parallelReview.shortContextSwitchCount}</dd>
          </div>
        </dl>
      </section>

      <section className="panel">
        <div className="panel-header">
          <h2>{t("deliveryReview.title")}</h2>
        </div>
        <dl className="overview-list">
          <div>
            <dt>{t("deliveryReview.absorbed")}</dt>
            <dd>{ledger.deliveryReview.absorbedSessions}/{ledger.metrics.sessionCount}</dd>
          </div>
          <div>
            <dt>{t("deliveryReview.committed")}</dt>
            <dd>{ledger.deliveryReview.sessionsWithCommits}</dd>
          </div>
          <div>
            <dt>{t("deliveryReview.prLinked")}</dt>
            <dd>{ledger.deliveryReview.sessionsWithPr}</dd>
          </div>
          <div>
            <dt>{t("deliveryReview.ciSignals")}</dt>
            <dd>{ledger.deliveryReview.sessionsWithCiSignal}</dd>
          </div>
        </dl>
      </section>

      <section className="panel">
        <div className="panel-header">
          <h2>{t("operatingReview.title")}</h2>
          <span>{percentLabel(ledger.operatingReview.successRate)}</span>
        </div>
        <dl className="overview-list">
          <div>
            <dt>{t("operatingReview.sources")}</dt>
            <dd>{ledger.operatingReview.crossToolSourceCount}</dd>
          </div>
          <div>
            <dt>{t("operatingReview.projects")}</dt>
            <dd>{ledger.operatingReview.crossProjectCount}</dd>
          </div>
          <div>
            <dt>{t("operatingReview.playbook")}</dt>
            <dd>{ledger.operatingReview.playbook.length}</dd>
          </div>
        </dl>
      </section>

      <section className="panel privacy-panel">
        <div className="panel-header">
          <h2>{t("common.localOnly")}</h2>
        </div>
        <p>{t("report.privacyNote")}</p>
      </section>
    </aside>
  );
}


export function ReportView({
  ledger,
  mode,
  markdown,
  exportedPath,
  onModeChange,
  onGenerate,
  onChange,
  onCopy,
  onExport
}: {
  ledger: DayLedger;
  mode: ReportMode;
  markdown: string;
  exportedPath?: string;
  onModeChange: (mode: ReportMode) => void;
  onGenerate: () => void;
  onChange: (value: string) => void;
  onCopy: () => void;
  onExport: () => void;
}) {
  const t = useTranslation();
  return (
    <main className="workspace report-view">
      <div className="page-title">
        <div>
          <p>{ledger.metrics.date}</p>
          <h1>{t("nav.report")}</h1>
        </div>
        <div className="report-actions">
          <div className="segmented-control">
            {(["daily", "weekly"] as ReportMode[]).map((item) => (
              <button key={item} className={mode === item ? "active" : ""} onClick={() => onModeChange(item)}>
                {t(item === "daily" ? "report.daily" : "report.weekly")}
              </button>
            ))}
          </div>
          <div className="toolbar">
            <button title={t("report.generate")} onClick={onGenerate}>
              <RefreshCw size={16} />
            </button>
            <button title={t("report.copy")} onClick={onCopy}>
              <Clipboard size={16} />
            </button>
            <button title={t("report.export")} onClick={onExport}>
              <Download size={16} />
            </button>
          </div>
        </div>
      </div>
      <div className="report-layout">
        <section className="report-document">
          <textarea className="report-editor" value={markdown} onChange={(event) => onChange(event.target.value)} />
          {exportedPath && <p className="export-path">{t("report.exportedTo")} {exportedPath}</p>}
        </section>
        <ReportOverview ledger={ledger} />
      </div>
    </main>
  );
}
