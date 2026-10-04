import type { Card, GameDeclaration, ScoringMode, SeatIndex, Suit } from "@skat/engine";

export type Phase =
  | "waiting"
  | "bidding"
  | "skat"
  | "announce"
  | "playing"
  | "scoring"
  | "roundEnd";

export interface TableSettings {
  kontraRe: boolean;
  bock: boolean;
  ramsch: boolean;
  scoringMode: ScoringMode;
}

export interface User {
  id: string;
  email: string;
  username: string;
  avatarUrl: string | null;
}

export interface PublicPlayer {
  userId: string;
  username: string;
  avatarUrl: string | null;
  seatIndex: SeatIndex | null;
  ready: boolean;
}

export interface PlayedCard {
  seatIndex: SeatIndex;
  card: Card;
}

export interface CompletedTrick {
  cards: PlayedCard[];
  winnerSeat: SeatIndex;
  points: number;
}

export interface RoundResult {
  declarerSeat: SeatIndex | null;
  won: boolean | null; // null for Ramsch
  gameValue: number;
  /** Per-seat delta applied this round. */
  deltas: { seatIndex: SeatIndex; delta: number }[];
  summary: string;
}

/** Live state of the say/respond bidding, present only during the bidding phase. */
export interface BiddingState {
  sayerSeat: SeatIndex;
  listenerSeat: SeatIndex;
  /** Last value the listener accepted, or null before the first hold. */
  heldValue: number | null;
  /** Value the sayer proposed and is awaiting the listener's decision on, or null. */
  pendingRaise: number | null;
}

export interface ScoreRow {
  seatIndex: SeatIndex;
  total: number;
}

export interface RoundPublicState {
  roundNumber: number;
  phase: Phase;
  dealerSeat: SeatIndex;
  activeSeats: SeatIndex[];
  declarerSeat: SeatIndex | null;
  declaration: GameDeclaration | null;
  bidValue: number | null;
  /** Say/respond bidding state; null outside the bidding phase. */
  bidding: BiddingState | null;
  /** Seat whose turn it is (bidding/playing). */
  currentSeat: SeatIndex | null;
  trumpSuit: Suit | null;
  completedTricks: CompletedTrick[];
  currentTrick: PlayedCard[];
  skat: Card[] | null;
  kontra: boolean;
  re: boolean;
  bockActive: boolean;
  lastResult: RoundResult | null;
  scores: ScoreRow[];
}

export type TableStatus = "waiting" | "playing";

export interface TablePublicState {
  tableId: string;
  name: string;
  hostUserId: string;
  settings: TableSettings;
  seats: (PublicPlayer | null)[];
  status: TableStatus;
}

export interface Snapshot {
  table: TablePublicState;
  round: RoundPublicState | null;
  self: {
    userId: string;
    seatIndex: SeatIndex | null;
    hand: Card[];
    /** Legal cards if it is this player's turn, else null. */
    legalPlays: Card[] | null;
  };
}

export type GameEvent =
  | { type: "deal"; activeSeats: SeatIndex[]; dealerSeat: SeatIndex }
  | { type: "biddingStarted" }
  | { type: "bidMade"; seatIndex: SeatIndex; value: number | "pass" }
  | { type: "declarerChosen"; seatIndex: SeatIndex; bidValue: number }
  | { type: "allPassed" }
  | { type: "skatPickedUp"; seatIndex: SeatIndex; skat: Card[] }
  | { type: "handChosen"; seatIndex: SeatIndex }
  | { type: "announced"; seatIndex: SeatIndex; declaration: GameDeclaration }
  | { type: "cardPlayed"; seatIndex: SeatIndex; card: Card }
  | { type: "trickWon"; winnerSeat: SeatIndex; points: number }
  | { type: "kontra"; seatIndex: SeatIndex }
  | { type: "re"; seatIndex: SeatIndex }
  | { type: "roundEnd"; result: RoundResult };

export interface ChatMessage {
  id: string;
  tableId: string;
  userId: string;
  username: string;
  text: string;
  createdAt: string;
}

export interface ClientToServer {
  "table:create": { name: string; settings: TableSettings };
  "table:join": { tableId: string; seatIndex: number };
  "table:leave": Record<string, never>;
  "table:setSettings": { settings: TableSettings };
  "table:ready": { ready: boolean };
  "table:start": Record<string, never>;
  "game:bid": { value: number } | { pass: true };
  "game:pickupSkat": { action: "take"; discard: [Card, Card] } | { action: "hand" };
  "game:announce": { declaration: GameDeclaration };
  "game:playCard": { card: Card };
  "game:kontra": Record<string, never>;
  "game:re": Record<string, never>;
  "chat:send": { text: string };
}

export interface ServerToClient {
  snapshot: Snapshot;
  "game:event": { seq: number; event: GameEvent };
  "chat:message": ChatMessage;
  error: { code: string; message: string };
  "table:updated": TablePublicState;
}

export type ClientEvent = keyof ClientToServer;
export type ServerEvent = keyof ServerToClient;
