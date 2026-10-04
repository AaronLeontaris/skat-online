/* End-to-end smoke test: drives full rounds through the real Socket.IO server.
 * Run with tsx while the server is up (no Postgres/Redis needed — in-memory fallback).
 */
import { io, type Socket } from "socket.io-client";
import { nextBidValue } from "@skat/engine";
import type { Card } from "@skat/engine";
import type { Snapshot, TableSettings } from "@skat/shared";

const BASE = process.env.SMOKE_BASE ?? "http://localhost:4000";
const ACCOUNTS = [
  { email: "anna@example.com", password: "anna123" },
  { email: "ben@example.com", password: "ben123" },
  { email: "clara@example.com", password: "clara123" },
  { email: "david@example.com", password: "david123" },
];

function log(...a: unknown[]): void {
  console.log("[smoke]", ...a);
}

async function login(email: string, password: string): Promise<string> {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`login ${email}: ${res.status}`);
  const data = (await res.json()) as { token: string };
  return data.token;
}

function connect(token: string): Socket {
  return io(BASE, { auth: { token }, transports: ["websocket"], reconnection: false, timeout: 6000 });
}

function waitConnect(s: Socket): Promise<void> {
  return new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error("connect timeout")), 8000);
    s.once("connect", () => {
      clearTimeout(t);
      res();
    });
  });
}

function waitSnapshot(
  s: Socket,
  pred: (snap: Snapshot) => boolean,
  label: string,
  ms = 30000,
): Promise<Snapshot> {
  return new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error(`timeout: ${label}`)), ms);
    const h = (snap: Snapshot) => {
      if (pred(snap)) {
        clearTimeout(t);
        s.off("snapshot", h);
        res(snap);
      }
    };
    s.on("snapshot", h);
  });
}

interface Player {
  socket: Socket;
  snapshot: Snapshot | null;
}

function attachAutoplay(p: Player, bidding: "allPass" | "solo"): void {
  p.socket.on("snapshot", (snap: Snapshot) => {
    p.snapshot = snap;
    const round = snap.round;
    if (!round) return;
    const me = snap.self.seatIndex;
    if (round.currentSeat !== me || me === null) return;

    if (round.phase === "bidding") {
      if (bidding === "allPass") {
        p.socket.emit("game:bid", { pass: true });
        return;
      }
      const b = round.bidding!;
      if (b.sayerSeat === me) {
        const next = nextBidValue(b.heldValue ?? 0);
        if (next !== null) p.socket.emit("game:bid", { value: next });
        else p.socket.emit("game:bid", { pass: true });
      } else {
        p.socket.emit("game:bid", { pass: true });
      }
      return;
    }

    if (round.phase === "skat") {
      if (me === round.declarerSeat) {
        const hand = snap.self.hand;
        if (hand.length < 2) return;
        p.socket.emit("game:pickupSkat", { action: "take", discard: [hand[0], hand[1]] as [Card, Card] });
      }
      return;
    }

    if (round.phase === "announce") {
      if (me === round.declarerSeat) {
        p.socket.emit("game:announce", {
          declaration: {
            kind: "grand",
            hand: false,
            ouvert: false,
            schneiderAngesagt: false,
            schwarzAngesagt: false,
          },
        });
      }
      return;
    }

    if (round.phase === "playing") {
      const legal = snap.self.legalPlays;
      if (legal && legal.length > 0) p.socket.emit("game:playCard", { card: legal[0] });
    }
  });
}

async function connectPlayers(count: number): Promise<Player[]> {
  const players: Player[] = [];
  for (let i = 0; i < count; i++) {
    const token = await login(ACCOUNTS[i].email, ACCOUNTS[i].password);
    const socket = connect(token);
    await waitConnect(socket);
    socket.on("error", (e) => log(`error on player ${i}:`, e));
    players.push({ socket, snapshot: null });
  }
  return players;
}

async function runScenario(name: string, count: number, bidding: "allPass" | "solo", settings: TableSettings): Promise<void> {
  log(`=== ${name} ===`);
  const players = await connectPlayers(count);
  const host = players[0];

  host.socket.emit("table:create", { name, settings });
  const hostSnap = await waitSnapshot(host.socket, (s) => s.self.seatIndex === 0 && !!s.table, "host seated");
  const tableId = hostSnap.table.tableId;

  for (let i = 1; i < count; i++) {
    players[i].socket.emit("table:join", { tableId, seatIndex: i });
    await waitSnapshot(players[i].socket, (s) => s.self.seatIndex === i, `seat ${i} joined`);
  }

  for (const p of players) attachAutoplay(p, bidding);
  for (const p of players) p.socket.emit("table:ready", { ready: true });

  await waitSnapshot(
    host.socket,
    (s) => s.table.seats.every((seat) => seat === null || seat.ready),
    "all ready",
  );

  host.socket.emit("table:start");

  const final = await waitSnapshot(
    host.socket,
    (s) => s.round?.phase === "roundEnd" && !!s.round.lastResult,
    `${name} round end`,
    60000,
  );

  log("result:", final.round!.lastResult!.summary);
  log("deltas:", JSON.stringify(final.round!.lastResult!.deltas));
  log("scores:", JSON.stringify(final.round!.scores));
  if (!final.round!.lastResult) throw new Error(`${name}: no result`);

  for (const p of players) {
    p.socket.emit("table:leave");
    p.socket.disconnect();
  }
  log(`=== ${name} OK ===`);
}

async function main(): Promise<void> {
  await runScenario("Ramsch (4 Spieler)", 4, "allPass", {
    kontraRe: true,
    bock: true,
    ramsch: true,
    scoringMode: "seegerFabian",
  });
  await runScenario("Grand Solo (3 Spieler)", 3, "solo", {
    kontraRe: true,
    bock: false,
    ramsch: true,
    scoringMode: "traditional",
  });
  log("ALL SCENARIOS PASSED");
}

main().catch((err) => {
  console.error("[smoke] FAILED:", err);
  process.exit(1);
});
