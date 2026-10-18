import { useEffect, useRef, useState } from "react";
import type { CompletedTrick, PlayedCard, PublicPlayer } from "@skat/shared";
import { CardView, cardKey } from "./CardView";

function seatLabel(seats: readonly (PublicPlayer | null)[], seatIndex: number): string {
  const player = seats[seatIndex];
  return player ? player.username : `Platz ${seatIndex + 1}`;
}

export interface TrickViewProps {
  currentTrick: readonly PlayedCard[];
  completedTricks: readonly CompletedTrick[];
  seats: readonly (PublicPlayer | null)[];
}

/** The current trick centered on the table; a completed trick lingers for 2s. */
export function TrickView({ currentTrick, completedTricks, seats }: TrickViewProps): JSX.Element {
  const last = completedTricks.length > 0 ? completedTricks[completedTricks.length - 1] : null;
  const [showLast, setShowLast] = useState(false);
  const [lingering, setLingering] = useState<readonly PlayedCard[] | null>(null);
  const prevCount = useRef(completedTricks.length);

  useEffect(() => {
    if (completedTricks.length > prevCount.current) {
      const just = completedTricks[completedTricks.length - 1];
      setLingering(just.cards);
      const timer = window.setTimeout(() => setLingering(null), 2000);
      prevCount.current = completedTricks.length;
      return () => window.clearTimeout(timer);
    }
    prevCount.current = completedTricks.length;
  }, [completedTricks]);

  // A new card in the current trick overrides the lingering display.
  const centerCards = currentTrick.length > 0 ? currentTrick : lingering ?? [];

  return (
    <div className="trick-view">
      <div className="trick-current">
        {centerCards.map((played) => (
          <div key={cardKey(played.card)} className="trick-card">
            <CardView card={played.card} disabled />
            <span className="muted small">{seatLabel(seats, played.seatIndex)}</span>
          </div>
        ))}
      </div>

      {last !== null ? (
        <div className="trick-last">
          <button
            type="button"
            className="trick-last-toggle"
            onClick={() => setShowLast((v) => !v)}
            aria-label={showLast ? "Letzten Stich verdecken" : "Letzten Stich aufdecken"}
            title={showLast ? "Letzten Stich verdecken" : "Letzten Stich aufdecken"}
          >
            {showLast ? (
              <div className="trick-cards">
                {last.cards.map((played) => (
                  <CardView key={cardKey(played.card)} card={played.card} disabled />
                ))}
              </div>
            ) : (
              <div className="trick-cards">
                {last.cards.map((played, i) => (
                  <span key={i} className="card-back" aria-hidden="true" />
                ))}
              </div>
            )}
          </button>
        </div>
      ) : null}
    </div>
  );
}
