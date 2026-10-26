/* Verifies character selection gating + voice-line relay carries the character. */
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

const latest: (Snapshot | null)[] = [];
const lastSound: { sound: string; kind: string; character?: string | null }[] = [];
const lastError: string[] = [];

async function waitFor(cond: () => boolean, label: string, ms = 8000): Promise<void> {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > ms) throw new Error(`Timeout bei: ${label}`);
    await new Promise((r) => setTimeout(r, 80));
  }
  console.log("[char-test] OK:", label);
}

async function main(): Promise<void> {
  const sockets: Socket[] = [];
  for (let i = 0; i < ACCOUNTS.length; i++) {
    const token = await login(ACCOUNTS[i]!.email, ACCOUNTS[i]!.password);
    const socket = io(BASE, { auth: { token } });
    const idx = i;
    socket.on("snapshot", (snap: Snapshot) => {
      latest[idx] = snap;
    });
    socket.on("sound:play", (payload) => {
      lastSound.push(payload);
    });
    socket.on("error", (err) => {
      lastError.push(`${err.code}:${err.message}`);
    });
    sockets.push(socket);
  }
  await waitFor(() => sockets.every((s) => s.connected), "alle verbunden");

  sockets[0]!.emit("table:create", {
    name: "CharTest",
    settings: { kontraRe: true, bock: true, ramsch: true, scoringMode: "traditional" },
  });
  await waitFor(() => latest[0]?.self.seatIndex === 0, "Tisch erstellt");
  const tableId = latest[0]!.table.tableId;

  sockets[1]!.emit("table:join", { tableId, seatIndex: 1 });
  sockets[2]!.emit("table:join", { tableId, seatIndex: 2 });
  await waitFor(() => latest[1]?.self.seatIndex === 1 && latest[2]?.self.seatIndex === 2, "beigetreten");

  sockets[0]!.emit("table:ready", { ready: true });
  sockets[1]!.emit("table:ready", { ready: true });
  sockets[2]!.emit("table:ready", { ready: true });
  await waitFor(
    () => latest[0]?.table.seats.every((s) => s === null || s.ready) === true,
    "alle bereit",
  );

  // Start without characters should fail.
  lastError.length = 0;
  sockets[0]!.emit("table:start", {});
  await waitFor(() => lastError.some((e) => e.includes("Charakter")), "Start ohne Charakter abgelehnt");
  console.log("[char-test] Start ohne Charakter korrekt abgelehnt:", lastError[0]);

  // Pick characters.
  sockets[0]!.emit("table:setCharacter", { character: "petra" });
  sockets[1]!.emit("table:setCharacter", { character: "thomas" });
  sockets[2]!.emit("table:setCharacter", { character: "petra" });
  await waitFor(
    () =>
      latest[0]?.table.seats.filter((s) => s !== null).every((s) => s!.character !== null) === true,
    "alle Charaktere gesetzt",
  );
  console.log(
    "[char-test] Charaktere:",
    latest[0]!.table.seats.filter((s) => s !== null).map((s) => `${s!.username}=${s!.character}`),
  );

  // Start now should work.
  sockets[0]!.emit("table:start", {});
  await waitFor(() => latest[0]?.round?.phase === "bidding", "Runde gestartet");

  // Send a voice line and verify the relay carries the character.
  lastSound.length = 0;
  sockets[1]!.emit("sound:play", { sound: "huzza", kind: "speech" });
  await waitFor(() => lastSound.length > 0, "Sound relaying");
  console.log("[char-test] Sound-Event:", JSON.stringify(lastSound[0]));
  if (lastSound[0]?.character === "thomas") {
    console.log("[char-test] OK: Charakter (thomas) wurde mitgesendet.");
  } else {
    throw new Error(`Charakter fehlt im Sound-Event: ${JSON.stringify(lastSound[0])}`);
  }

  console.log("[char-test] ALLES OK");
  for (const s of sockets) s.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error("[char-test] FEHLER:", err);
  process.exit(1);
});
