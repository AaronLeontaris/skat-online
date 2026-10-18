import type { Card, GameDeclaration } from "@skat/engine";
import { sortHandForGame } from "@skat/engine";
import { CardView, cardKey } from "./CardView";

export interface HandViewProps {
  /** Own cards; empty for spectators and seated-out players. */
  hand: readonly Card[];
  /** Legal plays if it is this player's turn, else null. */
  legalPlays: readonly Card[] | null;
  onPlay: (card: Card) => void;
  /** Current declaration (used to sort trumps to the right). */
  declaration?: GameDeclaration | null;
}

/** The player's own hand. Cards are clickable only when legally playable. */
export function HandView({ hand, legalPlays, onPlay, declaration = null }: HandViewProps): JSX.Element | null {
  const sorted = sortHandForGame(hand, declaration);
  const playableKeys = new Set((legalPlays ?? []).map(cardKey));

  if (sorted.length === 0) return null;

  return (
    <section className="panel hand-view">
      <div className="hand">
        {sorted.map((card, index) => {
          const playable = playableKeys.has(cardKey(card));
          return (
            <span key={cardKey(card)} className="hand-deal" style={{ animationDelay: `${index * 45}ms` }}>
              <CardView
                card={card}
                playable={playable}
                disabled={!playable}
                onClick={playable ? onPlay : undefined}
              />
            </span>
          );
        })}
      </div>
    </section>
  );
}
