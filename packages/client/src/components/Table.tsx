import { useEffect, useState } from "react";
import type { PublicPlayer, Snapshot, TableSettings } from "@skat/shared";
import { useSession } from "../store";
import { Avatar } from "./Avatar";
import { Chat } from "./Chat";
import { GameHeader } from "./GameHeader";
import { GameView } from "./GameView";
import { Scoreboard } from "./Scoreboard";
import { SettingsForm } from "./SettingsForm";

const SEAT_INDICES = [0, 1, 2, 3] as const;
const ACTIVE_PHASES: readonly string[] = ["bidding", "skat", "announce", "playing", "scoring"];

export interface TableProps {
  snapshot: Snapshot;
  onOpenProfile: () => void;
}

function seatedCount(seats: readonly (PublicPlayer | null)[]): number {
  return seats.filter((seat): seat is PublicPlayer => seat !== null).length;
}

/** Seats, settings, ready/start controls and the running game area. */
export function Table({ snapshot, onOpenProfile }: TableProps): JSX.Element {
  const { emit, user, connected, messages, clearTable } = useSession();
  const { table, round, self } = snapshot;
  const host = table.hostUserId === user?.id;
  const seats = table.seats;
  const seated = seatedCount(seats);
  const everyoneReady = seats
    .filter((seat): seat is PublicPlayer => seat !== null)
    .every((seat) => seat.ready);
  const canStart = host && seated >= 3 && everyoneReady && table.status !== "playing";
  const startHint = !host
    ? "nur der Host startet"
    : seated < 3
      ? "mindestens 3 Spieler nötig"
      : !everyoneReady
        ? "nicht alle bereit"
        : table.status === "playing"
          ? "läuft bereits"
          : "";
  const me = self.seatIndex !== null ? seats[self.seatIndex] ?? null : null;
  const [settingsDraft, setSettingsDraft] = useState<TableSettings>(table.settings);
  const [openSeats, setOpenSeats] = useState(false);
  const [openSettings, setOpenSettings] = useState(false);
  const [openScores, setOpenScores] = useState(false);
  const editable = host && table.status !== "playing";
  const active = round !== null && ACTIVE_PHASES.includes(round.phase);
  const isDeclarer = self.seatIndex !== null && round?.declarerSeat === self.seatIndex;
  const tricksPlayed = round?.completedTricks.length ?? 0;
  const canKontra =
    round !== null &&
    round.phase === "playing" &&
    table.settings.kontraRe &&
    !round.kontra &&
    !isDeclarer &&
    self.seatIndex !== null &&
    tricksPlayed === 0;
  const canRe =
    round !== null &&
    round.phase === "playing" &&
    table.settings.kontraRe &&
    round.kontra &&
    !round.re &&
    isDeclarer &&
    tricksPlayed === 0;

  useEffect(() => {
    setSettingsDraft(table.settings);
  }, [table.settings]);

  function applySettings(next: TableSettings): void {
    setSettingsDraft(next);
    emit("table:setSettings", { settings: next });
  }

  const seatsContent = (
    <>
      <div className="seat-grid">
        {SEAT_INDICES.map((seatIndex) => {
          const player = seats[seatIndex] ?? null;
          const isSelf = self.seatIndex === seatIndex;
          return (
            <div key={seatIndex} className={`seat${isSelf ? " seat-self" : ""}${player ? "" : " seat-empty"}`}>
              <span className="seat-number">Platz {seatIndex + 1}</span>
              {player ? (
                <>
                  <Avatar username={player.username} avatarUrl={player.avatarUrl} size="small" />
                  <span className="seat-name">
                    {player.username}
                    {table.hostUserId === player.userId ? " (Host)" : ""}
                    {isSelf ? " (Du)" : ""}
                  </span>
                  <span className={player.ready ? "badge badge-ok" : "badge badge-muted"}>
                    {player.ready ? "Bereit" : "Nicht bereit"}
                  </span>
                </>
              ) : (
                <>
                  <div className="avatar avatar-small avatar-empty" aria-hidden="true">
                    –
                  </div>
                  <span className="seat-name muted">Frei</span>
                </>
              )}
            </div>
          );
        })}
      </div>

      <div className="row wrap">
        {self.seatIndex === null ? (
          <span className="muted small">Du sitzt nicht an diesem Tisch.</span>
        ) : (
          <button
            type="button"
            className={me?.ready ? undefined : "primary"}
            disabled={!connected}
            onClick={() => emit("table:ready", { ready: !(me?.ready ?? false) })}
          >
            {me?.ready ? "Nicht bereit" : "Bereit"}
          </button>
        )}
        <button
          type="button"
          className="primary"
          disabled={!connected}
          title={!canStart ? startHint : undefined}
          onClick={() => emit("table:start", {})}
        >
          Spiel starten
        </button>
        <span className="muted small">
          {seated}/4 Plätzen belegt{startHint ? ` · ${startHint}` : ""}
        </span>
      </div>
    </>
  );

  const settingsContent = (
    <>
      <SettingsForm
        idPrefix="table"
        value={settingsDraft}
        onChange={applySettings}
        disabled={!editable || !connected}
      />
      {!editable ? <p className="muted small">Nur der Host kann vor Rundenbeginn ändern.</p> : null}
    </>
  );

  return (
    <div className={active ? "screen screen-game" : "screen"}>
      <GameHeader
        snapshot={snapshot}
        connected={connected}
        onOpenProfile={onOpenProfile}
        onLeave={() => {
          emit("table:leave", {});
          clearTable();
        }}
      />

      {active ? (
        <>
          <div className="game-toolbar">
            <span className="round-label">Runde {round.roundNumber}</span>
            <button
              type="button"
              className={openSeats ? "toolbar-btn active" : "toolbar-btn"}
              onClick={() => setOpenSeats((v) => !v)}
            >
              👥 Plätze
            </button>
            <button
              type="button"
              className={openSettings ? "toolbar-btn active" : "toolbar-btn"}
              onClick={() => setOpenSettings((v) => !v)}
            >
              ⚙️ Einstellungen
            </button>
            <button
              type="button"
              className={openScores ? "toolbar-btn active" : "toolbar-btn"}
              onClick={() => setOpenScores((v) => !v)}
            >
              🏆 Punkte
            </button>
            {canKontra ? (
              <button type="button" className="toolbar-btn danger" onClick={() => emit("game:kontra", {})}>
                Kontra
              </button>
            ) : null}
            {canRe ? (
              <button type="button" className="toolbar-btn danger" onClick={() => emit("game:re", {})}>
                Re
              </button>
            ) : null}
          </div>

          {openSeats ? <div className="panel toolbar-panel">{seatsContent}</div> : null}
          {openSettings ? <div className="panel toolbar-panel">{settingsContent}</div> : null}
          {openScores ? (
            <div className="panel toolbar-panel">
              <Scoreboard scores={round.scores} seats={seats} selfSeat={self.seatIndex} />
            </div>
          ) : null}

          <GameView snapshot={snapshot} round={round} connected={connected} emit={emit} />

          <div className="chat-footer">
            <Chat messages={messages} onSend={(text) => emit("chat:send", { text })} disabled={!connected} collapsible />
          </div>
        </>
      ) : (
        <div className="table-grid">
          <section className="panel seats-panel">
            <h2>Plätze</h2>
            {seatsContent}
          </section>
          <section className="panel">
            <h2>Einstellungen</h2>
            {settingsContent}
          </section>
          {round ? (
            <section className="panel">
              <h2>Rundenergebnis</h2>
              {round.lastResult ? (
                <p className="result-line">
                  {round.lastResult.won === true ? "Gewonnen" : round.lastResult.won === false ? "Verloren" : "Ramsch"}:{" "}
                  {round.lastResult.summary} (Spielwert {round.lastResult.gameValue})
                </p>
              ) : null}
              <Scoreboard scores={round.scores} seats={seats} selfSeat={self.seatIndex} />
            </section>
          ) : (
            <section className="panel">
              <h2>Warteraum</h2>
              <p className="muted">Noch keine Runde gestartet.</p>
              <p className="muted small">
                {seated < 3
                  ? "Mindestens 3 Spieler nötig."
                  : everyoneReady
                    ? "Alle bereit – der Host kann starten."
                    : "Warte auf Bereitschaft aller Spieler."}
              </p>
            </section>
          )}
          <Chat messages={messages} onSend={(text) => emit("chat:send", { text })} disabled={!connected} />
        </div>
      )}
    </div>
  );
}
