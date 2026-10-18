import type { Card, GameDeclaration, Rank, Suit } from "./types";

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

/**
 * Display sort for a declared game. Trumps go to the far right; non-trumps sort
 * by suit (Karo, Herz, Pik, Kreuz) then ascending value. Within trumps, Buben are
 * highest. Values run lowest → highest (7, 8, 9, Dame, König, 10, Ass). Null keeps
 * the natural sort.
 */
export function sortHandForGame(cards: readonly Card[], declaration: GameDeclaration | null): Card[] {
  if (!declaration || declaration.kind === "null") {
    // Natural ascending sort: suit Karo→Kreuz, value 7→A.
    const suitAsc: Record<Suit, number> = { diamonds: 0, hearts: 1, spades: 2, clubs: 3 };
    const nullAsc: Record<Rank, number> = { "7": 0, "8": 1, "9": 2, "10": 3, J: 4, Q: 5, K: 6, A: 7 };
    return [...cards].sort((a, b) => {
      if (suitAsc[a.suit] !== suitAsc[b.suit]) return suitAsc[a.suit] - suitAsc[b.suit];
      return nullAsc[a.rank] - nullAsc[b.rank];
    });
  }

  const trumpSuit: Suit | null = declaration.kind === "suit" ? declaration.suit ?? null : null;
  const isTrumpCard = (c: Card): boolean => c.rank === "J" || (trumpSuit !== null && c.suit === trumpSuit);

  // Suit ascending: Karo, Herz, Pik, Kreuz.
  const suitAsc: Record<Suit, number> = { diamonds: 0, hearts: 1, spades: 2, clubs: 3 };
  // Value ascending (Skat order reversed): 7, 8, 9, Dame, König, 10, Ass; J (Bube) highest.
  const rankAsc: Record<Rank, number> = { "7": 0, "8": 1, "9": 2, Q: 3, K: 4, "10": 5, A: 6, J: 7 };
  // Buben are the highest trumps: ♦J < ♥J < ♠J < ♣J.
  const jackAsc = (s: Suit): number => 100 + (3 - JACK_ORDER.indexOf(s));
  const trumpValue = (c: Card): number => (c.rank === "J" ? jackAsc(c.suit) : rankAsc[c.rank]);

  return [...cards].sort((a, b) => {
    const aTrump = isTrumpCard(a);
    const bTrump = isTrumpCard(b);
    if (aTrump !== bTrump) return aTrump ? 1 : -1; // non-trumps left, trumps right
    if (aTrump && bTrump) return trumpValue(a) - trumpValue(b);
    if (suitAsc[a.suit] !== suitAsc[b.suit]) return suitAsc[a.suit] - suitAsc[b.suit];
    return rankAsc[a.rank] - rankAsc[b.rank];
  });
}
