import type { DayLedger, SessionRecord } from "../shared/types";
import { ciStatusLabel, issueLabel, mergeStatusLabel } from "../app/delivery";
import { percentLabel } from "../app/format";
import { sourceLabels, taskTypeKeys } from "../app/labels";
import { playbookDetail, playbookTitle } from "../app/operating";
import { useTranslation } from "../app/translation";
import { EmptyState, Metric } from "../components/shared";

export function OperatingReviewView({ ledger, onSelect }: { ledger: DayLedger; onSelect: (session: SessionRecord) => void }) {
  const t = useTranslation();
  const deliveryRows = ledger.sessions
    .filter((session) => session.delivery.changedFiles.length > 0 || session.delivery.committedAfterSession || session.delivery.integration.pullRequest)
    .slice(0, 8);

  return (
    <main className="workspace operating-workspace">
      <div className="page-title">
        <div>
          <p>{ledger.metrics.date}</p>
          <h1>{t("nav.operating")}</h1>
          <span>{t("operatingReview.subhead")}</span>
        </div>
        <span className="freshness">
          {percentLabel(ledger.operatingReview.successRate)} · {ledger.operatingReview.playbook.length} {t("operatingReview.playbook")}
        </span>
      </div>

      <div className="metrics-grid operating-metrics">
        <Metric label={t("operatingReview.successRate")} value={percentLabel(ledger.operatingReview.successRate)} hint={`${ledger.operatingReview.successfulSessions}/${ledger.operatingReview.totalSessions}`} />
        <Metric label={t("operatingReview.sources")} value={ledger.operatingReview.crossToolSourceCount} />
        <Metric label={t("operatingReview.projects")} value={ledger.operatingReview.crossProjectCount} />
        <Metric label={t("deliveryReview.absorbed")} value={`${ledger.deliveryReview.absorbedSessions}/${ledger.deliveryReview.sessionsWithFileChanges}`} />
        <Metric label={t("deliveryReview.prLinked")} value={ledger.deliveryReview.sessionsWithPr} />
        <Metric label={t("deliveryReview.ciSignals")} value={ledger.deliveryReview.sessionsWithCiSignal} />
      </div>

      <section className="panel playbook-panel">
        <div className="panel-header">
          <h2>{t("operatingReview.playbook")}</h2>
          <span>{ledger.operatingReview.playbook.length}</span>
        </div>
        <div className="playbook-list">
          {ledger.operatingReview.playbook.length === 0 ? (
            <EmptyState title={t("operatingReview.noPlaybook")} />
          ) : (
            ledger.operatingReview.playbook.map((item) => (
              <article key={`${item.kind}-${item.sessionIds.join("-")}`} className="playbook-card">
                <strong>{playbookTitle(item, t)}</strong>
                <span>{playbookDetail(item, t)}</span>
                <small>
                  {item.source ? sourceLabels[item.source] : t("common.localOnly")}
                  {item.taskType ? ` · ${t(taskTypeKeys[item.taskType])}` : ""}
                </small>
              </article>
            ))
          )}
        </div>
      </section>

      <div className="operating-grid">
        <section className="panel">
          <div className="panel-header">
            <h2>{t("operatingReview.toolPerformance")}</h2>
          </div>
          <div className="operating-table">
            <div className="operating-table-row table-head">
              <span>{t("settings.sources")}</span>
              <span>{t("metric.sessions")}</span>
              <span>{t("operatingReview.successful")}</span>
              <span>{t("detail.value")}</span>
              <span>{t("operatingReview.topTask")}</span>
            </div>
            {ledger.operatingReview.toolPerformance.map((tool) => (
              <div className="operating-table-row" key={tool.source}>
                <span>{sourceLabels[tool.source]}</span>
                <span>{tool.sessionCount}</span>
                <span>{tool.successfulSessions}</span>
                <span>{Math.round(tool.averageValueScore)}</span>
                <span>{tool.topTaskType ? t(taskTypeKeys[tool.topTaskType]) : t("taskType.unknown")}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <h2>{t("operatingReview.taskTypes")}</h2>
          </div>
          <div className="operating-table">
            <div className="operating-table-row table-head">
              <span>{t("operatingReview.task")}</span>
              <span>{t("metric.sessions")}</span>
              <span>{t("operatingReview.successful")}</span>
              <span>{t("metric.repair")}</span>
              <span>{t("operatingReview.bestTool")}</span>
            </div>
            {ledger.operatingReview.taskTypes.map((task) => (
              <div className="operating-table-row" key={task.taskType}>
                <span>{t(taskTypeKeys[task.taskType])}</span>
                <span>{task.sessionCount}</span>
                <span>{task.successfulSessions}</span>
                <span>{task.repairSessions}</span>
                <span>{task.recommendedSource ? sourceLabels[task.recommendedSource] : t("common.notAvailable")}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="panel delivery-chain-panel">
        <div className="panel-header">
          <h2>{t("deliveryReview.chain")}</h2>
          <span>{t("deliveryReview.localAttribution")}</span>
        </div>
        <div className="delivery-table">
          <div className="delivery-table-row table-head">
            <span>{t("metric.sessions")}</span>
            <span>{t("deliveryReview.absorbed")}</span>
            <span>{t("deliveryReview.committed")}</span>
            <span>{t("deliveryReview.dirty")}</span>
            <span>{t("deliveryReview.prLinked")}</span>
            <span>{t("deliveryReview.ciSignals")}</span>
            <span>{t("deliveryReview.issues")}</span>
          </div>
          {deliveryRows.map((session) => (
            <button className="delivery-table-row" key={session.id} onClick={() => onSelect(session)}>
              <span>
                <strong>{session.projectName}</strong>
                <small>{session.summary}</small>
              </span>
              <span>{session.delivery.absorbed ? t("common.enabled") : t("common.off")}</span>
              <span>{session.delivery.committedAfterSession ? session.delivery.commits.length : 0}</span>
              <span>{session.delivery.dirtyAfterSession ? t("common.enabled") : t("common.off")}</span>
              <span>{session.delivery.integration.pullRequest ? mergeStatusLabel(session.delivery.integration.pullRequest.mergeStatus, t) : t("common.notAvailable")}</span>
              <span>{ciStatusLabel(session.delivery.integration.ci.status, t)}</span>
              <span>{session.delivery.integration.issues.map(issueLabel).join(", ") || t("common.notAvailable")}</span>
            </button>
          ))}
        </div>
      </section>
    </main>
  );
}
