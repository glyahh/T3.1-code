import { expect, it } from "vite-plus/test";
import { planningWaitLabel, formatPreciseWorkingDuration } from "./TimelineWorkGroupRows.logic";

it("changes the planning label at thirty seconds of inactivity", () => {
  expect(planningWaitLabel(0, 29_999)).toBe("Planning next move");
  expect(planningWaitLabel(0, 30_000)).toBe("Taking longer than expected");
  expect(planningWaitLabel(30_000, 30_001)).toBe("Planning next move");
});
it("retains seconds across minute and hour boundaries", () => {
  expect([27_000, 60_000, 307_000, 3_907_000].map(formatPreciseWorkingDuration)).toEqual([
    "27s",
    "1m 00s",
    "5m 07s",
    "1h 05m 07s",
  ]);
});
