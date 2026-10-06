/* Reproduces the "start next round" flow: play round 1 to roundEnd, re-ready, start round 2. */
import { io, type Socket } from "socket.io-client";
import type { Snapshot } from "@skat/shared";

const BASE = "http://localhost:4000";
const ACCOUNTS = [
  { email: "anna@example.com", password: "anna123" },
  { email: "ben@example.com", password: "ben123" },
  { email: "clara@example.com", password: "clara123" },
];

function log(...a: unknown[]): void {
  console.log("[test]", ...a);
}

async function login(email: string, password: string): Promise<string> {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`login ${email}: ${res.status}`);
  return ((await res.json()) as { token: string }).token;
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

function waitSnapshot(s: Socket, pred: (snap: Snapshot) => boolean, label: string, ms = 30000): Promise<Snapshot> {
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

function attachAuto(p: { socket: Socket }): void {
  p.socket.on("snapshot", (snap: Snapshot) => {
    const round = snap.round;
    if (!round) return;
    const me = snap.self.seatIndex;
    if (round.currentSeat !== me || me === null) return;
    if (round.phase === "bidding") {
      p.socket.emit("game:bid", { pass: true });
      return;
    }
    if (round.phase === "skat") {
      if (me === round.declarerSeat) p.socket.emit("game:pickupSkat", { action: "hand" });
      return;
    }
    if (round.phase === "announce") {
      if (me === round.declarerSeat) {
        p.socket.emit("game:announce", {
          declaration: { kind: "grand", hand: true, ouvert: false, schneiderAngesagt: false, schwarzAngesagt: false },
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

async function main(): Promise<void> {
  const players: { socket: Socket }[] = [];
  for (const acc of ACCOUNTS) {
    const token = await login(acc.email, acc.password);
    const socket = connect(token);
    await waitConnect(socket);
    socket.on("error", (e) => log("error event:", e));
    players.push({ socket });
  }

  players[0].socket.emit("table:create", { name: "NextRound", settings: { kontraRe: true, bock: false, ramsch: true, scoringMode: "traditional" } });
  const hostSnap = await waitSnapshot(players[0].socket, (s) => s.self.seatIndex === 0 && !!s.table, "host seated");
  const tableId = hostSnap.table.tableId;

  for (let i = 1; i < 3; i++) {
    players[i].socket.emit("table:join", { tableId, seatIndex: i });
    await waitSnapshot(players[i].socket, (s) => s.self.seatIndex === i, `seat ${i} joined`);
  }

  for (const p of players) attachAuto(p);
  for (const p of players) p.socket.emit("table:ready", { ready: true });
  await waitSnapshot(players[0].socket, (s) => s.table.seats.every((seat) => seat === null || seat.ready), "all ready (round 1)");

  players[0].socket.emit("table:start");

  // Play round 1 to roundEnd (all pass → Ramsch).
  const end1 = await waitSnapshot(players[0].socket, (s) => s.round?.phase === "roundEnd", "round 1 end", 60000);
  log("round 1 ended. roundNumber =", end1.round!.roundNumber, "status =", end1.table.status, "scores =", JSON.stringify(end1.round!.scores));

  // Re-ready everyone.
  for (const p of players) p.socket.emit("table:ready", { ready: true });
  await waitSnapshot(players[0].socket, (s) => s.table.seats.every((seat) => seat === null || seat.ready), "all ready (round 2)");
  log("all ready for round 2");

  // Host starts round 2.
  players[0].socket.emit("table:start");

  const start2 = await waitSnapshot(players[0].socket, (s) => s.round?.roundNumber === 2 && s.round.phase === "bidding", "round 2 start", 15000);
  log("round 2 started. phase =", start2.round!.phase, "roundNumber =", start2.round!.roundNumber);
  log("SUCCESS: next round starts");

  for (const p of players) {
    p.socket.emit("table:leave");
    p.socket.disconnect();
  }
}

main().catch((err) => {
  console.error("[test] FAILED:", err);
  process.exit(1);
});
