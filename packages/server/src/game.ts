import { randomInt } from "node:crypto";
import type { Card, GameDeclaration, SeatIndex, TrumpMode } from "@skat/engine";
import {
  computeMatadors,
  computeSoloValue,
  deal,
  hasWonSolo,
  isNextBidValue,
  legalPlays,
  ramschDeltas,
  scoreSolo,
  SUIT_LABEL_DE,
  trickPoints,
  trickWinnerIndex,
  trumpModeFor,
} from "@skat/engine";
import type { CompletedTrick, Phase, PlayedCard, RoundResult } from "@skat/shared";
import type { TableSession } from "./tables";

export interface Bidding {
  sayerSeat: SeatIndex;
  listenerSeat: SeatIndex;
  heldValue: number | null;
  pendingRaise: number | null;
}

export interface RoundState {
  roundNumber: number;
  phase: Phase;
  dealerSeat: SeatIndex;
  activeSeats: SeatIndex[]; // [Vorhand, Mittelhand, Hinterhand] in play order
  hands: Card[][]; // aligned with activeSeats
  skat: Card[];
  skatForDeclarer: Card[];
  biddingPhase: 1 | 2;
  bidding: Bidding | null;
  declarerSeat: SeatIndex | null;
  bidValue: number | null;
  declaration: GameDeclaration | null;
  trumpMode: TrumpMode | null;
  currentTrick: PlayedCard[];
  completedTricks: CompletedTrick[];
  currentLeader: SeatIndex | null;
  kontra: boolean;
  re: boolean;
  isRamsch: boolean;
  skatTaken: boolean;
  lastResult: RoundResult | null;
}

export type ActionResult = { ok: true } | { ok: false; error: string };
export type BidResult = { ok: true; allPassed: boolean } | { ok: false; error: string };

const rng = () => randomInt(0, 2 ** 32) / 2 ** 32;

export function activeIndex(round: RoundState, seat: SeatIndex): number {
  return round.activeSeats.indexOf(seat);
}

function nextActive(round: RoundState, seat: SeatIndex): SeatIndex {
  return round.activeSeats[(activeIndex(round, seat) + 1) % 3];
}

export function nextDealer(table: TableSession, prev: SeatIndex | null): SeatIndex {
  const occupied: SeatIndex[] = [];
  table.seats.forEach((s, i) => {
    if (s) occupied.push(i as SeatIndex);
  });
  if (occupied.length === 0) return 0 as SeatIndex;
  if (prev === null) return occupied[0];
  const idx = occupied.indexOf(prev);
  return occupied[(idx + 1) % occupied.length];
}

export function startRound(table: TableSession, roundNumber: number, dealerSeat: SeatIndex): RoundState {
  const occupied = table.seats
    .map((s, i) => (s ? (i as SeatIndex) : null))
    .filter((i): i is SeatIndex => i !== null);
  const is4 = occupied.length === 4;

  const active: SeatIndex[] = [];
  let s = dealerSeat;
  for (let k = 0; k < 3; k++) {
    s = (s + 1) % 4;
    while (is4 ? !(occupied.includes(s as SeatIndex) && s !== dealerSeat) : !occupied.includes(s as SeatIndex)) {
      s = (s + 1) % 4;
    }
    active.push(s as SeatIndex);
  }

  const d = deal(rng);
  const round: RoundState = {
    roundNumber,
    phase: "bidding",
    dealerSeat,
    activeSeats: active,
    hands: [d.hands[0], d.hands[1], d.hands[2]],
    skat: d.skat,
    skatForDeclarer: d.skat,
    biddingPhase: 1,
    bidding: { sayerSeat: active[1], listenerSeat: active[0], heldValue: null, pendingRaise: null },
    declarerSeat: null,
    bidValue: null,
    declaration: null,
    trumpMode: null,
    currentTrick: [],
    completedTricks: [],
    currentLeader: null,
    kontra: false,
    re: false,
    isRamsch: false,
    skatTaken: false,
    lastResult: null,
  };

  table.round = round;
  table.status = "playing";
  for (const seat of table.seats) {
    if (seat) seat.ready = false;
  }
  return round;
}

export function startRamsch(round: RoundState): void {
  round.isRamsch = true;
  round.phase = "playing";
  round.trumpMode = { kind: "jacks" };
  round.currentLeader = round.activeSeats[0];
  round.declarerSeat = null;
  round.bidding = null;
  round.declaration = null;
  round.bidValue = null;
}

