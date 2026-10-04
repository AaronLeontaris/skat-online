import { describe, expect, it } from "vitest";
import type { Card } from "./types";
import { isTrump, legalPlays, trickWinnerIndex, trumpModeFor } from "./tricks";
import type { GameDeclaration } from "./types";

const card = (suit: Card["suit"], rank: Card["rank"]): Card => ({ suit, rank });

function mode(decl: GameDeclaration) {
  return trumpModeFor(decl);
}

const grand = mode({ kind: "grand", hand: false, ouvert: false, schneiderAngesagt: false, schwarzAngesagt: false });
const clubsGame = mode({ kind: "suit", suit: "clubs", hand: false, ouvert: false, schneiderAngesagt: false, schwarzAngesagt: false });
const nullGame = mode({ kind: "null", hand: false, ouvert: false, schneiderAngesagt: false, schwarzAngesagt: false });

describe("isTrump", () => {
  it("Grand: only jacks", () => {
    expect(isTrump(card("clubs", "J"), grand)).toBe(true);
    expect(isTrump(card("hearts", "A"), grand)).toBe(false);
  });

  it("suit game: jacks + trump suit", () => {
    expect(isTrump(card("hearts", "J"), clubsGame)).toBe(true);
    expect(isTrump(card("clubs", "7"), clubsGame)).toBe(true);
    expect(isTrump(card("spades", "A"), clubsGame)).toBe(false);
  });

  it("Null: nothing is trump", () => {
    expect(isTrump(card("clubs", "J"), nullGame)).toBe(false);
  });
});

describe("trickWinnerIndex", () => {
  it("trump beats non-trump", () => {
    const cards = [card("hearts", "A"), card("clubs", "J"), card("hearts", "7")];
    expect(trickWinnerIndex(cards, grand, "hearts")).toBe(1);
  });

  it("jack order: clubs > spades > hearts > diamonds", () => {
    const cards = [card("diamonds", "J"), card("spades", "J"), card("hearts", "J")];
    expect(trickWinnerIndex(cards, grand, "diamonds")).toBe(1);
  });

  it("suit order: A > 10 > K", () => {
    const cards = [card("hearts", "K"), card("hearts", "A"), card("hearts", "10")];
    expect(trickWinnerIndex(cards, grand, "hearts")).toBe(1);
  });

  it("off-suit non-trump cannot win", () => {
    const cards = [card("hearts", "9"), card("spades", "A"), card("hearts", "K")];
    expect(trickWinnerIndex(cards, grand, "hearts")).toBe(2);
  });

  it("Null: natural order (J above 10)", () => {
    const cards = [card("hearts", "10"), card("hearts", "J"), card("hearts", "K")];
    expect(trickWinnerIndex(cards, nullGame, "hearts")).toBe(2);
  });
});

describe("legalPlays", () => {
  it("must follow suit when possible", () => {
    const hand = [card("hearts", "7"), card("spades", "A")];
    expect(legalPlays(hand, grand, card("hearts", "10"))).toEqual([card("hearts", "7")]);
  });

  it("may discard anything when void in the led suit", () => {
    const hand = [card("spades", "A"), card("diamonds", "8")];
    expect(legalPlays(hand, grand, card("hearts", "10"))).toEqual(hand);
  });

  it("must play trump when trump is led", () => {
    const hand = [card("hearts", "A"), card("spades", "J")];
    expect(legalPlays(hand, grand, card("clubs", "J"))).toEqual([card("spades", "J")]);
  });

  it("a jack of the led suit does not count as following (Grand)", () => {
    const hand = [card("hearts", "J"), card("spades", "7")];
    // Lead is a non-trump heart; hearts-J is trump, so it does not force a follow.
    expect(legalPlays(hand, grand, card("hearts", "10"))).toEqual(hand);
  });

  it("leading allows any card", () => {
    const hand = [card("hearts", "7"), card("spades", "A")];
    expect(legalPlays(hand, grand, null)).toEqual(hand);
  });
});
