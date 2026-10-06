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

/** The current trick, plus only the most recently completed Stich. */
export function TrickView({ currentTrick, completedTricks, seats }: TrickViewProps): JSX.Element {
  const last = completedTricks.length > 0 ? completedTricks[completedTricks.length - 1] : null;

  return (
    <section className="panel trick-view">
      <h2>Stich {completedTricks.length + 1}</h2>

      <div className="row trick-row">
        {currentTrick.length === 0 ? (
          <p className="muted">Noch keine Karte gespielt.</p>
        ) : (
          currentTrick.map((played) => (
            <div key={cardKey(played.card)} className="trick-card">
              <CardView card={played.card} disabled />
              <span className="muted small">{seatLabel(seats, played.seatIndex)}</span>
            </div>
          ))
        )}
      </div>

      <h3>Letzter Stich</h3>
      {last === null ? (
        <p className="muted small">Noch kein Stich abgeschlossen.</p>
      ) : (
        <div className="trick-row">
          <span className="trick-cards">
            {last.cards.map((played) => (
              <CardView key={cardKey(played.card)} card={played.card} disabled />
            ))}
          </span>
          <span className="trick-meta">
            Gewinner: <strong>{seatLabel(seats, last.winnerSeat)}</strong> · {completedTricks.length} Stiche gespielt
          </span>
        </div>
      )}
    </section>
  );
}