/** Returns true when nobody bid (all three passed). */
function finishBidding(round: RoundState, declarerSeat: SeatIndex): boolean {
  const held = round.bidding?.heldValue ?? null;
  round.bidding = null;
  if (held === null) return true;
  round.declarerSeat = declarerSeat;
  round.bidValue = held;
  round.phase = "skat";
  return false;
}

export function applyBid(
  round: RoundState,
  seat: SeatIndex,
  payload: { value?: number; pass?: boolean },
): BidResult {
  if (round.phase !== "bidding" || !round.bidding) {
    return { ok: false, error: "Es wird gerade nicht gereizt" };
  }
  const b = round.bidding;
  const sayerTurn = b.pendingRaise === null;
  const currentSeat = sayerTurn ? b.sayerSeat : b.listenerSeat;
  if (seat !== currentSeat) return { ok: false, error: "Du bist nicht am Zug" };

  if (sayerTurn) {
    if (payload.pass) {
      if (round.biddingPhase === 1) {
        round.biddingPhase = 2;
        round.bidding = {
          sayerSeat: b.listenerSeat,
          listenerSeat: round.activeSeats[2],
          heldValue: b.heldValue,
          pendingRaise: null,
        };
        return { ok: true, allPassed: false };
      }
      const allPassed = finishBidding(round, b.listenerSeat);
      return { ok: true, allPassed };
    }
    if (typeof payload.value !== "number" || !isNextBidValue(b.heldValue ?? 0, payload.value)) {
      return { ok: false, error: "Ungültiger Reizwert" };
    }
    round.bidding = { ...b, pendingRaise: payload.value };
    return { ok: true, allPassed: false };
  }

  // Listener turn: hold or pass.
  if (payload.pass) {
    const held = b.pendingRaise!;
    if (round.biddingPhase === 1) {
      round.biddingPhase = 2;
      round.bidding = {
        sayerSeat: b.sayerSeat,
        listenerSeat: round.activeSeats[2],
        heldValue: held,
        pendingRaise: null,
      };
      return { ok: true, allPassed: false };
    }
    round.bidding = { ...b, heldValue: held, pendingRaise: null };
    const allPassed = finishBidding(round, b.sayerSeat);
    return { ok: true, allPassed };
  }
  if (payload.value === b.pendingRaise) {
    round.bidding = { ...b, heldValue: b.pendingRaise, pendingRaise: null };
    return { ok: true, allPassed: false };
  }
  return { ok: false, error: "Du kannst nur halten oder passen" };
}

export function applyPickupSkat(
  round: RoundState,
  seat: SeatIndex,
  payload: { action: "take"; discard: [Card, Card] } | { action: "hand" },
): ActionResult {
  if (round.phase !== "skat" || round.declarerSeat !== seat) return { ok: false, error: "Nicht erlaubt" };
  const idx = activeIndex(round, seat);

  if (payload.action === "hand") {
    round.skatTaken = false;
    round.skatForDeclarer = round.skat;
    round.phase = "announce";
    return { ok: true };
  }

  const full = [...round.hands[idx], ...round.skat];
  const [d1, d2] = payload.discard;
  const hasCard = (c: Card) => full.some((f) => f.suit === c.suit && f.rank === c.rank);
  if (!hasCard(d1) || !hasCard(d2)) return { ok: false, error: "Karte nicht in der Hand" };
  const remaining = removeCard(removeCard(full, d1), d2);
  if (remaining.length !== 10) return { ok: false, error: "Ablage ungültig" };
  round.hands[idx] = remaining;
  round.skatForDeclarer = [d1, d2];
  round.skatTaken = true;
  round.phase = "announce";
  return { ok: true };
}

function removeCard(list: Card[], target: Card): Card[] {
  const idx = list.findIndex((c) => c.suit === target.suit && c.rank === target.rank);
  if (idx === -1) return list;
  return [...list.slice(0, idx), ...list.slice(idx + 1)];
}

