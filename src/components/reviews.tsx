import type { Translator } from "../i18n";
import type { DayLedger, DeliveryInsight, OverlapInterval, ParallelInsight } from "../shared/types";
import { deliveryInsightKeys, parallelInsightKeys } from "../app/labels";
import { percentLabel, secondsLabel, timeLabel } from "../app/format";
import { useTranslation } from "../app/translation";
import { EmptyState, Metric } from "./shared";

export function insightDetail(insight: ParallelInsight, t: Translator): string {
  if (insight.kind === "parallel_payoff") {
    return `${secondsLabel(insight.seconds)} ${t("parallelInsight.waitingReviewOverlap")}`;
  }
  if (insight.kind === "review_bottleneck") {
    return `${insight.count} ${t("common.sessions")} · ${secondsLabel(insight.seconds)} ${t("metric.estimated")}`;
  }
  if (insight.kind === "context_switching") {
    return `${insight.count} ${t("parallelInsight.shortSwitches")}`;
  }
  return `${insight.count} ${t("common.sessions")}`;
}

export function ParallelInsightCard({ insight }: { insight: ParallelInsight }) {
  const t = useTranslation();
  return (
    <div className={`insight-card ${insight.severity}`}>
      <strong>{t(parallelInsightKeys[insight.kind])}</strong>
      <span>{insightDetail(insight, t)}</span>
      {insight.projectNames.length > 0 && <small>{insight.projectNames.join(" + ")}</small>}
    </div>
  );
}

export function ParallelReviewStrip({ ledger }: { ledger: DayLedger }) {
  const t = useTranslation();
  return (
    <section className="parallel-strip">
      <Metric label={t("parallelReview.parallelRatio")} value={percentLabel(ledger.parallelReview.parallelProjectRatio)} hint={t("metric.estimated")} />
      <Metric label={t("parallelReview.waitingReviewOverlap")} value={secondsLabel(ledger.parallelReview.aiWaitingHumanOverlapSeconds)} hint={t("metric.estimated")} />
      <Metric label={t("parallelReview.reviewBacklog")} value={ledger.parallelReview.reviewBacklogSessionCount} hint={secondsLabel(ledger.parallelReview.reviewBacklogSeconds)} />
      <Metric label={t("parallelReview.shortSwitches")} value={ledger.parallelReview.shortContextSwitchCount} hint={`${ledger.parallelReview.contextSwitchCount} ${t("parallelReview.totalSwitches")}`} />
    </section>
  );
}

export function ParallelReviewPanel({
  ledger,
  onOverlapSelect
}: {
  ledger: DayLedger;
  onOverlapSelect: (overlap: OverlapInterval) => void;
}) {
  const t = useTranslation();
  return (
    <section className="panel parallel-review-panel">
      <div className="panel-header">
        <h2>{t("parallelReview.title")}</h2>
        <span>{t("metric.estimated")}</span>
      </div>
      <dl className="parallel-review-stats">
        <div>
          <dt>{t("parallelReview.parallelRatio")}</dt>
          <dd>{percentLabel(ledger.parallelReview.parallelProjectRatio)}</dd>
        </div>
        <div>
          <dt>{t("parallelReview.sessionParallel")}</dt>
          <dd>{secondsLabel(ledger.parallelReview.parallelSessionSeconds)}</dd>
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
          <dt>{t("metric.maxAgents")}</dt>
          <dd>{ledger.parallelReview.maxConcurrentSessions}</dd>
        </div>
        <div>
          <dt>{t("parallelReview.shortSwitches")}</dt>
          <dd>{ledger.parallelReview.shortContextSwitchCount}</dd>
        </div>
      </dl>
      <div className="insight-list">
        {ledger.parallelReview.insights.length === 0 ? (
          <EmptyState title={t("parallelReview.noInsights")} />
        ) : (
          ledger.parallelReview.insights.map((insight) => (
            <ParallelInsightCard key={`${insight.kind}-${insight.count}-${insight.seconds}`} insight={insight} />
          ))
        )}
      </div>
      <div className="panel-header compact">
        <h2>{t("parallelReview.sessionOverlaps")}</h2>
        <span>{ledger.sessionOverlaps.length}</span>
      </div>
      <div className="overlap-list compact-overlap-list">
        {ledger.sessionOverlaps.length === 0 ? (
          <EmptyState title={t("parallelReview.noSessionOverlaps")} />
        ) : (
          ledger.sessionOverlaps.slice(0, 5).map((overlap) => (
            <button
              key={`${overlap.startedAt}-${overlap.endedAt}`}
              onClick={() => onOverlapSelect(overlap)}
            >
              <span>
                <strong>{overlap.sessionIds.length} {t("common.sessions")}</strong>
                <small>{timeLabel(overlap.startedAt, t)}-{timeLabel(overlap.endedAt, t)}</small>
              </span>
              <em>{secondsLabel(overlap.seconds)}</em>
            </button>
          ))
        )}
      </div>
    </section>
  );
}

export function deliveryInsightDetail(insight: DeliveryInsight, t: Translator): string {
  if (insight.kind === "unabsorbed_output") return `${insight.count} ${t("deliveryReview.unabsorbed")}`;
  if (insight.kind === "dirty_after_session") return `${insight.count} ${t("deliveryReview.dirty")}`;
  if (insight.kind === "missing_tests") return `${insight.count} ${t("deliveryReview.missingTests")}`;
  return `${insight.count} ${t("deliveryReview.linkedSignals")}`;
}

export function DeliveryInsightCard({ insight }: { insight: DeliveryInsight }) {
  const t = useTranslation();
  return (
    <div className={`insight-card ${insight.severity}`}>
      <strong>{t(deliveryInsightKeys[insight.kind])}</strong>
      <span>{deliveryInsightDetail(insight, t)}</span>
    </div>
  );
}

export function DeliveryReviewStrip({ ledger }: { ledger: DayLedger }) {
  const t = useTranslation();
  return (
    <section className="delivery-strip">
      <Metric label={t("deliveryReview.absorbed")} value={`${ledger.deliveryReview.absorbedSessions}/${ledger.metrics.sessionCount}`} />
      <Metric label={t("deliveryReview.committed")} value={ledger.deliveryReview.sessionsWithCommits} />
      <Metric label={t("deliveryReview.dirty")} value={ledger.deliveryReview.sessionsWithDirtyChanges} />
      <Metric label={t("deliveryReview.tests")} value={ledger.deliveryReview.sessionsWithTests} />
      <Metric label={t("deliveryReview.prCiIssue")} value={`${ledger.deliveryReview.sessionsWithPr}/${ledger.deliveryReview.sessionsWithCiSignal}/${ledger.deliveryReview.sessionsWithIssues}`} />
    </section>
  );
}
