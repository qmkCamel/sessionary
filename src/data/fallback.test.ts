import { describe, expect, it } from "vitest";
import { fallbackLedger, fallbackReport, fallbackScan, fallbackSettings, fallbackUpdate, saveFallbackSettings } from "./fallback";

describe("fallback data", () => {
  it("provides a usable day ledger for local web/dev fallback", () => {
    const ledger = fallbackLedger("2026-05-20");

    expect(ledger.metrics.date).toBe("2026-05-20");
    expect(ledger.metrics.sessionCount).toBe(ledger.sessions.length);
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
      projectRoots: ["/Users/edge/side/sessionary"]
    });

    expect(saved.projectRoots).toEqual(["/Users/edge/side/sessionary"]);
    expect(fallbackSettings().language).toBe("zh-CN");
    expect(fallbackSettings().onboardingCompleted).toBe(false);
    expect(fallbackScan().sessionsFound).toBeGreaterThan(0);
    expect(fallbackReport("2026-05-20").markdown).toContain("# Daily Report - 2026-05-20");
    expect(fallbackReport("2026-05-20", "zh-CN").markdown).toContain("# 每日报告 - 2026-05-20");
  });
});