export function applyAnnounce(round: RoundState, seat: SeatIndex, declaration: GameDeclaration): ActionResult {
  if (round.phase !== "announce" || round.declarerSeat !== seat) return { ok: false, error: "Nicht erlaubt" };
  if (declaration.kind === "suit" && !declaration.suit) return { ok: false, error: "Farbe fehlt" };
  if (declaration.ouvert && !declaration.hand) return { ok: false, error: "Ouvert nur bei Hand erlaubt" };
  if ((declaration.schneiderAngesagt || declaration.schwarzAngesagt) && !declaration.hand) {
    return { ok: false, error: "Ansagen nur bei Hand erlaubt" };
  }
  if (declaration.kind === "null" && (declaration.schneiderAngesagt || declaration.schwarzAngesagt)) {
    return { ok: false, error: "Schneider/Schwarz nicht bei Null" };
  }
  if (declaration.hand !== !round.skatTaken) {
    return { ok: false, error: "Hand-Angabe widerspricht Skat-Aufnahme" };
  }
  round.declaration = declaration;
  round.trumpMode = trumpModeFor(declaration);
  round.currentLeader = round.activeSeats[0];
  round.phase = "playing";
  return { ok: true };
}

export function applyKontra(round: RoundState, seat: SeatIndex): ActionResult {
  if (round.phase !== "playing" || round.currentTrick.length > 0) {
    return { ok: false, error: "Kontra nicht mehr möglich" };
  }
  if (round.isRamsch || round.declarerSeat === null) return { ok: false, error: "Nicht möglich" };
  if (seat === round.declarerSeat || !round.activeSeats.includes(seat)) {
    return { ok: false, error: "Nur Gegenspieler dürfen Kontra sagen" };
  }
  if (round.kontra) return { ok: false, error: "Kontra bereits angesagt" };
  round.kontra = true;
  return { ok: true };
}

export function applyRe(round: RoundState, seat: SeatIndex): ActionResult {
  if (round.phase !== "playing" || round.currentTrick.length > 0) {
    return { ok: false, error: "Re nicht mehr möglich" };
  }
  if (round.isRamsch || round.declarerSeat === null) return { ok: false, error: "Nicht möglich" };
  if (seat !== round.declarerSeat) return { ok: false, error: "Nur der Alleinspieler darf Re sagen" };
  if (!round.kontra || round.re) return { ok: false, error: "Re nicht möglich" };
  round.re = true;
  return { ok: true };
}

export function applyPlay(round: RoundState, seat: SeatIndex, card: Card): ActionResult {
  if (round.phase !== "playing" || !round.trumpMode) return { ok: false, error: "Es wird nicht gespielt" };
  if (computeCurrentSeat(round) !== seat) return { ok: false, error: "Du bist nicht am Zug" };
  const idx = activeIndex(round, seat);
  const hand = round.hands[idx];
  const lead = round.currentTrick.length === 0 ? null : round.currentTrick[0].card;
  const legal = legalPlays(hand, round.trumpMode, lead);
  if (!legal.some((c) => c.suit === card.suit && c.rank === card.rank)) {
    return { ok: false, error: "Ungültige Karte" };
  }
  round.hands[idx] = hand.filter((c) => !(c.suit === card.suit && c.rank === card.rank));
  round.currentTrick.push({ seatIndex: seat, card });

  if (round.currentTrick.length === 3) {
    const cards = round.currentTrick.map((t) => t.card);
    const winnerIdx = trickWinnerIndex(cards, round.trumpMode, cards[0].suit);
    const winnerSeat = round.currentTrick[winnerIdx].seatIndex;
    round.completedTricks.push({
      cards: [...round.currentTrick],
      winnerSeat,
      points: trickPoints(cards),
    });
    round.currentTrick = [];
    round.currentLeader = winnerSeat;
    if (round.completedTricks.length === 10) round.phase = "scoring";
  }
  return { ok: true };
}

export function computeCurrentSeat(round: RoundState): SeatIndex | null {
  switch (round.phase) {
    case "bidding":
      return round.bidding
        ? round.bidding.pendingRaise === null
          ? round.bidding.sayerSeat
          : round.bidding.listenerSeat
        : null;
    case "skat":
    case "announce":
      return round.declarerSeat;
    case "playing":
      if (round.currentTrick.length === 0) return round.currentLeader;
      return nextActive(round, round.currentTrick[round.currentTrick.length - 1].seatIndex);
    default:
      return null;
  }
}

