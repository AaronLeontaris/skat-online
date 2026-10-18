import { describe, expect, it } from "vitest";
import { BID_LADDER, isNextBidValue, nextBidValue } from "./bidding";

describe("BID_LADDER", () => {
  it("includes the official value 81 (Karo mit 8)", () => {
    expect(BID_LADDER).toContain(81);
  });

  it("is strictly increasing", () => {
    for (let i = 1; i < BID_LADDER.length; i++) {
      expect(BID_LADDER[i]).toBeGreaterThan(BID_LADDER[i - 1]);
    }
  });

  it("nextBidValue advances past 80 to 81", () => {
    expect(nextBidValue(80)).toBe(81);
    expect(isNextBidValue(80, 81)).toBe(true);
  });
});
