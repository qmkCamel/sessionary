import type { SessionRecord, SessionStatus, SessionValue, SessionValueCategory, SessionValueReason } from "./types";

type ValueSession = Pick<
  SessionRecord,
  | "status"
  | "toolCallCount"
  | "tokenCount"
  | "costAmount"
  | "changedFiles"
  | "promptingSeconds"
  | "reviewSeconds"
  | "repairSeconds"
  | "durationSeconds"
>;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function terminalValue(status: SessionStatus): SessionValue | undefined {
  if (status === "discarded") {
    return { category: "discarded", score: 5, reasons: ["discarded"] };
  }
  if (status === "failed") {
    return { category: "discarded", score: 10, reasons: ["failed"] };
  }
  return undefined;
}

export function classifySessionValue(session: ValueSession): SessionValue {
  const terminal = terminalValue(session.status);
  if (terminal) return terminal;

  const reasons: SessionValueReason[] = [];
  let score = 45;

  if (session.status === "needs_repair") {
    reasons.push("needs_repair");
    score -= 12;
  } else if (session.status === "unknown" || session.status === "needs_review") {
    reasons.push("needs_review");
    score -= 6;
  } else if (session.status === "useful") {
    reasons.push("marked_useful");
    score += 24;
  } else if (session.status === "repaired") {
    reasons.push("marked_repaired");
    score += 16;
  }

  const hasFileHints = session.changedFiles.length > 0;
  const hasToolCalls = session.toolCallCount > 0;
  const hasTokenUsage = (session.tokenCount ?? 0) > 0;

  if (hasFileHints) {
    reasons.push("has_file_hints");
    score += 14;
  }
  if (hasToolCalls) {
    reasons.push("has_tool_calls");
    score += clamp(Math.floor(session.toolCallCount / 3), 3, 12);
  }
  if (hasTokenUsage) {
    reasons.push("has_token_usage");
    score += 4;
  }
  if (!hasFileHints && !hasToolCalls && !hasTokenUsage) {
    reasons.push("no_output_signals");
    score -= 12;
  }

  if (session.costAmount != null) {
    if (session.costAmount <= 1) {
      reasons.push("low_cost");
      score += 5;
    } else if (session.costAmount >= 5) {
      reasons.push("high_cost");
      score -= 18;
    } else if (session.costAmount >= 2) {
      reasons.push("high_cost");
      score -= 9;
    }
  }

  const humanSeconds = session.promptingSeconds + session.reviewSeconds + session.repairSeconds;
  if ((humanSeconds * 100) / Math.max(1, session.durationSeconds) > 55) {
    reasons.push("high_human_time");
    score -= 10;
  }
  if (session.repairSeconds > 0) {
    reasons.push("high_repair_time");
    score -= clamp(Math.floor(session.repairSeconds / 300), 4, 16);
  }

  const normalizedScore = clamp(score, 0, 100);
  let category: SessionValueCategory;
  if (session.status === "needs_repair") {
    category = "needs_human_repair";
  } else if (session.status === "unknown" || session.status === "needs_review") {
    category = "unreviewed";
  } else if (normalizedScore >= 72) {
    category = "high_value";
  } else if (normalizedScore >= 42) {
    category = "mixed_value";
  } else {
    category = "low_value";
  }

  return { category, score: normalizedScore, reasons };
}