function gameLabel(d: GameDeclaration): string {
  if (d.kind === "null") {
    if (d.hand && d.ouvert) return "Null Ouvert Hand";
    if (d.ouvert) return "Null Ouvert";
    if (d.hand) return "Null Hand";
    return "Null";
  }
  const base = d.kind === "grand" ? "Grand" : SUIT_LABEL_DE[d.suit!];
  const parts = [base];
  if (d.hand) parts.push("Hand");
  if (d.ouvert) parts.push("Ouvert");
  if (d.schneiderAngesagt) parts.push("Schneider angesagt");
  if (d.schwarzAngesagt) parts.push("Schwarz angesagt");
  return parts.join(" ");
}

function username(table: TableSession, seat: SeatIndex): string {
  return table.seats[seat]?.username ?? `Platz ${seat + 1}`;
}

function applyDeltas(table: TableSession, deltaRows: { seatIndex: SeatIndex; delta: number }[]): void {
  for (const { seatIndex, delta } of deltaRows) {
    table.scores.set(seatIndex, (table.scores.get(seatIndex) ?? 0) + delta);
  }
}

export function scoreRound(table: TableSession, round: RoundState): RoundResult {
  const m = 2 ** table.activeBocks;
  let result: RoundResult;

  if (round.isRamsch) {
    const pts: [number, number, number] = [0, 0, 0];
    for (const t of round.completedTricks) {
      pts[activeIndex(round, t.winnerSeat)] += t.points;
    }
    const lastWinner = round.completedTricks[round.completedTricks.length - 1].winnerSeat;
    pts[activeIndex(round, lastWinner)] += trickPoints(round.skat);
    const deltas = ramschDeltas(pts, table.settings.scoringMode, m);
    const deltaRows = round.activeSeats.map((seat, i) => ({ seatIndex: seat, delta: deltas[i] }));
    applyDeltas(table, deltaRows);
    const loserIdx = pts.indexOf(Math.max(...pts));
    const winnerIdx = pts.indexOf(Math.min(...pts));
    const summary =
      table.settings.scoringMode === "seegerFabian"
        ? `${username(table, round.activeSeats[winnerIdx])} gewinnt Ramsch`
        : `${username(table, round.activeSeats[loserIdx])} verliert Ramsch`;
    result = { declarerSeat: null, won: null, gameValue: 0, deltas: deltaRows, summary };
  } else {
    const dSeat = round.declarerSeat!;
    const dIdx = activeIndex(round, dSeat);
    const finalHand = round.hands[dIdx];
    const d = round.declaration!;
    // In Hand games the Skat counts toward matadors (it belongs to the declarer);
    // after a Skat pickup the final hand already reflects the discard.
    const matHand = d.hand ? [...finalHand, ...round.skat] : finalHand;
    const matadorCount = d.kind === "null" ? 0 : computeMatadors(matHand, d.kind, d.suit).count;
    const wonTricks = round.completedTricks.filter((t) => t.winnerSeat === dSeat);
    const declarerTricks = wonTricks.length;
    const declarerPoints =
      wonTricks.reduce((s, t) => s + t.points, 0) + trickPoints(round.skatForDeclarer);
    const playResult = { declaration: d, declarerPoints, declarerTricks };
    let value = computeSoloValue(playResult, matadorCount);
    value *= (round.kontra ? 2 : 1) * (round.re ? 2 : 1);
    let won = hasWonSolo(playResult);
    if (value < (round.bidValue ?? 0)) won = false; // overbid
    const score = scoreSolo({ value, won, scoringMode: table.settings.scoringMode, bockMultiplier: m });
    const defenders = round.activeSeats.filter((s) => s !== dSeat);
    const deltaRows = [
      { seatIndex: dSeat, delta: score.declarerDelta },
      ...defenders.map((s) => ({ seatIndex: s, delta: score.defenderDelta })),
    ];
    applyDeltas(table, deltaRows);
    const verb = won ? "gewinnt" : "verliert";
    const summary = `${username(table, dSeat)} ${verb} ${gameLabel(d)} für ${value} Punkte`;
    result = { declarerSeat: dSeat, won, gameValue: value, deltas: deltaRows, summary };
  }

  round.lastResult = result;
  round.phase = "roundEnd";
  table.status = "waiting";

  // Everyone is implicitly ready again for the next round.
  for (const seat of table.seats) {
    if (seat) seat.ready = true;
  }

  // Bock trigger for the NEXT round.
  const trigger = round.isRamsch || (round.declaration?.hand === true && result.won === false);
  if (table.settings.bock && trigger) table.activeBocks += 1;

  return result;
}
