import { describe, expect, it } from "vitest";
import { ramschDeltas, scoreSolo } from "./scoring";

describe("scoreSolo — traditional", () => {
  it("win: declarer +value, defenders 0", () => {
    expect(scoreSolo({ value: 48, won: true, scoringMode: "traditional" })).toEqual({
      declarerDelta: 48,
      defenderDelta: 0,
    });
  });

  it("loss: declarer −2×value, defenders 0", () => {
    expect(scoreSolo({ value: 48, won: false, scoringMode: "traditional" })).toEqual({
      declarerDelta: -96,
      defenderDelta: 0,
    });
  });
});

describe("scoreSolo — Seeger-Fabian", () => {
  it("win: declarer +value+50", () => {
    expect(scoreSolo({ value: 48, won: true, scoringMode: "seegerFabian" })).toEqual({
      declarerDelta: 98,
      defenderDelta: 0,
    });
  });

  it("loss: declarer −2×value−50, defenders +40", () => {
    expect(scoreSolo({ value: 48, won: false, scoringMode: "seegerFabian" })).toEqual({
      declarerDelta: -146,
      defenderDelta: 40,
    });
  });
});

describe("scoreSolo — Bock", () => {
  it("doubles the whole delta", () => {
    expect(
      scoreSolo({ value: 48, won: false, scoringMode: "traditional", bockMultiplier: 2 }),
    ).toEqual({ declarerDelta: -192, defenderDelta: 0 });
    expect(
      scoreSolo({ value: 48, won: false, scoringMode: "seegerFabian", bockMultiplier: 2 }),
    ).toEqual({ declarerDelta: -292, defenderDelta: 80 });
  });
});

describe("ramschDeltas", () => {
  it("traditional: most points loses −20", () => {
    expect(ramschDeltas([10, 50, 60], "traditional")).toEqual([0, 0, -20]);
  });

  it("seeger-fabian: fewest points wins +50", () => {
    expect(ramschDeltas([10, 50, 60], "seegerFabian")).toEqual([50, 0, 0]);
  });

  it("applies bock multiplier", () => {
    expect(ramschDeltas([10, 50, 60], "traditional", 2)).toEqual([0, 0, -40]);
  });
});
