import type { CSSProperties } from "react";
import type { Card, Rank, Suit } from "@skat/engine";
import { SUIT_LABEL_DE, SUIT_SYMBOL, sortHand } from "@skat/engine";

/** Display labels for the card ranks (Bube/Dame/König/Ass). */
export const RANK_DISPLAY: Record<Rank, string> = {
  "7": "7",
  "8": "8",
  "9": "9",
  "10": "10",
  J: "B",
  Q: "D",
  K: "K",
  A: "A",
};

const RED_SUITS: readonly Suit[] = ["hearts", "diamonds"];

export function isRedSuit(suit: Suit): boolean {
  return RED_SUITS.includes(suit);
}

/** Text forms of a card, e.g. "B♣" (short) and "Bube Kreuz" (long). */
export function cardLabel(card: Card): string {
  return `${RANK_DISPLAY[card.rank]}${SUIT_SYMBOL[card.suit]}`;
}

/** Long German form, e.g. "Bube Kreuz". */
export function cardLabelLong(card: Card): string {
  const rankNames: Partial<Record<Rank, string>> = { J: "Bube", Q: "Dame", K: "König", A: "Ass" };
  return `${rankNames[card.rank] ?? card.rank} ${SUIT_LABEL_DE[card.suit]}`;
}

export function cardKey(card: Card): string {
  return `${card.suit}:${card.rank}`;
}

/** Structural card equality (suit + rank). */
export function sameCard(a: Card, b: Card): boolean {
  return a.suit === b.suit && a.rank === b.rank;
}

/** Stable sort by suit, then by descending rank (Ass first) — matches the engine. */
export function sortCards(cards: readonly Card[]): Card[] {
  return sortHand(cards);
}

export interface CardViewProps {
  card: Card;
  /** Highlight this card as selected (e.g. chosen for the Skat discard). */
  selected?: boolean;
  /** Highlight as a legal/clickable card. */
  playable?: boolean;
  /** Fully disable interaction. */
  disabled?: boolean;
  onClick?: (card: Card) => void;
  title?: string;
  style?: CSSProperties;
}

/** Playing card: corner values (top-left + rotated bottom-right) and a large center value. */
export function CardView({ card, selected, playable, disabled, onClick, title, style }: CardViewProps): JSX.Element {
  const classes = ["card"];
  classes.push(`card-suit-${card.suit}`);
  if (selected) classes.push("card-selected");
  if (playable && !disabled) classes.push("card-playable");
  if (disabled) classes.push("card-disabled");
  const clickable = Boolean(onClick) && !disabled;
  const rank = RANK_DISPLAY[card.rank];
  const suit = SUIT_SYMBOL[card.suit];
  return (
    <button
      type="button"
      className={classes.join(" ")}
      style={style}
      onClick={clickable && onClick ? () => onClick(card) : undefined}
      disabled={!clickable}
      title={title ?? cardLabelLong(card)}
      aria-label={title ?? cardLabelLong(card)}
      aria-pressed={selected ? true : undefined}
    >
      <span className="card-corner card-tl">
        <span>{rank}</span>
        <span>{suit}</span>
      </span>
      <span className="card-center">
        <span className="card-center-rank">{rank}</span>
        <span className="card-center-suit">{suit}</span>
      </span>
      <span className="card-corner card-br">
        <span>{rank}</span>
        <span>{suit}</span>
      </span>
    </button>
  );
}
