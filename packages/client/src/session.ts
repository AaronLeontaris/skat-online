import type { Snapshot, User } from "@skat/shared";
import type { ChatMessage } from "@skat/shared";

/** State kept for the whole session; `snapshot` is replaced on every server push. */
export interface SessionState {
  /** JWT used for REST calls and the socket handshake. */
  token: string | null;
  /** Profile of the signed-in user. */
  user: User | null;
  /** Latest full server snapshot (table, round, own hand/legal plays). */
  snapshot: Snapshot | null;
  /** Table chat, in arrival order. */
  messages: ChatMessage[];
  /** Last error surfaced to the user (server `error` event or a failed request). */
  error: string | null;
  /** Socket connection state. */
  connected: boolean;
  /** True while the stored token is being checked on startup. */
  loading: boolean;
}

export const initialSessionState: SessionState = {
  token: null,
  user: null,
  snapshot: null,
  messages: [],
  error: null,
  connected: false,
  loading: true,
};

export type SessionAction =
  | { type: "restoring" }
  | { type: "loggedIn"; token: string; user: User }
  | { type: "userUpdated"; user: User }
  | { type: "loggedOut" }
  | { type: "connected"; connected: boolean }
  | { type: "snapshot"; snapshot: Snapshot }
  | { type: "table"; table: Snapshot["table"] }
  | { type: "chat"; message: ChatMessage }
  | { type: "error"; message: string | null };

/** Keep at most this many chat lines in memory. */
const MAX_MESSAGES = 200;

export function sessionReducer(state: SessionState, action: SessionAction): SessionState {
  switch (action.type) {
    case "restoring":
      return { ...state, loading: true };
    case "loggedIn":
      return {
        ...state,
        token: action.token,
        user: action.user,
        error: null,
        loading: false,
      };
    case "userUpdated":
      return { ...state, user: action.user };
    case "loggedOut":
      return {
        ...initialSessionState,
        loading: false,
        connected: false,
      };
    case "connected":
      // On disconnect keep the last snapshot on screen (greying out) instead of blanking it.
      return { ...state, connected: action.connected };
    case "snapshot": {
      // A snapshot for a different table starts a fresh chat history.
      const changedTable = state.snapshot?.table.tableId !== action.snapshot.table.tableId;
      return {
        ...state,
        snapshot: action.snapshot,
        messages: changedTable ? [] : state.messages,
      };
    }
    case "table": {
      if (!state.snapshot) return state;
      return { ...state, snapshot: { ...state.snapshot, table: action.table } };
    }
    case "chat": {
      if (state.messages.some((m) => m.id === action.message.id)) return state;
      const messages = [...state.messages, action.message];
      return {
        ...state,
        messages: messages.length > MAX_MESSAGES ? messages.slice(-MAX_MESSAGES) : messages,
      };
    }
    case "error":
      return { ...state, error: action.message };
    default:
      return state;
  }
}

/** Normalise whatever the server sends in an `error` event into a readable string. */
export function normalizeError(err: unknown): string {
  if (typeof err === "string") return err;
  if (err && typeof err === "object") {
    const rec = err as Record<string, unknown>;
    const message = rec.message;
    const code = rec.code;
    if (typeof message === "string" && message.length > 0) {
      return typeof code === "string" && code.length > 0 ? `${message} (${code})` : message;
    }
    if (typeof code === "string" && code.length > 0) return code;
  }
  return "Unbekannter Fehler.";
}

export const TOKEN_STORAGE_KEY = "skat.token";

export function loadStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function storeToken(token: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (token === null) window.localStorage.removeItem(TOKEN_STORAGE_KEY);
    else window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } catch {
    // Storage may be unavailable (private mode); the session still works in-memory.
  }
}
