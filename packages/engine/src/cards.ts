import type { Card, Rank, Suit } from "./types";

export const SUITS: readonly Suit[] = ["clubs", "spades", "hearts", "diamonds"];
export const RANKS: readonly Rank[] = ["7", "8", "9", "10", "J", "Q", "K", "A"];

export const SUIT_SYMBOL: Record<Suit, string> = {
  clubs: "♣",
  spades: "♠",
  hearts: "♥",
  diamonds: "♦",
};

export const SUIT_LABEL_DE: Record<Suit, string> = {
  clubs: "Kreuz",
  spades: "Pik",
  hearts: "Herz",
  diamonds: "Karo",
};

export const RANK_LABEL: Record<Rank, string> = {
  "7": "7",
  "8": "8",
  "9": "9",
  "10": "10",
  J: "Bube",
  Q: "Dame",
  K: "König",
  A: "Ass",
};

/** Card point value (Augen). */
export const CARD_POINTS: Record<Rank, number> = {
  "7": 0,
  "8": 0,
  "9": 0,
  "10": 10,
  J: 2,
  Q: 3,
  K: 4,
  A: 11,
};

/** Jack trump order, strongest first. */
export const JACK_ORDER: readonly Suit[] = ["clubs", "spades", "hearts", "diamonds"];

/** Non-trump order in suit/Grand games (no jack: jacks are trumps). Strongest first. */
export const SUIT_GAME_ORDER: readonly Rank[] = ["A", "10", "K", "Q", "9", "8", "7"];

/** Natural order used in Null games (jack ranks between Queen and Ten). Strongest first. */
export const NULL_ORDER: readonly Rank[] = ["A", "K", "Q", "J", "10", "9", "8", "7"];

export function fullDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ suit, rank });
    }
  }
  return deck;
}

export function cardPoints(card: Card): number {
  return CARD_POINTS[card.rank];
}

export function trickPoints(cards: readonly Card[]): number {
  return cards.reduce((sum, c) => sum + CARD_POINTS[c.rank], 0);
}

export function cardKey(card: Card): string {
  return `${card.suit}${card.rank}`;
}

export function sameCard(a: Card, b: Card): boolean {
  return a.suit === b.suit && a.rank === b.rank;
}

/** Stable display sort: by suit then rank descending (A first). */
export function sortHand(cards: readonly Card[]): Card[] {
  const suitOrder = (s: Suit) => SUITS.indexOf(s);
  const rankOrder = (r: Rank) => SUIT_GAME_ORDER.indexOf(r);
  return [...cards].sort((a, b) => {
    if (suitOrder(a.suit) !== suitOrder(b.suit)) return suitOrder(a.suit) - suitOrder(b.suit);
    return rankOrder(b.rank) - rankOrder(a.rank);
  });
}
