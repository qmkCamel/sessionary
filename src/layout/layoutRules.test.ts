import { describe, expect, test } from "vitest";
import { inspectorPresentationFor, shouldShowPersistentInspector, type LayoutView } from "./layoutRules";

describe("layout rules", () => {
  test("today never reserves a persistent detail column", () => {
    expect(shouldShowPersistentInspector("today", 1440, true)).toBe(false);
    expect(inspectorPresentationFor("today", 1440, true)).toBe("overlay");
  });

  test("inbox uses persistent master-detail only on expanded desktop", () => {
    expect(shouldShowPersistentInspector("inbox", 1440, true)).toBe(true);
    expect(shouldShowPersistentInspector("inbox", 1180, true)).toBe(false);
    expect(inspectorPresentationFor("inbox", 1180, true)).toBe("drawer");
  });

  test("timeline and report do not reserve inspector width when there is no context", () => {
    const views: LayoutView[] = ["timeline", "report"];

    for (const view of views) {
      expect(shouldShowPersistentInspector(view, 1440, false)).toBe(false);
      expect(inspectorPresentationFor(view, 1440, false)).toBe("hidden");
    }
  });
});
