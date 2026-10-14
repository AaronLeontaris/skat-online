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

/** The current trick centered on the table, plus the most recent completed Stich. */
export function TrickView({ currentTrick, completedTricks, seats }: TrickViewProps): JSX.Element {
  const last = completedTricks.length > 0 ? completedTricks[completedTricks.length - 1] : null;

  return (
    <div className="trick-view">
      <div className="trick-current">
        {currentTrick.length === 0 ? (
          <span className="muted">Keine Karten im aktuellen Stich.</span>
        ) : (
          currentTrick.map((played) => (
            <div key={cardKey(played.card)} className="trick-card">
              <CardView card={played.card} disabled />
              <span className="muted small">{seatLabel(seats, played.seatIndex)}</span>
            </div>
          ))
        )}
      </div>

      {last !== null ? (
        <div className="trick-last">
          <span className="muted small">
            Letzter Stich: <strong>{seatLabel(seats, last.winnerSeat)}</strong> · {completedTricks.length} Stiche
          </span>
          <div className="trick-cards">
            {last.cards.map((played) => (
              <CardView key={cardKey(played.card)} card={played.card} disabled />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
