import type { Translator, TranslationKey } from "../i18n";
import type { DayLedger, PlaybookItem, SessionStatus } from "../shared/types";

export function playbookTitle(item: PlaybookItem, t: Translator) {
  const keys: Record<PlaybookItem["kind"], TranslationKey> = {
    reuse_pattern: "playbook.reuse_pattern",
    clear_review_backlog: "playbook.clear_review_backlog",
    absorb_before_more_agents: "playbook.absorb_before_more_agents",
    keep_parallel_limit_switches: "playbook.keep_parallel_limit_switches",
    add_test_loop: "playbook.add_test_loop"
  };
  return t(keys[item.kind]);
}

export function playbookDetail(item: PlaybookItem, t: Translator) {
  const keys: Record<PlaybookItem["kind"], TranslationKey> = {
    reuse_pattern: "playbookDetail.reuse_pattern",
    clear_review_backlog: "playbookDetail.clear_review_backlog",
    absorb_before_more_agents: "playbookDetail.absorb_before_more_agents",
    keep_parallel_limit_switches: "playbookDetail.keep_parallel_limit_switches",
    add_test_loop: "playbookDetail.add_test_loop"
  };
  return t(keys[item.kind]);
}


export function openLoopCount(ledger: DayLedger) {
  return ledger.metrics.unknownCount + ledger.metrics.needsReviewCount + ledger.metrics.needsRepairCount;
}

export function humanTimeSeconds(ledger: DayLedger) {
  return (
    ledger.metrics.promptingSecondsEstimated +
    ledger.metrics.promptingSecondsManual +
    ledger.metrics.reviewSecondsEstimated +
    ledger.metrics.reviewSecondsManual +
    ledger.metrics.repairSecondsEstimated +
    ledger.metrics.repairSecondsManual
  );
}

export function hasManualTime(ledger: DayLedger) {
  return (
    ledger.metrics.promptingSecondsManual +
    ledger.metrics.aiWaitingSecondsManual +
    ledger.metrics.reviewSecondsManual +
    ledger.metrics.repairSecondsManual
  ) > 0;
}

export function prioritySessions(ledger: DayLedger) {
  const priority: Record<SessionStatus, number> = {
    needs_repair: 0,
    needs_review: 1,
    unknown: 2,
    useful: 3,
    repaired: 4,
    failed: 5,
    discarded: 6
  };
  return [...ledger.sessions]
    .filter((session) => session.status === "unknown" || session.status === "needs_review" || session.status === "needs_repair")
    .sort((left, right) => priority[left.status] - priority[right.status] || new Date(left.startedAt).getTime() - new Date(right.startedAt).getTime());
}
