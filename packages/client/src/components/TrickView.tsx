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
  /** Show every completed trick; otherwise only the last few. */
  showAll?: boolean;
}

const COLLAPSED_TRICKS = 3;

/** Current trick plus a compact list of completed tricks with winner and points. */
export function TrickView({
  currentTrick,
  completedTricks,
  seats,
  showAll = false,
}: TrickViewProps): JSX.Element {
  const visible = showAll ? completedTricks : completedTricks.slice(-COLLAPSED_TRICKS);
  const hidden = completedTricks.length - visible.length;

  return (
    <section className="panel trick-view">
      <h2>Stich</h2>
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

      <h3>Stiche ({completedTricks.length})</h3>
      {hidden > 0 ? <p className="muted small">… {hidden} weitere Stiche</p> : null}
      {completedTricks.length === 0 ? (
        <p className="muted small">Noch keine abgeschlossenen Stiche.</p>
      ) : (
        <ul className="trick-list">
          {visible.map((trick, index) => (
            <li key={`${trick.winnerSeat}-${completedTricks.length - visible.length + index}`}>
              <span className="trick-cards">
                {trick.cards.map((played) => (
                  <CardView key={cardKey(played.card)} card={played.card} disabled />
                ))}
              </span>
              <span className="trick-meta">
                Gewinner: <strong>{seatLabel(seats, trick.winnerSeat)}</strong> · {trick.points} Punkte
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
