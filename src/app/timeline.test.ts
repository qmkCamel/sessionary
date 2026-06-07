import { describe, expect, test } from "vitest";
import type { DayLedger } from "../shared/types";
import { dayBounds, dayWindowFor, positionFor, visibleIntervalFor } from "./timeline";

describe("timeline day slicing", () => {
  test("clips multi-day sessions to the selected local day", () => {
    const dayWindow = dayWindowFor("2026-06-07");
    const visible = visibleIntervalFor(
      "2026-05-17T04:44:13.632Z",
      "2026-06-07T07:45:22.902Z",
      dayWindow
    );

    expect(visible?.startedAt).toBe("2026-06-06T16:00:00.000Z");
    expect(visible?.seconds).toBeGreaterThan(15 * 60 * 60);
    expect(visible?.seconds).toBeLessThan(16 * 60 * 60);
  });

  test("timeline bounds are based on visible day slices", () => {
    const ledger = {
      metrics: { date: "2026-06-07" },
      sessions: [
        {
          startedAt: "2026-05-17T04:44:13.632Z",
          endedAt: "2026-06-07T07:45:22.902Z"
        }
      ]
    } as unknown as DayLedger;

    const bounds = dayBounds(ledger, 60);
    const dayWindow = dayWindowFor("2026-06-07");
    const position = positionFor(
      "2026-05-17T04:44:13.632Z",
      "2026-06-07T07:45:22.902Z",
      bounds
    );

    expect(bounds[0]).toBe(dayWindow[0]);
    expect(bounds[1]).toBeLessThanOrEqual(dayWindow[1]);
    expect(bounds[1] - bounds[0]).toBeLessThan(24 * 60 * 60 * 1000);
    expect(position.left).toBe("0%");
    expect(Number.parseFloat(position.width)).toBeLessThanOrEqual(100);
  });
});
