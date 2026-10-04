import { describe, expect, it } from "vitest";
import type { Card, GameDeclaration } from "./types";
import {
  computeGameValue,
  computeMatadors,
  computeNullValue,
  computeSoloValue,
  hasWonSolo,
} from "./gameValue";

const j = (suit: Card["suit"]): Card => ({ suit, rank: "J" });

function decl(partial: Partial<GameDeclaration> & { kind: GameDeclaration["kind"] }): GameDeclaration {
  return {
    hand: false,
    ouvert: false,
    schneiderAngesagt: false,
    schwarzAngesagt: false,
    ...partial,
  };
}

describe("computeMatadors", () => {
  it("counts 'mit' consecutive jacks from clubs", () => {
    expect(computeMatadors([j("clubs"), j("spades"), j("hearts"), j("diamonds")], "grand")).toEqual({
      mit: true,
      count: 4,
    });
    expect(computeMatadors([j("clubs"), j("spades")], "grand")).toEqual({ mit: true, count: 2 });
  });

  it("counts 'ohne' when the clubs jack is missing", () => {
    expect(computeMatadors([j("spades"), j("hearts")], "grand")).toEqual({ mit: false, count: 1 });
    expect(computeMatadors([], "grand")).toEqual({ mit: false, count: 4 });
  });

  it("counts trump-suit cards after the jacks in suit games", () => {
    const heartsSix: Card[] = [
      j("clubs"),
      j("spades"),
      j("hearts"),
      j("diamonds"),
      { suit: "hearts", rank: "A" },
      { suit: "hearts", rank: "10" },
    ];
    expect(computeMatadors(heartsSix, "suit", "hearts")).toEqual({ mit: true, count: 6 });
    // All four jacks but no trump Ace → "mit 4".
    expect(computeMatadors([j("clubs"), j("spades"), j("hearts"), j("diamonds")], "suit", "hearts")).toEqual({
      mit: true,
      count: 4,
    });
    // Missing ♣J, ♠J, ♥J but holding ♦J → "ohne 3".
    expect(computeMatadors([j("diamonds")], "suit", "hearts")).toEqual({ mit: false, count: 3 });
  });
});

describe("computeGameValue", () => {
  it("Grand mit 1 = 48", () => {
    expect(
      computeGameValue({ declaration: decl({ kind: "grand" }), matadorCount: 1, schneider: false, schwarz: false }),
    ).toBe(48);
  });

  it("Grand Hand mit 1 = 72", () => {
    expect(
      computeGameValue({
        declaration: decl({ kind: "grand", hand: true }),
        matadorCount: 1,
        schneider: false,
        schwarz: false,
      }),
    ).toBe(72);
  });

  it("Grand Hand mit 1 Schneider = 96", () => {
    expect(
      computeGameValue({
        declaration: decl({ kind: "grand", hand: true }),
        matadorCount: 1,
        schneider: true,
        schwarz: false,
      }),
    ).toBe(96);
  });

  it("Grand Ouvert mit 4 = 264", () => {
    expect(
      computeGameValue({
        declaration: decl({ kind: "grand", hand: true, ouvert: true }),
        matadorCount: 4,
        schneider: true,
        schwarz: true,
      }),
    ).toBe(264);
  });

  it("suit base values", () => {
    for (const [suit, base] of [
      ["diamonds", 9],
      ["hearts", 10],
      ["spades", 11],
      ["clubs", 12],
    ] as const) {
      expect(
        computeGameValue({
          declaration: decl({ kind: "suit", suit }),
          matadorCount: 0,
          schneider: false,
          schwarz: false,
        }),
      ).toBe(base);
    }
  });

  it("announced Schwarz implies announced Schneider", () => {
    // Grand Hand Schwarz angesagt mit 1 = 168 (Stufe 6 + 1 Spitze).
    expect(
      computeGameValue({
        declaration: decl({ kind: "grand", hand: true, schwarzAngesagt: true }),
        matadorCount: 1,
        schneider: true,
        schwarz: true,
      }),
    ).toBe(168);
  });
});

describe("computeNullValue", () => {
  it("returns the fixed Null values", () => {
    expect(computeNullValue(decl({ kind: "null" }))).toBe(23);
    expect(computeNullValue(decl({ kind: "null", hand: true }))).toBe(35);
    expect(computeNullValue(decl({ kind: "null", ouvert: true }))).toBe(46);
    expect(computeNullValue(decl({ kind: "null", hand: true, ouvert: true }))).toBe(59);
  });
});

describe("hasWonSolo", () => {
  it("suit/Grand: 61 points win, 60 lose", () => {
    expect(hasWonSolo({ declaration: decl({ kind: "grand" }), declarerPoints: 61, declarerTricks: 6 })).toBe(true);
    expect(hasWonSolo({ declaration: decl({ kind: "grand" }), declarerPoints: 60, declarerTricks: 6 })).toBe(false);
  });

  it("Schneider angesagt requires ≥ 90 points", () => {
    const d = decl({ kind: "grand", hand: true, schneiderAngesagt: true });
    expect(hasWonSolo({ declaration: d, declarerPoints: 90, declarerTricks: 8 })).toBe(true);
    expect(hasWonSolo({ declaration: d, declarerPoints: 89, declarerTricks: 8 })).toBe(false);
  });

  it("Schwarz angesagt requires all tricks", () => {
    const d = decl({ kind: "grand", hand: true, schwarzAngesagt: true });
    expect(hasWonSolo({ declaration: d, declarerPoints: 120, declarerTricks: 10 })).toBe(true);
    expect(hasWonSolo({ declaration: d, declarerPoints: 120, declarerTricks: 9 })).toBe(false);
  });

  it("Null: zero tricks win", () => {
    expect(hasWonSolo({ declaration: decl({ kind: "null" }), declarerPoints: 0, declarerTricks: 0 })).toBe(true);
    expect(hasWonSolo({ declaration: decl({ kind: "null" }), declarerPoints: 0, declarerTricks: 1 })).toBe(false);
  });
});

describe("computeSoloValue", () => {
  it("derives schneider/schwarz from the play result", () => {
    // Grand Hand mit 1, opponents took 29 points (schneider) and 0 tricks (schwarz).
    const r = { declaration: decl({ kind: "grand", hand: true }), declarerPoints: 91, declarerTricks: 10 };
    // 1 + 1 (matador) + 1 (hand) + 1 (schneider) + 1 (schwarz) = 5 → 120.
    expect(computeSoloValue(r, 1)).toBe(120);
  });
});
