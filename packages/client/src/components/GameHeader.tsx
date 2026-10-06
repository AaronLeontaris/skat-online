import type { Snapshot } from "@skat/shared";
import { useSession } from "../store";
import { declarationLabel, seatLabel, sidePoints } from "./gameHelpers";
import { phaseLabel } from "./labels";

export interface GameHeaderProps {
  snapshot: Snapshot;
  connected: boolean;
  onOpenProfile: () => void;
  onLeave: () => void;
}

/** Sticky full-width header: primary row (table/connection/user/actions) + game stats row. */
export function GameHeader({ snapshot, connected, onOpenProfile, onLeave }: GameHeaderProps): JSX.Element {
  const { user } = useSession();
  const { table, round, self } = snapshot;
  const seats = table.seats;
  const myTurn = self.seatIndex !== null && round !== null && round.currentSeat === self.seatIndex;
  const points = round
    ? sidePoints(round, round.declarerSeat)
    : { declarer: null as number | null, defenders: null as number | null };

  return (
    <header className="game-header">
      <div className="topbar">
        <h1>{table.name}</h1>
        <div className="topbar-right">
          <span className={connected ? "badge" : "badge badge-muted"}>
            {connected ? "verbunden" : "offline"}
          </span>
          <span className="muted">{user?.username ?? ""}</span>
          <button type="button" onClick={onOpenProfile}>
            Profil
          </button>
          <button type="button" onClick={onLeave}>
            Verlassen
          </button>
        </div>
      </div>

      {round ? (
        <div className="stats-bar">
          <dl className="status-grid">
            <div>
              <dt>Runde</dt>
              <dd>
                {round.roundNumber} · {phaseLabel(round.phase)}
              </dd>
            </div>
            <div>
              <dt>Geber</dt>
              <dd>{seatLabel(seats, round.dealerSeat)}</dd>
            </div>
            <div>
              <dt>Alleinspieler</dt>
              <dd>{round.declarerSeat === null ? "–" : seatLabel(seats, round.declarerSeat)}</dd>
            </div>
            <div>
              <dt>Ansage</dt>
              <dd>{declarationLabel(round.declaration)}</dd>
            </div>
            <div>
              <dt>Reizwert</dt>
              <dd>{round.bidValue ?? "–"}</dd>
            </div>
            <div>
              <dt>Am Zug</dt>
              <dd>
                {round.currentSeat === null ? "–" : seatLabel(seats, round.currentSeat)}
                {myTurn ? " (Du)" : ""}
              </dd>
            </div>
            {round.bockActive ? (
              <div>
                <dt>Bock</dt>
                <dd>aktiv</dd>
              </div>
            ) : null}
            {round.kontra || round.re ? (
              <div>
                <dt>Kontra/Re</dt>
                <dd>
                  {round.kontra ? "Kontra" : ""}
                  {round.re ? " · Re" : ""}
                </dd>
              </div>
            ) : null}
            <div>
              <dt>Augen</dt>
              <dd>{points.declarer === null ? "–" : `${points.declarer} : ${points.defenders ?? 0}`}</dd>
            </div>
          </dl>
          {round.bidding ? (
            <p className="muted small">
              Bieten: {seatLabel(seats, round.bidding.sayerSeat)} sagt gegen{" "}
              {seatLabel(seats, round.bidding.listenerSeat)} · gehalten: {round.bidding.heldValue ?? "–"}
              {round.bidding.pendingRaise !== null ? ` · Gebot: ${round.bidding.pendingRaise}` : ""}
            </p>
          ) : null}
          {round.lastResult ? (
            <p className="result-line">
              {round.lastResult.won === true ? "Gewonnen" : round.lastResult.won === false ? "Verloren" : "Ramsch"}:{" "}
              {round.lastResult.summary} (Spielwert {round.lastResult.gameValue})
            </p>
          ) : null}
          {!connected ? <p className="error-text">Verbindung unterbrochen – Neuverbindung läuft…</p> : null}
        </div>
      ) : null}
    </header>
  );
}
