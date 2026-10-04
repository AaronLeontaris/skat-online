import type { Card, SeatIndex } from "@skat/engine";
import { legalPlays } from "@skat/engine";
import type { BiddingState, RoundPublicState, Snapshot, TablePublicState } from "@skat/shared";
import { computeCurrentSeat } from "./game";
import type { RoundState } from "./game";
import type { TableSession } from "./tables";

export function buildTablePublic(table: TableSession): TablePublicState {
  return {
    tableId: table.tableId,
    name: table.name,
    hostUserId: table.hostUserId,
    settings: table.settings,
    seats: table.seats.map((p, i) =>
      p
        ? {
            userId: p.userId,
            username: p.username,
            avatarUrl: p.avatarUrl,
            seatIndex: i as SeatIndex,
            ready: p.ready,
          }
        : null,
    ),
    status: table.status,
  };
}

export function buildRoundPublic(
  table: TableSession,
  round: RoundState | null,
  viewerSeat: SeatIndex | null,
): RoundPublicState | null {
  if (!round) return null;
  const revealAll = round.phase === "scoring" || round.phase === "roundEnd";
  const revealToDeclarer =
    round.phase === "skat" && round.declarerSeat !== null && viewerSeat === round.declarerSeat;
  const bidding: BiddingState | null =
    round.phase === "bidding" && round.bidding
      ? {
          sayerSeat: round.bidding.sayerSeat,
          listenerSeat: round.bidding.listenerSeat,
          heldValue: round.bidding.heldValue,
          pendingRaise: round.bidding.pendingRaise,
        }
      : null;
  return {
    roundNumber: round.roundNumber,
    phase: round.phase,
    dealerSeat: round.dealerSeat,
    activeSeats: round.activeSeats,
    declarerSeat: round.declarerSeat,
    declaration: round.declaration,
    bidValue: round.bidValue,
    bidding,
    currentSeat: computeCurrentSeat(round),
    trumpSuit: round.declaration?.kind === "suit" ? round.declaration.suit ?? null : null,
    completedTricks: round.completedTricks,
    currentTrick: round.currentTrick,
    skat: revealAll || revealToDeclarer ? round.skatForDeclarer : null,
    kontra: round.kontra,
    re: round.re,
    bockActive: table.activeBocks > 0,
    lastResult: round.lastResult,
    scores: [...table.scores.entries()]
      .map(([seatIndex, total]) => ({ seatIndex: seatIndex as SeatIndex, total }))
      .sort((a, b) => a.seatIndex - b.seatIndex),
  };
}

export function buildSnapshot(table: TableSession, userId: string): Snapshot {
  const round = table.round;
  let seatIndex: SeatIndex | null = null;
  table.seats.forEach((p, i) => {
    if (p?.userId === userId) seatIndex = i as SeatIndex;
  });

  const activeIdx = round && seatIndex !== null ? round.activeSeats.indexOf(seatIndex) : -1;
  const hand: Card[] = round && activeIdx >= 0 ? round.hands[activeIdx] : [];
  let legal: Card[] | null = null;
  if (
    round &&
    seatIndex !== null &&
    round.phase === "playing" &&
    round.trumpMode &&
    computeCurrentSeat(round) === seatIndex
  ) {
    const lead = round.currentTrick.length === 0 ? null : round.currentTrick[0].card;
    legal = legalPlays(hand, round.trumpMode, lead);
  }

  return {
    table: buildTablePublic(table),
    round: buildRoundPublic(table, round, seatIndex),
    self: { userId, seatIndex, hand, legalPlays: legal },
  };
}
