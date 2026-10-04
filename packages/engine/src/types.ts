export type Suit = "clubs" | "spades" | "hearts" | "diamonds";
export type Rank = "7" | "8" | "9" | "10" | "J" | "Q" | "K" | "A";

export interface Card {
  readonly suit: Suit;
  readonly rank: Rank;
}

/** Absolute table seat index (0–3). */
export type SeatIndex = 0 | 1 | 2 | 3;

export type GameKind = "suit" | "grand" | "null";

/**
 * The declarer's announcement.
 * - suit games require `suit`.
 * - `hand` means the Skat was not picked up.
 * - `ouvert`, `schneiderAngesagt`, `schwarzAngesagt` are only legal in hand games
 *   (server enforces this; the engine just computes with whatever it is given).
 */
export interface GameDeclaration {
  readonly kind: GameKind;
  readonly suit?: Suit;
  readonly hand: boolean;
  readonly ouvert: boolean;
  readonly schneiderAngesagt: boolean;
  readonly schwarzAngesagt: boolean;
}

/** Trump model for trick resolution. */
export type TrumpMode =
  | { readonly kind: "none" }
  | { readonly kind: "jacks" }
  | { readonly kind: "suit"; readonly suit: Suit };

export type ScoringMode = "traditional" | "seegerFabian";
