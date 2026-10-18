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
 * Count consecutive top jacks "mit" (with) or "ohne" (without), starting from the
 * Clubs Jack. House rule: Spitzen are counted on the four Buben only (max 4),
 * regardless of game type (suit or Grand).
 */
export function computeMatadors(hand: readonly Card[], _kind: "suit" | "grand", _suit?: Suit): Matadors {
  const sequence: Card[] = JACK_ORDER.map((s) => ({ suit: s, rank: "J" }));
  const has = (card: Card) => hand.some((c) => c.suit === card.suit && c.rank === card.rank);

  if (has({ suit: "clubs", rank: "J" })) {
    let count = 0;
    for (const card of sequence) {
      if (has(card)) count++;
      else break;
    }
    return { mit: true, count };
  }

  let count = 0;
  for (const card of sequence) {
    if (!has(card)) count++;
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
  // Schneider applies to either side: opponents ≤ 30 OR declarer ≤ 30.
  return opponentPoints(r) <= 30 || r.declarerPoints <= 30;
}

export function isSchwarz(r: PlayResult): boolean {
  // Schwarz applies to either side: opponents won no tricks OR declarer won no tricks.
  return opponentTricks(r) === 0 || r.declarerTricks === 0;
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
