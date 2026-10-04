import type { Card } from "./types";
import { fullDeck } from "./cards";

/** Random source returning a float in [0, 1). Server injects CSPRNG; tests inject a seeded RNG. */
export type Rng = () => number;

export interface Deal {
  readonly hands: readonly [Card[], Card[], Card[]];
  readonly skat: Card[];
}

/** Fisher–Yates shuffle + deal: 10/10/10 with a 2-card Skat (3 active players). */
export function deal(rng: Rng): Deal {
  const deck = fullDeck();
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = deck[i];
    deck[i] = deck[j];
    deck[j] = tmp;
  }
  return {
    hands: [deck.slice(0, 10), deck.slice(10, 20), deck.slice(20, 30)],
    skat: deck.slice(30, 32),
  };
}
