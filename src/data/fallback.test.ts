import { describe, expect, it } from "vitest";
import {
  fallbackFinishRepair,
  fallbackLedger,
  fallbackReport,
  fallbackScan,
  fallbackSettings,
  fallbackStartRepair,
  fallbackSyncIntegrations,
  fallbackUpdate,
  fallbackWeeklyReport,
  saveFallbackSettings
} from "./fallback";

describe("fallback data", () => {
  it("provides a usable day ledger for local web/dev fallback", () => {
    const ledger = fallbackLedger("2026-05-20");

    expect(ledger.metrics.date).toBe("2026-05-20");
    expect(ledger.metrics.sessionCount).toBe(ledger.sessions.length);
    expect(ledger.metrics.toolCallCount).toBeGreaterThan(0);
    expect(ledger.metrics.parallelProjectRatio).toBeGreaterThan(0);
    expect(ledger.metrics.absorbedSessionCount).toBe(ledger.deliveryReview.absorbedSessions);
    expect(ledger.deliveryReview.sessionsWithPr).toBeGreaterThan(0);
    expect(ledger.operatingReview.playbook.length).toBeGreaterThan(0);
    expect(ledger.parallelReview.insights.map((insight) => insight.kind)).toContain("review_bottleneck");
    expect(ledger.deliveryReview.insights.map((insight) => insight.kind)).toContain("unabsorbed_output");
    expect(ledger.sessions[0].value.reasons.length).toBeGreaterThan(0);
    expect(ledger.projects.length).toBeGreaterThan(0);
    expect(ledger.sourceStatus.map((source) => source.source)).toEqual(["codex", "claude"]);
  });

  it("applies session patches and preserves the updated session", () => {
    const original = fallbackLedger().sessions[0];
    const updated = fallbackUpdate(original.id, {
      note: "Reviewed locally",
      status: "useful",
      promptingSeconds: 900
    });

    expect(updated.note).toBe("Reviewed locally");
    expect(updated.status).toBe("useful");
    expect(updated.promptingSeconds).toBe(900);
    expect(updated.timeFields.prompting).toBe("manual");
    expect(fallbackLedger().sessions[0]).toMatchObject({
      id: original.id,
      note: "Reviewed locally",
      status: "useful"
    });
  });

  it("round-trips settings and report fixtures", () => {
    const settings = fallbackSettings();
    const saved = saveFallbackSettings({
      ...settings,
      onboardingCompleted: false,
      language: "zh-CN",
      projectRoots: ["/Users/alex/work/sessionary"]
    });

    expect(saved.projectRoots).toEqual(["/Users/alex/work/sessionary"]);
    expect(fallbackSettings().language).toBe("zh-CN");
    expect(fallbackSettings().onboardingCompleted).toBe(false);
    expect(fallbackSettings().integrationSettings.github.enabled).toBe(false);
    expect(fallbackScan().sessionsFound).toBeGreaterThan(0);
    expect(fallbackReport("2026-05-20").markdown).toContain("# Daily Report - 2026-05-20");
    expect(fallbackReport("2026-05-20").markdown).toContain("## Parallel Review");
    expect(fallbackReport("2026-05-20").markdown).toContain("## Delivery Review");
    expect(fallbackReport("2026-05-20").markdown).toContain("## AI Dev Operating Review");
    expect(fallbackReport("2026-05-20", "zh-CN").markdown).toContain("# 每日报告 - 2026-05-20");
    expect(fallbackWeeklyReport("2026-05-20").markdown).toContain("## Most Valuable Sessions");
    expect(fallbackWeeklyReport("2026-05-20").markdown).toContain("## Parallel Review");
    expect(fallbackWeeklyReport("2026-05-20").markdown).toContain("## Delivery Review");
    expect(fallbackWeeklyReport("2026-05-20").markdown).toContain("## AI Dev Operating Review");
  });

  it("simulates integration sync without network", () => {
    const saved = saveFallbackSettings({
      ...fallbackSettings(),
      integrationSettings: {
        github: { enabled: true, token: "ghp_demo" },
        linear: { enabled: true, token: "lin_demo" }
      }
    });

    expect(saved.integrationSettings.github.enabled).toBe(true);
    const result = fallbackSyncIntegrations();
    expect(result.github.linked).toBeGreaterThan(0);
    expect(result.linear.linked).toBeGreaterThan(0);
    expect(fallbackLedger().sessions.some((session) =>
      session.delivery.integration.issues.some((issue) => issue.status === "confirmed")
    )).toBe(true);
  });

  it("supports fallback repair timer flow", () => {
    const original = fallbackLedger().sessions[1];
    const started = fallbackStartRepair(original.id);
    const finished = fallbackFinishRepair(original.id);

    expect(started.status).toBe("needs_repair");
    expect(started.repairStartedAt).toBeTruthy();
    expect(finished.status).toBe("repaired");
    expect(finished.repairStartedAt).toBeNull();
    expect(finished.timeFields.repair).toBe("manual");
  });
});
