import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { TableSettings } from "@skat/shared";
import { fetchTables, type OpenTable } from "../api";
import { useSession } from "../store";
import { Chat } from "./Chat";
import { SettingsForm } from "./SettingsForm";

const SEAT_INDICES = [0, 1, 2, 3] as const;

const DEFAULT_SETTINGS: TableSettings = {
  kontraRe: true,
  bock: true,
  ramsch: true,
  scoringMode: "traditional",
};

function scoringLabel(mode: string | undefined): string {
  return mode === "seegerFabian" ? "Seeger-Fabian" : "Traditionell";
}

function seatSummary(table: OpenTable): string {
  const seated = typeof table.seated === "number" ? table.seated : null;
  const capacity = typeof table.capacity === "number" ? table.capacity : 4;
  return seated === null ? `${capacity} Plätze` : `${seated}/${capacity} Plätze`;
}

export interface LobbyProps {
  token: string;
  onOpenProfile: () => void;
}

/** Table list, table creation, joining, and a chat column. */
export function Lobby({ token, onOpenProfile }: LobbyProps): JSX.Element {
  const { emit, messages, error, snapshot, user } = useSession();
  const [tables, setTables] = useState<OpenTable[]>([]);
  const [loading, setLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [joinTableId, setJoinTableId] = useState<string | null>(null);
  const [joinSeat, setJoinSeat] = useState<number>(0);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [settings, setSettings] = useState<TableSettings>(DEFAULT_SETTINGS);

  const refresh = useCallback(async (): Promise<void> => {
    setLoading(true);
    setListError(null);
    try {
      const list = await fetchTables(token);
      setTables(Array.isArray(list) ? list : []);
    } catch (err) {
      setListError(err instanceof Error ? err.message : "Tische konnten nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 15000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  function createTable(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length === 0) return;
    emit("table:create", { name: trimmed, settings });
    setCreating(false);
    setName("");
  }

  function join(tableId: string, seatIndex: number): void {
    emit("table:join", { tableId, seatIndex });
    setJoinTableId(null);
  }

  return (
    <div className="screen">
      <header className="topbar">
        <h1>Skat Online</h1>
        <div className="topbar-right">
          <span className="muted">{user?.username ?? ""}</span>
          <span className={snapshot ? "badge" : "badge badge-muted"}>Lobby</span>
          <button type="button" onClick={onOpenProfile}>
            Profil
          </button>
        </div>
      </header>

      {error ? (
        <p className="error-text" role="alert">
          {error}
        </p>
      ) : null}

      <div className="lobby-grid">
        <section className="panel">
          <div className="row space-between">
            <h2>Tische</h2>
            <button type="button" onClick={() => void refresh()} disabled={loading}>
              {loading ? "Lädt…" : "Aktualisieren"}
            </button>
          </div>

          {listError ? (
            <p className="error-text" role="alert">
              {listError}
            </p>
          ) : null}

          {tables.length === 0 ? (
            <p className="muted">Keine offenen Tische gefunden.</p>
          ) : (
            <ul className="table-list">
              {tables.map((table) => {
                const full = typeof table.seated === "number" && typeof table.capacity === "number" && table.seated >= table.capacity;
                return (
                  <li key={table.tableId} className="table-list-item">
                    <div>
                      <strong>{table.name}</strong>
                      <div className="muted small">
                        {table.hostUsername ? `Host: ${table.hostUsername} · ` : ""}
                        {seatSummary(table)}
                        {table.status === "playing" ? " · läuft" : ""}
                      </div>
                    </div>
                    {joinTableId === table.tableId ? (
                      <div className="row">
                        <label>
                          Platz
                          <select
                            value={joinSeat}
                            onChange={(e) => setJoinSeat(Number(e.target.value))}
                            aria-label="Platz wählen"
                          >
                            {SEAT_INDICES.map((seat) => (
                              <option key={seat} value={seat}>
                                Platz {seat + 1}
                              </option>
                            ))}
                          </select>
                        </label>
                        <button type="button" className="primary" onClick={() => join(table.tableId, joinSeat)}>
                          Beitreten
                        </button>
                        <button type="button" onClick={() => setJoinTableId(null)}>
                          Abbrechen
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="primary"
                        disabled={full}
                        title={full ? "Tisch ist voll" : undefined}
                        onClick={() => {
                          setJoinTableId(table.tableId);
                          setJoinSeat(0);
                        }}
                      >
                        Tisch beitreten
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="panel">
          <div className="row space-between">
            <h2>Tisch erstellen</h2>
            {creating ? (
              <button type="button" onClick={() => setCreating(false)}>
                Abbrechen
              </button>
            ) : (
              <button type="button" className="primary" onClick={() => setCreating(true)}>
                Tisch erstellen
              </button>
            )}
          </div>
          {creating ? (
            <form onSubmit={createTable} className="stack">
              <label htmlFor="create-name">Name</label>
              <input
                id="create-name"
                type="text"
                value={name}
                maxLength={60}
                required
                onChange={(e) => setName(e.target.value)}
              />
              <SettingsForm idPrefix="create" value={settings} onChange={setSettings} />
              <button type="submit" className="primary">
                Tisch erstellen
              </button>
            </form>
          ) : (
            <p className="muted small">
              Der Tisch wird beim Erstellen festgelegt. Wertung: {scoringLabel(settings.scoringMode)}.
            </p>
          )}
        </section>

        <Chat messages={messages} onSend={(text) => emit("chat:send", { text })} />
      </div>
    </div>
  );
}
