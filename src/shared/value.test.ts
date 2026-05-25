import { describe, expect, it } from "vitest";
import { classifySessionValue } from "./value";
import type { SessionRecord } from "./types";

function session(overrides: Partial<SessionRecord> = {}): SessionRecord {
  return {
    id: "session",
    source: "codex",
    sourceSessionId: "session",
    projectName: "sessionary",
    projectPath: "/tmp/sessionary",
    cwd: "/tmp/sessionary",
    startedAt: "2026-05-20T01:00:00.000Z",
    endedAt: "2026-05-20T01:30:00.000Z",
    durationSeconds: 1800,
    userMessageCount: 2,
    assistantMessageCount: 3,
    toolCallCount: 12,
    tokenCount: 24000,
    costAmount: 0.42,
    status: "useful",
    statusUpdatedAt: null,
    note: "",
    confidence: 0.9,
    changedFiles: ["src/App.tsx"],
    promptingSeconds: 300,
    waitingSeconds: 900,
    reviewSeconds: 120,
    repairSeconds: 0,
    reviewStartedAt: null,
    repairStartedAt: null,
    reviewIntervals: [],
    repairIntervals: [],
    timeFields: {
      prompting: "estimated",
      waiting: "estimated",
      review: "estimated",
      repair: "estimated"
    },
    value: { category: "unreviewed", score: 50, reasons: ["needs_review"] },
    summary: "Implemented a useful change",
    sourceFile: "",
    gitBranch: null,
    gitDirty: false,
    delivery: {
      diffSummary: "",
      changedFiles: [],
      fileHints: [],
      gitDirtyFiles: [],
      commitFiles: [],
      commits: [],
      committedAfterSession: false,
      dirtyAfterSession: false,
      absorbed: false,
      testCommands: [],
      confidence: 0,
      integration: {
        pullRequest: null,
        issues: [],
        ci: { status: "not_recorded", source: "none", command: null },
        reviewCommentCount: null,
        attributionConfidence: 0
      }
    },
    ...overrides
  };
}

describe("session value classification", () => {
  it("recognizes low-cost useful output as high value", () => {
    const value = classifySessionValue(session());

    expect(value.category).toBe("high_value");
    expect(value.reasons).toContain("low_cost");
    expect(value.reasons).toContain("has_file_hints");
  });

  it("prioritizes sessions that need human repair", () => {
    const value = classifySessionValue(session({ status: "needs_repair", repairSeconds: 900 }));

    expect(value.category).toBe("needs_human_repair");
    expect(value.reasons).toContain("needs_repair");
  });

  it("keeps discarded sessions at the bottom", () => {
    const value = classifySessionValue(session({ status: "discarded" }));

    expect(value.category).toBe("discarded");
    expect(value.score).toBeLessThan(20);
  });
});
