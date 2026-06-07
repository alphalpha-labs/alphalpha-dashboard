import { describe, expect, it } from "vitest";
import {
  addDaysToIso,
  almanacEditionNumber,
  almanacIsoForOffset,
  almanacTodayIso,
} from "./almanac-date";

describe("Almanac date helpers", () => {
  it("uses America/Chicago for the Almanac day boundary", () => {
    expect(almanacTodayIso(new Date("2026-06-07T00:18:54.488Z"))).toBe("2026-06-06");
    expect(almanacTodayIso(new Date("2026-06-07T05:01:00.000Z"))).toBe("2026-06-07");
  });

  it("computes offsets from the Almanac-local day", () => {
    const now = new Date("2026-06-07T00:18:54.488Z");

    expect(almanacIsoForOffset(0, now)).toBe("2026-06-06");
    expect(almanacIsoForOffset(1, now)).toBe("2026-06-07");
    expect(addDaysToIso("2026-06-06", -1)).toBe("2026-06-05");
  });

  it("keeps edition numbers stable from the Almanac epoch", () => {
    expect(almanacEditionNumber("2025-10-31")).toBe("No. 1");
    expect(almanacEditionNumber("2026-06-07")).toBe("No. 220");
  });
});
