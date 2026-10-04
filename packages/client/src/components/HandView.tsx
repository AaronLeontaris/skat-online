import type { Card } from "@skat/engine";
import { CardView, cardKey, sortCards } from "./CardView";

export interface HandViewProps {
  /** Own cards; empty for spectators and seated-out players. */
  hand: readonly Card[];
  /** Legal plays if it is this player's turn, else null. */
  legalPlays: readonly Card[] | null;
  onPlay: (card: Card) => void;
  /** Player name shown in the heading. */
  ownerName: string;
}

/** The player's own hand. Cards are clickable only when legally playable. */
export function HandView({ hand, legalPlays, onPlay, ownerName }: HandViewProps): JSX.Element {
  const sorted = sortCards(hand);
  const playableKeys = new Set((legalPlays ?? []).map(cardKey));

  if (sorted.length === 0) {
    return (
      <section className="panel hand-view">
        <h2>Deine Karten</h2>
        <p className="muted">Keine Karten (du setzt aus oder schaust zu).</p>
      </section>
    );
  }

  return (
    <section className="panel hand-view">
      <h2>Deine Karten</h2>
      <p className="muted small">
        {ownerName}
        {legalPlays ? " · Du bist dran" : ""}
      </p>
      <div className="hand">
        {sorted.map((card) => {
          const playable = playableKeys.has(cardKey(card));
          return (
            <CardView
              key={cardKey(card)}
              card={card}
              playable={playable}
              disabled={!playable}
              onClick={playable ? onPlay : undefined}
            />
          );
        })}
      </div>
    </section>
  );
}
