import { Check, Play, SlidersHorizontal, Square, Wrench } from "lucide-react";
import { useEffect, useState } from "react";
import type { DayLedger, OverlapInterval, SessionPatch, SessionRecord, SessionStatus } from "../shared/types";
import type { RangeSelection } from "../app/types";
import { ciStatusLabel, issueLabel, mergeStatusLabel } from "../app/delivery";
import { secondsLabel, timeLabel } from "../app/format";
import { statusKeys, timeFieldKeys, valueReasonKeys } from "../app/labels";
import { sessionsInRange } from "../app/timeline";
import { useTranslation } from "../app/translation";
import { EmptyState, SessionPill, statusIcon, ValueChip } from "../components/shared";

export function DetailPanel({
  session,
  ledger,
  overlap,
  range,
  onPatch,
  onSelect,
  onStartReview,
  onFinishReview,
  onStartRepair,
  onFinishRepair
}: {
  session?: SessionRecord;
  ledger: DayLedger;
  overlap?: OverlapInterval;
  range?: RangeSelection;
  onPatch: (session: SessionRecord, patch: SessionPatch) => void;
  onSelect: (session: SessionRecord) => void;
  onStartReview: (session: SessionRecord) => void;
  onFinishReview: (session: SessionRecord, status?: SessionStatus) => void;
  onStartRepair: (session: SessionRecord) => void;
  onFinishRepair: (session: SessionRecord, status?: SessionStatus) => void;
}) {
  const t = useTranslation();
  const [note, setNote] = useState("");
  const [times, setTimes] = useState({ prompting: 0, waiting: 0, review: 0, repair: 0 });

  useEffect(() => {
    setNote(session?.note ?? "");
    setTimes({
      prompting: Math.round((session?.promptingSeconds ?? 0) / 60),
      waiting: Math.round((session?.waitingSeconds ?? 0) / 60),
      review: Math.round((session?.reviewSeconds ?? 0) / 60),
      repair: Math.round((session?.repairSeconds ?? 0) / 60)
    });
  }, [session]);

  if (overlap) {
    const overlapSessions = ledger.sessions.filter((item) => overlap.sessionIds.includes(item.id));
    return (
      <aside className="detail-panel">
        <div className="detail-title">
          <span className="overlap-dot" />
          <div>
            <h2>{t("projectTimeline.overlapSummary")}</h2>
            <p>{overlap.projectNames.join(" + ")}</p>
          </div>
        </div>
        <section className="detail-section">
          <h3>{t("detail.interval")}</h3>
          <dl className="detail-stats">
            <div>
              <dt>{t("detail.started")}</dt>
              <dd>{timeLabel(overlap.startedAt, t)}</dd>
            </div>
            <div>
              <dt>{t("detail.ended")}</dt>
              <dd>{timeLabel(overlap.endedAt, t)}</dd>
            </div>
            <div>
              <dt>{t("detail.duration")}</dt>
              <dd>{secondsLabel(overlap.seconds)}</dd>
            </div>
            <div>
              <dt>{t("detail.sessions")}</dt>
              <dd>{overlap.sessionIds.length}</dd>
            </div>
          </dl>
        </section>
        <section className="detail-section">
          <h3>{t("detail.sessions")}</h3>
          <div className="compact-list">
            {overlapSessions.map((item) => (
              <SessionPill key={item.id} session={item} selected={false} onSelect={() => onSelect(item)} />
            ))}
          </div>
        </section>
      </aside>
    );
  }

  if (range) {
    const rangeSessions = sessionsInRange(ledger, range);
    const projects = [...new Set(rangeSessions.map((item) => item.projectName))];
    return (
      <aside className="detail-panel">
        <div className="detail-title">
          <SlidersHorizontal size={18} />
          <div>
            <h2>{t("detail.selectedRange")}</h2>
            <p>
              {timeLabel(range.startedAt, t)}-{timeLabel(range.endedAt, t)}
            </p>
          </div>
        </div>
        <section className="detail-section">
          <h3>{t("detail.range")}</h3>
          <dl className="detail-stats">
            <div>
              <dt>{t("detail.projects")}</dt>
              <dd>{projects.length}</dd>
            </div>
            <div>
              <dt>{t("detail.sessions")}</dt>
              <dd>{rangeSessions.length}</dd>
            </div>
          </dl>
        </section>
        <section className="detail-section">
          <h3>{t("detail.projects")}</h3>
          <div className="file-list">{projects.map((project) => <span key={project}>{project}</span>)}</div>
        </section>
      </aside>
    );
  }

  if (!session) {
    return (
      <aside className="detail-panel">
        <EmptyState title={t("detail.selectSession")} />
      </aside>
    );
  }

  return (
    <aside className="detail-panel">
      <div className="detail-title">
        <span className={`source-dot ${session.source}`} />
        <div>
          <h2>{session.summary || session.sourceSessionId}</h2>
          <p>{session.projectPath}</p>
        </div>
      </div>

      <div className="status-grid">
        {(["useful", "needs_review", "needs_repair", "repaired", "failed", "discarded"] as SessionStatus[]).map((status) => (
          <button key={status} className={session.status === status ? "active" : ""} onClick={() => onPatch(session, { status })}>
            {statusIcon(status)}
            {t(statusKeys[status])}
          </button>
        ))}
      </div>

      <section className="detail-section">
        <h3>{t("detail.value")}</h3>
        <div className="value-summary">
          <ValueChip session={session} showScore />
          <span>{session.value.score}/100</span>
        </div>
        <div className="file-list">
          {session.value.reasons.map((reason) => (
            <span key={reason}>{t(valueReasonKeys[reason])}</span>
          ))}
        </div>
      </section>

      <section className="detail-section delivery-detail-section">
        <h3>{t("deliveryReview.title")}</h3>
        <div className="delivery-state-row">
          <button
            className={session.delivery.absorbed ? "active" : ""}
            onClick={() => onPatch(session, { absorbed: !session.delivery.absorbed })}
          >
            <Check size={15} />
            {session.delivery.absorbed ? t("deliveryReview.absorbed") : t("deliveryReview.markAbsorbed")}
          </button>
          <span>{Math.round(session.delivery.confidence * 100)}% {t("deliveryReview.confidence")}</span>
        </div>
        <dl className="detail-stats">
          <div>
            <dt>{t("deliveryReview.committed")}</dt>
            <dd>{session.delivery.committedAfterSession ? session.delivery.commits.length : 0}</dd>
          </div>
          <div>
            <dt>{t("deliveryReview.dirty")}</dt>
            <dd>{session.delivery.dirtyAfterSession ? t("common.enabled") : t("common.off")}</dd>
          </div>
          <div>
            <dt>{t("deliveryReview.tests")}</dt>
            <dd>{session.delivery.testCommands.length}</dd>
          </div>
          <div>
            <dt>{t("deliveryReview.ciSignals")}</dt>
            <dd>{ciStatusLabel(session.delivery.integration.ci.status, t)}</dd>
          </div>
        </dl>
        {session.delivery.diffSummary && <p className="delivery-summary">{session.delivery.diffSummary}</p>}
        <div className="delivery-link-list">
          {session.delivery.integration.pullRequest && (
            <span>
              {t("deliveryReview.prLinked")}: {session.delivery.integration.pullRequest.url ?? t("deliveryReview.unknownRemote")} · {mergeStatusLabel(session.delivery.integration.pullRequest.mergeStatus, t)}
              {session.delivery.integration.pullRequest.state ? ` · ${session.delivery.integration.pullRequest.state}` : ""}
            </span>
          )}
          {session.delivery.integration.issues.length > 0 && (
            <span>
              {t("deliveryReview.issues")}: {session.delivery.integration.issues.map(issueLabel).join(", ")}
            </span>
          )}
          <span>
            {t("deliveryReview.reviewComments")}: {session.delivery.integration.reviewCommentCount ?? t("deliveryReview.unknownRemote")}
          </span>
        </div>
        {session.delivery.testCommands.length > 0 && (
          <div className="file-list command-list">
            {session.delivery.testCommands.slice(0, 5).map((command) => (
              <span key={command.command}>{command.command} · {command.status}</span>
            ))}
          </div>
        )}
      </section>

      <section className="detail-section">
        <h3>{t("detail.reviewFlow")}</h3>
        <div className="review-actions">
          <button className={session.reviewStartedAt ? "active" : ""} onClick={() => onStartReview(session)}>
            <Play size={15} />
            {t("detail.startReview")}
          </button>
          <button onClick={() => onFinishReview(session, "useful")}>
            <Square size={15} />
            {t("detail.done")}
          </button>
          <button onClick={() => onFinishReview(session, "needs_repair")}>
            <Wrench size={15} />
            {t("detail.needsRepair")}
          </button>
        </div>
        {session.reviewStartedAt && <small>{t("detail.reviewRunningSince")} {timeLabel(session.reviewStartedAt, t)}</small>}
      </section>

      <section className="detail-section">
        <h3>{t("detail.repairFlow")}</h3>
        <div className="review-actions">
          <button className={session.repairStartedAt ? "active" : ""} onClick={() => onStartRepair(session)}>
            <Play size={15} />
            {t("detail.startRepair")}
          </button>
          <button onClick={() => onFinishRepair(session, "repaired")}>
            <Square size={15} />
            {t("detail.markRepaired")}
          </button>
          <button onClick={() => onPatch(session, { status: "needs_repair" })}>
            <Wrench size={15} />
            {t("detail.needsRepair")}
          </button>
        </div>
        {session.repairStartedAt && <small>{t("detail.repairRunningSince")} {timeLabel(session.repairStartedAt, t)}</small>}
      </section>

      <section className="detail-section">
        <h3>{t("detail.time")}</h3>
        <div className="time-grid">
          {(["prompting", "waiting", "review", "repair"] as const).map((field) => (
            <label key={field}>
              <span>
                {t(timeFieldKeys[field])}
                <small>{session.timeFields[field] === "manual" ? t("common.manual") : t("metric.estimated")}</small>
              </span>
              <input
                type="number"
                min="0"
                value={times[field]}
                onChange={(event) => setTimes({ ...times, [field]: Number(event.target.value) })}
              />
            </label>
          ))}
        </div>
        <button
          className="primary-button"
          onClick={() =>
            onPatch(session, {
              promptingSeconds: times.prompting * 60,
              waitingSeconds: times.waiting * 60,
              reviewSeconds: times.review * 60,
              repairSeconds: times.repair * 60
            })
          }
        >
          {t("detail.saveTime")}
        </button>
      </section>

      <section className="detail-section">
        <h3>{t("detail.activity")}</h3>
        <dl className="detail-stats">
          <div>
            <dt>{t("detail.started")}</dt>
            <dd>{timeLabel(session.startedAt, t)}</dd>
          </div>
          <div>
            <dt>{t("detail.ended")}</dt>
            <dd>{timeLabel(session.endedAt, t)}</dd>
          </div>
          <div>
            <dt>{t("detail.duration")}</dt>
            <dd>{secondsLabel(session.durationSeconds)}</dd>
          </div>
          <div>
            <dt>{t("detail.tokens")}</dt>
            <dd>{session.tokenCount?.toLocaleString() ?? t("common.notAvailable")}</dd>
          </div>
          <div>
            <dt>{t("metric.tools")}</dt>
            <dd>{session.toolCallCount}</dd>
          </div>
          <div>
            <dt>{t("detail.cost")}</dt>
            <dd>{session.costAmount == null ? "n/a" : `$${session.costAmount.toFixed(4)}`}</dd>
          </div>
        </dl>
      </section>

      <section className="detail-section">
        <h3>{t("detail.files")}</h3>
        <div className="file-list">
          {session.changedFiles.length === 0 ? <span>{t("detail.noFileHints")}</span> : session.changedFiles.map((file) => <span key={file}>{file}</span>)}
        </div>
      </section>

      <section className="detail-section">
        <h3>{t("detail.note")}</h3>
        <textarea value={note} onChange={(event) => setNote(event.target.value)} />
        <button className="primary-button" onClick={() => onPatch(session, { note })}>
          {t("detail.saveNote")}
        </button>
      </section>
    </aside>
  );
}
