/* Verifies the all-pass → Ramsch flow: two passes give the third player a bid-or-pass choice. */
import { io, type Socket } from "socket.io-client";
import type { Snapshot } from "@skat/shared";

const BASE = "http://localhost:4000";
const ACCOUNTS = [
  { email: "frieda@example.com", password: "frieda123" },
  { email: "gabriel@example.com", password: "gabriel123" },
  { email: "aaron@example.com", password: "aaron123" },
];

async function login(email: string, password: string): Promise<string> {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return ((await res.json()) as { token: string }).token;
}

const latest: (Snapshot | null)[] = [null, null, null];
const sockets: Socket[] = [];

async function waitFor(cond: () => boolean, label: string, ms = 8000): Promise<void> {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > ms) throw new Error(`Timeout bei: ${label}`);
    await new Promise((r) => setTimeout(r, 100));
  }
  console.log("[bidding-test] OK:", label);
}

async function main(): Promise<void> {
  for (const acc of ACCOUNTS) {
    const token = await login(acc.email, acc.password);
    const socket = io(BASE, { auth: { token } });
    const idx = sockets.length;
    sockets.push(socket);
    socket.on("snapshot", (snap: Snapshot) => {
      latest[idx] = snap;
    });
  }
  await waitFor(() => sockets.every((s) => s.connected), "alle verbunden");

  sockets[0].emit("table:create", {
    name: "BietTest",
    settings: { kontraRe: true, bock: true, ramsch: true, scoringMode: "traditional" },
  });
  await waitFor(() => latest[0]?.self.seatIndex === 0, "Tisch erstellt");
  const tableId = latest[0]!.table.tableId;

  sockets[1].emit("table:join", { tableId, seatIndex: 1 });
  sockets[2].emit("table:join", { tableId, seatIndex: 2 });
  await waitFor(() => latest[1]?.self.seatIndex === 1 && latest[2]?.self.seatIndex === 2, "beigetreten");

  sockets[0].emit("table:ready", { ready: true });
  sockets[1].emit("table:ready", { ready: true });
  sockets[2].emit("table:ready", { ready: true });
  await waitFor(
    () => latest[0]?.table.seats.every((s) => s === null || s.ready) === true,
    "alle bereit",
  );

  sockets[0].emit("table:start", {});
  await waitFor(() => latest[0]?.round?.phase === "bidding", "Runde gestartet");

  const b0 = latest[0]!.round!.bidding!;
  const sayer0 = b0.sayerSeat;
  const listener0 = b0.listenerSeat!;
  console.log("[bidding-test] Start: sayer = Platz", sayer0 + 1, ", listener = Platz", listener0 + 1);

  // Step 1: first sayer passes → phase 2 (listener becomes sayer vs third player).
  sockets[sayer0].emit("game:bid", { pass: true });
  await waitFor(
    () => latest[sayer0]?.round?.bidding?.sayerSeat === listener0 && latest[sayer0]?.round?.bidding?.listenerSeat !== null,
    "1. Pass: Phase 2 erreicht",
  );

  const b1 = latest[sayer0]!.round!.bidding!;
  const sayer1 = b1.sayerSeat;
  const lastSeat = b1.listenerSeat!;
  console.log("[bidding-test] Phase 2: sayer = Platz", sayer1 + 1, ", letzter = Platz", lastSeat + 1);

  // Step 2: second sayer passes → the third player gets a bid-or-pass choice.
  sockets[sayer1].emit("game:bid", { pass: true });
  await waitFor(
    () =>
      latest[lastSeat]?.round?.phase === "bidding" &&
      latest[lastSeat]?.round?.bidding?.sayerSeat === lastSeat &&
      latest[lastSeat]?.round?.bidding?.listenerSeat === null,
    "2. Pass: dritter Spieler hat Bid-oder-Pass-Wahl",
  );
  console.log("[bidding-test] Dritter Spieler (Platz", lastSeat + 1, ") hat die Wahl.");

  // Step 3: third player passes → Ramsch.
  sockets[lastSeat].emit("game:bid", { pass: true });
  await waitFor(() => latest[lastSeat]?.round?.phase === "playing", "3. Pass: Ramsch gestartet");

  console.log("[bidding-test] ALLES OK: Ramsch erst nach drei Passen.");
  for (const s of sockets) s.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error("[bidding-test] FEHLER:", err);
  process.exit(1);
});
