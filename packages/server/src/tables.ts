import { randomUUID } from "node:crypto";
import type { SeatIndex } from "@skat/engine";
import type { TableSettings, TableStatus } from "@skat/shared";
import type { RoundState } from "./game";

export interface SeatPlayer {
  userId: string;
  username: string;
  avatarUrl: string | null;
  ready: boolean;
}

export interface NewPlayer {
  userId: string;
  username: string;
  avatarUrl: string | null;
}

export interface TableSession {
  tableId: string;
  name: string;
  hostUserId: string;
  settings: TableSettings;
  seats: (SeatPlayer | null)[];
  status: TableStatus;
  scores: Map<number, number>;
  activeBocks: number;
  round: RoundState | null;
}

export class TableStore {
  private tables = new Map<string, TableSession>();

  create(host: NewPlayer, name: string, settings: TableSettings): TableSession {
    const table: TableSession = {
      tableId: randomUUID(),
      name,
      hostUserId: host.userId,
      settings,
      seats: [null, null, null, null],
      status: "waiting",
      scores: new Map(),
      activeBocks: 0,
      round: null,
    };
    table.seats[0] = {
      userId: host.userId,
      username: host.username,
      avatarUrl: host.avatarUrl,
      ready: false,
    };
    this.tables.set(table.tableId, table);
    return table;
  }

  get(tableId: string): TableSession | undefined {
    return this.tables.get(tableId);
  }

  tableOfUser(userId: string): TableSession | undefined {
    for (const t of this.tables.values()) {
      if (t.seats.some((s) => s?.userId === userId)) return t;
    }
    return undefined;
  }

  seatOf(table: TableSession, userId: string): SeatIndex | null {
    for (let i = 0; i < table.seats.length; i++) {
      if (table.seats[i]?.userId === userId) return i as SeatIndex;
    }
    return null;
  }

  occupiedSeats(table: TableSession): SeatIndex[] {
    const out: SeatIndex[] = [];
    table.seats.forEach((s, i) => {
      if (s) out.push(i as SeatIndex);
    });
    return out;
  }

  join(table: TableSession, seatIndex: number, player: NewPlayer): { ok: boolean; error?: string } {
    if (table.status !== "waiting") return { ok: false, error: "Das Spiel läuft bereits" };
    if (seatIndex < 0 || seatIndex > 3) return { ok: false, error: "Ungültiger Platz" };
    if (table.seats[seatIndex]) return { ok: false, error: "Platz besetzt" };
    const existing = this.seatOf(table, player.userId);
    if (existing !== null) table.seats[existing] = null;
    table.seats[seatIndex] = {
      userId: player.userId,
      username: player.username,
      avatarUrl: player.avatarUrl,
      ready: false,
    };
    return { ok: true };
  }

  leave(table: TableSession, userId: string): void {
    const seat = this.seatOf(table, userId);
    if (seat === null) return;
    table.seats[seat] = null;
    if (table.seats.every((s) => s === null)) {
      this.tables.delete(table.tableId);
      return;
    }
    if (table.hostUserId === userId) {
      const next = table.seats.find((s) => s !== null);
      if (next) table.hostUserId = next.userId;
    }
  }

  setReady(table: TableSession, userId: string, ready: boolean): void {
    const seat = this.seatOf(table, userId);
    if (seat === null) return;
    const player = table.seats[seat];
    if (player) player.ready = ready;
  }

  setSettings(table: TableSession, settings: TableSettings): void {
    table.settings = settings;
  }

  openTables(): TableSession[] {
    return [...this.tables.values()].filter((t) => t.status === "waiting");
  }
}
