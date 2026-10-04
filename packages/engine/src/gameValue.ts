import type { Card, GameDeclaration, Suit } from "./types";
import { JACK_ORDER } from "./cards";

export const SUIT_BASE: Record<Suit, number> = {
  diamonds: 9,
  hearts: 10,
  spades: 11,
  clubs: 12,
};
export const GRAND_BASE = 24;

export interface Matadors {
  readonly mit: boolean;
  readonly count: number;
}

/**
 * Count consecutive top jacks "mit" (with) or "ohne" (without) from the Clubs Jack.
 * Only meaningful for suit/Grand games; for Null callers should ignore the result.
 */
export function computeMatadors(hand: readonly Card[], kind: "suit" | "grand"): Matadors {
  void kind;
  const has = (suit: Suit) => hand.some((c) => c.rank === "J" && c.suit === suit);

  if (has("clubs")) {
    let count = 0;
    for (const suit of JACK_ORDER) {
      if (has(suit)) count++;
      else break;
    }
    return { mit: true, count };
  }

  let count = 0;
  for (const suit of JACK_ORDER) {
    if (!has(suit)) count++;
    else break;
  }
  return { mit: false, count };
}

export function computeNullValue(d: GameDeclaration): number {
  if (d.hand && d.ouvert) return 59;
  if (d.ouvert) return 46;
  if (d.hand) return 35;
  return 23;
}

export interface GameValueInput {
  declaration: GameDeclaration;
  matadorCount: number;
  /** Opponents took ≤ 30 points (declarer side ≥ 90). */
  schneider: boolean;
  /** Opponents took zero tricks. */
  schwarz: boolean;
}

/**
 * Compute the base game value (before Kontra/Re and Bock).
 *
 * multiplier = 1 (Spiel) + matadors + Hand + Schneider + Schwarz
 *            + Schneider angesagt + Schwarz angesagt + Ouvert
 * Announcing Schwarz implies announcing Schneider; announcing Ouvert implies both.
 * Verified against: Grand mit 1 = 48, Grand Hand mit 1 Schneider = 96,
 * Grand Ouvert mit 4 = 264.
 */
export function computeGameValue(input: GameValueInput): number {
  const d = input.declaration;
  if (d.kind === "null") return computeNullValue(d);

  const base = d.kind === "grand" ? GRAND_BASE : SUIT_BASE[d.suit!];
  const schneiderAngesagt = d.schneiderAngesagt || d.schwarzAngesagt || d.ouvert;
  const schwarzAngesagt = d.schwarzAngesagt || d.ouvert;

  let mult = 1;
  mult += input.matadorCount;
  if (d.hand) mult += 1;
  if (input.schneider) mult += 1;
  if (input.schwarz) mult += 1;
  if (schneiderAngesagt) mult += 1;
  if (schwarzAngesagt) mult += 1;
  if (d.ouvert) mult += 1;
  return base * mult;
}

/** Result of playing out a solo game, needed to decide win/loss and value. */
export interface PlayResult {
  declaration: GameDeclaration;
  /** Card points won by the declarer side (suit/Grand). Irrelevant for Null. */
  declarerPoints: number;
  /** Number of tricks won by the declarer. */
  declarerTricks: number;
}

export function opponentPoints(r: PlayResult): number {
  return 120 - r.declarerPoints;
}

export function opponentTricks(r: PlayResult): number {
  return 10 - r.declarerTricks;
}

export function isSchneider(r: PlayResult): boolean {
  return opponentPoints(r) <= 30;
}

export function isSchwarz(r: PlayResult): boolean {
  return opponentTricks(r) === 0;
}

export function hasWonSolo(r: PlayResult): boolean {
  const d = r.declaration;
  if (d.kind === "null") return r.declarerTricks === 0;

  if (r.declarerPoints < 61) return false;
  if ((d.schneiderAngesagt || d.schwarzAngesagt || d.ouvert) && r.declarerPoints < 90) {
    return false;
  }
  if ((d.schwarzAngesagt || d.ouvert) && opponentTricks(r) > 0) {
    return false;
  }
  return true;
}

/** Base value for a played-out solo game (suit/Grand/Null), before Kontra/Re/Bock. */
export function computeSoloValue(r: PlayResult, matadorCount: number): number {
  return computeGameValue({
    declaration: r.declaration,
    matadorCount,
    schneider: isSchneider(r),
    schwarz: isSchwarz(r),
  });
}
