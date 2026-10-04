import type { Server, Socket } from "socket.io";
import { clientPayloadSchemas } from "@skat/shared";
import { getUserById, verifyToken } from "./auth";
import { sendChat } from "./chat";
import {
  applyAnnounce,
  applyBid,
  applyKontra,
  applyPickupSkat,
  applyPlay,
  applyRe,
  nextDealer,
  scoreRound,
  startRamsch,
  startRound,
} from "./game";
import { buildSnapshot, buildTablePublic } from "./snapshot";
import { TableStore } from "./tables";
import type { TableSession } from "./tables";

const roomName = (tableId: string) => `table:${tableId}`;

function emitError(socket: Socket, code: string, message: string): void {
  socket.emit("error", { code, message });
}

async function sync(io: Server, table: TableSession): Promise<void> {
  const room = roomName(table.tableId);
  io.to(room).emit("table:updated", buildTablePublic(table));
  try {
    const sockets = await io.in(room).fetchSockets();
    for (const s of sockets) {
      const userId = s.data.userId as string | undefined;
      if (userId) io.to(s.id).emit("snapshot", buildSnapshot(table, userId));
    }
  } catch (err) {
    console.warn("[socket] sync fehlgeschlagen:", (err as Error).message);
  }
}

export function setupSocket(io: Server, store: TableStore): void {
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    const userId = token ? verifyToken(token) : null;
    if (!userId) return next(new Error("unauthorized"));
    socket.data.userId = userId;
    next();
  });

  io.on("connection", (socket) => {
    const userId = socket.data.userId as string;
    socket.join(`user:${userId}`);

    const seated = store.tableOfUser(userId);
    if (seated) {
      socket.join(roomName(seated.tableId));
      socket.emit("snapshot", buildSnapshot(seated, userId));
    }

    socket.on("table:create", (raw: unknown) => {
      const parsed = clientPayloadSchemas["table:create"].safeParse(raw);
      if (!parsed.success) return emitError(socket, "INVALID", "Ungültige Anfrage");
      if (store.tableOfUser(userId)) return emitError(socket, "ALREADY_SEATED", "Du bist bereits an einem Tisch");
      const user = getUserById(userId);
      if (!user) return;
      const table = store.create(
        { userId, username: user.username, avatarUrl: user.avatarUrl },
        parsed.data.name,
        parsed.data.settings,
      );
      socket.join(roomName(table.tableId));
      void sync(io, table);
    });

    socket.on("table:join", (raw: unknown) => {
      const parsed = clientPayloadSchemas["table:join"].safeParse(raw);
      if (!parsed.success) return emitError(socket, "INVALID", "Ungültige Anfrage");
      const table = store.get(parsed.data.tableId);
      if (!table) return emitError(socket, "NOT_FOUND", "Tisch nicht gefunden");
      const user = getUserById(userId);
      if (!user) return;
      const res = store.join(table, parsed.data.seatIndex, {
        userId,
        username: user.username,
        avatarUrl: user.avatarUrl,
      });
      if (!res.ok) return emitError(socket, "ILLEGAL", res.error ?? "Beitreten fehlgeschlagen");
      socket.join(roomName(table.tableId));
      void sync(io, table);
    });

    socket.on("table:leave", () => {
      const table = store.tableOfUser(userId);
      if (!table) return;
      const room = roomName(table.tableId);
      store.leave(table, userId);
      socket.leave(room);
      const still = store.get(table.tableId);
      if (still) void sync(io, still);
    });

    socket.on("table:setSettings", (raw: unknown) => {
      const parsed = clientPayloadSchemas["table:setSettings"].safeParse(raw);
      if (!parsed.success) return emitError(socket, "INVALID", "Ungültige Anfrage");
      const table = store.tableOfUser(userId);
      if (!table) return;
      if (table.hostUserId !== userId) return emitError(socket, "FORBIDDEN", "Nur der Host darf die Regeln ändern");
      if (table.status !== "waiting") {
        return emitError(socket, "ILLEGAL", "Regeln können nur vor Spielbeginn geändert werden");
      }
      store.setSettings(table, parsed.data.settings);
      void sync(io, table);
    });

    socket.on("table:ready", (raw: unknown) => {
      const parsed = clientPayloadSchemas["table:ready"].safeParse(raw);
      if (!parsed.success) return emitError(socket, "INVALID", "Ungültige Anfrage");
      const table = store.tableOfUser(userId);
      if (!table) return;
      store.setReady(table, userId, parsed.data.ready);
      void sync(io, table);
    });

    socket.on("table:start", () => {
      const table = store.tableOfUser(userId);
      if (!table) return;
      if (table.hostUserId !== userId) return emitError(socket, "FORBIDDEN", "Nur der Host darf starten");
      if (table.status !== "waiting") return emitError(socket, "ILLEGAL", "Das Spiel läuft bereits");
      const occupied = table.seats.filter((s) => s !== null).length;
      if (occupied < 3 || occupied > 4) {
        return emitError(socket, "ILLEGAL", "Es werden 3–4 Spieler benötigt");
      }
      if (!table.seats.every((s) => s === null || s.ready)) {
        return emitError(socket, "ILLEGAL", "Nicht alle Spieler sind bereit");
      }
      const prevDealer = table.round?.dealerSeat ?? null;
      const dealer = nextDealer(table, prevDealer);
      startRound(table, (table.round?.roundNumber ?? 0) + 1, dealer);
      void sync(io, table);
    });

    socket.on("game:bid", (raw: unknown) => {
      const table = store.tableOfUser(userId);
      if (!table?.round) return;
      const seat = store.seatOf(table, userId);
      if (seat === null) return;
      const parsed = clientPayloadSchemas["game:bid"].safeParse(raw);
      if (!parsed.success) return emitError(socket, "INVALID", "Ungültiger Reizwert");
      const res = applyBid(table.round, seat, parsed.data);
      if (!res.ok) return emitError(socket, "ILLEGAL", res.error);
      if (res.allPassed) {
        if (table.settings.ramsch) startRamsch(table.round);
        else startRound(table, table.round.roundNumber, table.round.dealerSeat);
      }
      void sync(io, table);
    });

    socket.on("game:pickupSkat", (raw: unknown) => {
      const table = store.tableOfUser(userId);
      if (!table?.round) return;
      const seat = store.seatOf(table, userId);
      if (seat === null) return;
      const parsed = clientPayloadSchemas["game:pickupSkat"].safeParse(raw);
      if (!parsed.success) return emitError(socket, "INVALID", "Ungültige Anfrage");
      const res = applyPickupSkat(table.round, seat, parsed.data);
      if (!res.ok) return emitError(socket, "ILLEGAL", res.error);
      void sync(io, table);
    });

    socket.on("game:announce", (raw: unknown) => {
      const table = store.tableOfUser(userId);
      if (!table?.round) return;
      const seat = store.seatOf(table, userId);
      if (seat === null) return;
      const parsed = clientPayloadSchemas["game:announce"].safeParse(raw);
      if (!parsed.success) return emitError(socket, "INVALID", "Ungültige Ansage");
      const res = applyAnnounce(table.round, seat, parsed.data.declaration);
      if (!res.ok) return emitError(socket, "ILLEGAL", res.error);
      void sync(io, table);
    });

    socket.on("game:playCard", (raw: unknown) => {
      const table = store.tableOfUser(userId);
      if (!table?.round) return;
      const seat = store.seatOf(table, userId);
      if (seat === null) return;
      const parsed = clientPayloadSchemas["game:playCard"].safeParse(raw);
      if (!parsed.success) return emitError(socket, "INVALID", "Ungültige Karte");
      const res = applyPlay(table.round, seat, parsed.data.card);
      if (!res.ok) return emitError(socket, "ILLEGAL", res.error);
      if (table.round.phase === "scoring") scoreRound(table, table.round);
      void sync(io, table);
    });

    socket.on("game:kontra", () => {
      const table = store.tableOfUser(userId);
      if (!table?.round) return;
      if (!table.settings.kontraRe) return emitError(socket, "ILLEGAL", "Kontra/Re ist deaktiviert");
      const seat = store.seatOf(table, userId);
      if (seat === null) return;
      const res = applyKontra(table.round, seat);
      if (!res.ok) return emitError(socket, "ILLEGAL", res.error);
      void sync(io, table);
    });

    socket.on("game:re", () => {
      const table = store.tableOfUser(userId);
      if (!table?.round) return;
      if (!table.settings.kontraRe) return emitError(socket, "ILLEGAL", "Kontra/Re ist deaktiviert");
      const seat = store.seatOf(table, userId);
      if (seat === null) return;
      const res = applyRe(table.round, seat);
      if (!res.ok) return emitError(socket, "ILLEGAL", res.error);
      void sync(io, table);
    });

    socket.on("chat:send", (raw: unknown) => {
      const table = store.tableOfUser(userId);
      if (!table) return;
      const parsed = clientPayloadSchemas["chat:send"].safeParse(raw);
      if (!parsed.success) return emitError(socket, "INVALID", "Ungültige Nachricht");
      const user = getUserById(userId);
      void sendChat(table.tableId, userId, user?.username ?? "?", parsed.data.text).then((msg) => {
        io.to(roomName(table.tableId)).emit("chat:message", msg);
      });
    });
  });
}
