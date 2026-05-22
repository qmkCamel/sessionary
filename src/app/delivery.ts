import type { Translator } from "../i18n";
import type { SessionRecord } from "../shared/types";

export function ciStatusLabel(status: SessionRecord["delivery"]["integration"]["ci"]["status"], t: Translator) {
  if (status === "passed") return t("deliveryReview.ciPassed");
  if (status === "failed") return t("deliveryReview.ciFailed");
  if (status === "running") return t("deliveryReview.ciRunning");
  if (status === "unknown") return t("deliveryReview.ciUnknown");
  return t("deliveryReview.ciNotRecorded");
}

export function mergeStatusLabel(status: NonNullable<SessionRecord["delivery"]["integration"]["pullRequest"]>["mergeStatus"], t: Translator) {
  if (status === "merged") return t("deliveryReview.merged");
  if (status === "not_merged") return t("deliveryReview.notMerged");
  return t("deliveryReview.unknownRemote");
}

export function issueLabel(issue: SessionRecord["delivery"]["integration"]["issues"][number]) {
  return [issue.key, issue.state, issue.title].filter(Boolean).join(" · ");
}
