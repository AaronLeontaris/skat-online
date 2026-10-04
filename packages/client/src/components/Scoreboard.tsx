import type { PublicPlayer, ScoreRow } from "@skat/shared";
import { Avatar } from "./Avatar";

export interface ScoreboardProps {
  scores: readonly ScoreRow[];
  seats: readonly (PublicPlayer | null)[];
  /** Highlight this seat (usually the viewer). */
  selfSeat?: number | null;
}

/** Cumulative per-seat scores. */
export function Scoreboard({ scores, seats, selfSeat }: ScoreboardProps): JSX.Element {
  const rows = [...scores].sort((a, b) => a.seatIndex - b.seatIndex);
  return (
    <section className="panel scoreboard">
      <h2>Punkte</h2>
      {rows.length === 0 ? (
        <p className="muted small">Noch keine Punkte.</p>
      ) : (
        <table className="score-table">
          <thead>
            <tr>
              <th scope="col">Spieler</th>
              <th scope="col">Punkte</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const player = seats[row.seatIndex] ?? null;
              return (
                <tr key={row.seatIndex} className={selfSeat === row.seatIndex ? "self-row" : undefined}>
                  <td>
                    <span className="score-player">
                      {player ? <Avatar username={player.username} avatarUrl={player.avatarUrl} /> : null}
                      {player ? player.username : `Platz ${row.seatIndex + 1}`}
                    </span>
                  </td>
                  <td className="score-value">{row.total}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}
