import { useEffect, useState } from "react";
import type { PublicPlayer, Snapshot, TableSettings } from "@skat/shared";
import { useSession } from "../store";
import { Avatar } from "./Avatar";
import { Chat } from "./Chat";
import { GameView } from "./GameView";
import { SettingsForm } from "./SettingsForm";
import { phaseLabel } from "./labels";

const SEAT_INDICES = [0, 1, 2, 3] as const;

export interface TableProps {
  snapshot: Snapshot;
  onOpenProfile: () => void;
}

function seatedCount(seats: readonly (PublicPlayer | null)[]): number {
  return seats.filter((seat): seat is PublicPlayer => seat !== null).length;
}

/** Seats, settings, ready/start controls and the running game area. */
export function Table({ snapshot, onOpenProfile }: TableProps): JSX.Element {
  const { emit, user, connected, messages } = useSession();
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
  const editable = host && table.status !== "playing" && (round === null || round.phase === "waiting");

  useEffect(() => {
    setSettingsDraft(table.settings);
  }, [table.settings]);

  function applySettings(next: TableSettings): void {
    setSettingsDraft(next);
    emit("table:setSettings", { settings: next });
  }

  return (
    <div className="screen">
      <header className="topbar">
        <h1>{table.name}</h1>
        <div className="topbar-right">
          <span className={connected ? "badge" : "badge badge-muted"}>
            {connected ? "verbunden" : "offline"}
          </span>
          <span className="muted">{user?.username ?? ""}</span>
          <button type="button" onClick={onOpenProfile}>
            Profil
          </button>
          <button type="button" onClick={() => emit("table:leave", {})}>
            Verlassen
          </button>
        </div>
      </header>

      <div className="table-grid">
        <section className="panel seats-panel">
          <h2>Plätze</h2>
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
              disabled={!connected || !canStart}
              title={!canStart ? startHint : undefined}
              onClick={() => emit("table:start", {})}
            >
              Spiel starten
            </button>
            <span className="muted small">
              {seated}/4 Plätzen belegt{startHint ? ` · ${startHint}` : ""}
            </span>
          </div>
        </section>

        <section className="panel">
          <h2>Einstellungen</h2>
          <SettingsForm
            idPrefix="table"
            value={settingsDraft}
            onChange={applySettings}
            disabled={!editable || !connected}
          />
          {!editable ? <p className="muted small">Nur der Host kann vor Rundenbeginn ändern.</p> : null}
        </section>

        {round && round.phase !== "waiting" ? (
          <GameView snapshot={snapshot} round={round} connected={connected} emit={emit} />
        ) : (
          <section className="panel">
            <h2>Warteraum</h2>
            <p className="muted">
              {round ? `Phase: ${phaseLabel(round.phase)}` : "Noch keine Runde gestartet."}
            </p>
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
    </div>
  );
}
