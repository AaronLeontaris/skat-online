import type { Card, GameDeclaration, Suit, TrumpMode } from "./types";
import { JACK_ORDER, NULL_ORDER, SUIT_GAME_ORDER } from "./cards";

export function trumpModeFor(declaration: GameDeclaration): TrumpMode {
  switch (declaration.kind) {
    case "null":
      return { kind: "none" };
    case "grand":
      return { kind: "jacks" };
    case "suit":
      return { kind: "suit", suit: declaration.suit! };
  }
}

export function isTrump(card: Card, mode: TrumpMode): boolean {
  switch (mode.kind) {
    case "none":
      return false;
    case "jacks":
      return card.rank === "J";
    case "suit":
      return card.rank === "J" || card.suit === mode.suit;
  }
}

const JACK_BASE = 200;
const SUIT_TRUMP_BASE = 100;

function trumpStrength(card: Card, mode: TrumpMode): number {
  if (card.rank === "J") {
    return JACK_BASE + (JACK_ORDER.length - JACK_ORDER.indexOf(card.suit));
  }
  // Only reachable in suit mode (jack-only mode has no suit trumps).
  void mode;
  return SUIT_TRUMP_BASE - SUIT_GAME_ORDER.indexOf(card.rank);
}

function nonTrumpStrength(card: Card, mode: TrumpMode): number {
  const order = mode.kind === "none" ? NULL_ORDER : SUIT_GAME_ORDER;
  return order.length - order.indexOf(card.rank);
}

/**
 * Strength of a card in the current trick. Higher wins. Returns -1 for an
 * off-suit non-trump card that can never take the trick.
 */
export function cardStrength(card: Card, mode: TrumpMode, leadSuit: Suit): number {
  if (isTrump(card, mode)) return trumpStrength(card, mode);
  if (card.suit === leadSuit) return nonTrumpStrength(card, mode);
  return -1;
}

/** Index (0-based, in play order) of the card that takes the trick; -1 for an empty trick. */
export function trickWinnerIndex(cards: readonly Card[], mode: TrumpMode, leadSuit: Suit): number {
  if (cards.length === 0) return -1;
  let best = 0;
  let bestStrength = cardStrength(cards[0], mode, leadSuit);
  for (let i = 1; i < cards.length; i++) {
    const s = cardStrength(cards[i], mode, leadSuit);
    if (s > bestStrength) {
      bestStrength = s;
      best = i;
    }
  }
  return best;
}

/**
 * Cards the player is allowed to play given the current trick lead.
 * `lead === null` means the player leads the trick (any card is legal).
 */
export function legalPlays(hand: readonly Card[], mode: TrumpMode, lead: Card | null): Card[] {
  if (lead === null) return [...hand];
  if (isTrump(lead, mode)) {
    const trumps = hand.filter((c) => isTrump(c, mode));
    return trumps.length > 0 ? trumps : [...hand];
  }
  const followers = hand.filter((c) => !isTrump(c, mode) && c.suit === lead.suit);
  return followers.length > 0 ? followers : [...hand];
}

export function isValidPlay(
  hand: readonly Card[],
  mode: TrumpMode,
  lead: Card | null,
  card: Card,
): boolean {
  return legalPlays(hand, mode, lead).some((c) => c.suit === card.suit && c.rank === card.rank);
}
