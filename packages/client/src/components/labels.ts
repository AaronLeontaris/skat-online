import { SUIT_SYMBOL, type Card } from "@skat/engine";
import { RANK_DISPLAY } from "./CardView";

const PHASE_LABELS: Record<string, string> = {
  waiting: "Warten",
  bidding: "Bieten",
  skat: "Skat",
  announce: "Ansagen",
  playing: "Spiel",
  scoring: "Wertung",
  roundEnd: "Rundenende",
};

/** German name of a server phase. */
export function phaseLabel(phase: string): string {
  return PHASE_LABELS[phase] ?? phase;
}

/** Compact readable card list for summaries, e.g. "B♣ 10♥". */
export function cardList(cards: readonly Card[]): string {
  return cards.map((c) => `${RANK_DISPLAY[c.rank]}${SUIT_SYMBOL[c.suit]}`).join(" ");
}
