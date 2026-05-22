import { Activity, FileText, GitBranch, Inbox, LayoutDashboard, Settings } from "lucide-react";
import type { TranslationKey } from "../i18n";
import type {
  DeliveryInsightKind,
  ParallelInsightKind,
  SessionStatus,
  SessionValueCategory,
  SessionValueReason,
  TaskType
} from "../shared/types";
import type { View } from "./types";

export const statusKeys: Record<SessionStatus, TranslationKey> = {
  unknown: "status.unknown",
  useful: "status.useful",
  needs_review: "status.needs_review",
  needs_repair: "status.needs_repair",
  repaired: "status.repaired",
  failed: "status.failed",
  discarded: "status.discarded"
};

export const sourceLabels = {
  codex: "Codex",
  claude: "Claude"
};

export const valueCategoryKeys: Record<SessionValueCategory, TranslationKey> = {
  high_value: "value.high_value",
  mixed_value: "value.mixed_value",
  low_value: "value.low_value",
  needs_human_repair: "value.needs_human_repair",
  discarded: "value.discarded",
  unreviewed: "value.unreviewed"
};

export const valueReasonKeys: Record<SessionValueReason, TranslationKey> = {
  marked_useful: "valueReason.marked_useful",
  marked_repaired: "valueReason.marked_repaired",
  has_file_hints: "valueReason.has_file_hints",
  has_tool_calls: "valueReason.has_tool_calls",
  has_token_usage: "valueReason.has_token_usage",
  low_cost: "valueReason.low_cost",
  high_cost: "valueReason.high_cost",
  high_human_time: "valueReason.high_human_time",
  high_repair_time: "valueReason.high_repair_time",
  needs_review: "valueReason.needs_review",
  needs_repair: "valueReason.needs_repair",
  discarded: "valueReason.discarded",
  failed: "valueReason.failed",
  no_output_signals: "valueReason.no_output_signals"
};

export const timeFieldKeys = {
  prompting: "time.prompting",
  waiting: "time.waiting",
  review: "time.review",
  repair: "time.repair"
} satisfies Record<"prompting" | "waiting" | "review" | "repair", TranslationKey>;

export const parallelInsightKeys: Record<ParallelInsightKind, TranslationKey> = {
  parallel_payoff: "parallelInsight.parallel_payoff",
  review_bottleneck: "parallelInsight.review_bottleneck",
  context_switching: "parallelInsight.context_switching",
  low_parallelism: "parallelInsight.low_parallelism"
};

export const deliveryInsightKeys: Record<DeliveryInsightKind, TranslationKey> = {
  unabsorbed_output: "deliveryInsight.unabsorbed_output",
  dirty_after_session: "deliveryInsight.dirty_after_session",
  missing_tests: "deliveryInsight.missing_tests",
  linked_delivery: "deliveryInsight.linked_delivery"
};

export const taskTypeKeys: Record<TaskType, TranslationKey> = {
  ui_frontend: "taskType.ui_frontend",
  docs: "taskType.docs",
  tests: "taskType.tests",
  backend: "taskType.backend",
  delivery: "taskType.delivery",
  repair: "taskType.repair",
  unknown: "taskType.unknown"
};

export const navItems: Array<{ id: View; labelKey: TranslationKey; icon: typeof LayoutDashboard }> = [
  { id: "today", labelKey: "nav.today", icon: LayoutDashboard },
  { id: "inbox", labelKey: "nav.inbox", icon: Inbox },
  { id: "timeline", labelKey: "nav.timeline", icon: Activity },
  { id: "operating", labelKey: "nav.operating", icon: GitBranch },
  { id: "report", labelKey: "nav.report", icon: FileText },
  { id: "settings", labelKey: "nav.settings", icon: Settings }
];
