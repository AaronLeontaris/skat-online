import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from "react";
import type { Socket } from "socket.io-client";
import type { ClientToServer, User } from "@skat/shared";
import { connectSocket, login as apiLogin, me as apiMe } from "./api";
import type { ClientEventMap, ServerEventMap } from "./api";
import {
  initialSessionState,
  loadStoredToken,
  normalizeError,
  sessionReducer,
  storeToken,
  type SessionState,
} from "./session";

/** Typed view of the Socket.IO connection used across the app. */
export type TypedSocket = Socket<ServerEventMap, ClientEventMap>;

/** Handle returned by `on`, mirroring the socket listener signature. */
export type ServerHandler<K extends keyof ServerEventMap> = ServerEventMap[K];

export interface SessionContextValue extends SessionState {
  /** Emit a client → server event; no-op while the socket is not connected. */
  emit: <K extends keyof ClientToServer>(event: K, payload: ClientToServer[K]) => void;
  /** Subscribe to a server → client event for the lifetime of the component. */
  on: <K extends keyof ServerEventMap>(event: K, handler: ServerHandler<K>) => void;
  signIn: (token: string, user: User) => void;
  signOut: () => void;
  setUser: (user: User) => void;
  setError: (message: string | null) => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }): JSX.Element {
  const [state, dispatch] = useReducer(sessionReducer, initialSessionState, (base) => ({
    ...base,
    token: loadStoredToken(),
  }));
  const socketRef = useRef<TypedSocket | null>(null);

  // --- Startup: validate a stored token, otherwise fall back to the login screen.
  useEffect(() => {
    let cancelled = false;
    const token = loadStoredToken();
    if (!token) {
      dispatch({ type: "loggedOut" });
      return () => {
        cancelled = true;
      };
    }
    dispatch({ type: "restoring" });
    apiMe(token)
      .then((user) => {
        if (cancelled) return;
        dispatch({ type: "loggedIn", token, user });
      })
      .catch(() => {
        if (cancelled) return;
        storeToken(null);
        dispatch({ type: "loggedOut" });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // --- Socket lifecycle: connect once a token exists, tear down on logout.
  useEffect(() => {
    const token = state.token;
    if (!token) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      return;
    }
    const socket = connectSocket(token);
    socketRef.current = socket;

    socket.on("connect", () => dispatch({ type: "connected", connected: true }));
    socket.on("disconnect", () => dispatch({ type: "connected", connected: false }));
    socket.on("connect_error", (err) => {
      dispatch({ type: "connected", connected: false });
      const message = err instanceof Error ? err.message : "";
      // A rejected handshake (bad/expired token) must not retry forever.
      if (/auth|token|jwt|unauthor/i.test(message)) {
        storeToken(null);
        dispatch({ type: "loggedOut" });
        dispatch({ type: "error", message: "Sitzung abgelaufen – bitte erneut anmelden." });
        return;
      }
      dispatch({ type: "error", message: "Verbindung zum Server fehlgeschlagen." });
    });
    socket.on("snapshot", (snapshot) => dispatch({ type: "snapshot", snapshot }));
    socket.on("table:updated", (table) => dispatch({ type: "table", table }));
    socket.on("chat:message", (message) => dispatch({ type: "chat", message }));
    socket.on("error", (err) => dispatch({ type: "error", message: normalizeError(err) }));

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [state.token]);

  // --- Error toasts fade out on their own.
  useEffect(() => {
    if (!state.error) return;
    const timer = window.setTimeout(() => dispatch({ type: "error", message: null }), 6000);
    return () => window.clearTimeout(timer);
  }, [state.error]);

  const emit = useCallback<SessionContextValue["emit"]>((event, payload) => {
    const socket = socketRef.current;
    if (!socket || !socket.connected) {
      dispatch({ type: "error", message: "Nicht mit dem Server verbunden." });
      return;
    }
    // The mapped type keeps event/payload pairs aligned; the cast only erases
    // the generic correlation TypeScript cannot carry through `Socket.emit`.
    // `.bind(socket)` is required: socket.io-client's emit uses `this`.
    const send = socket.emit.bind(socket) as unknown as (ev: string, data: unknown) => void;
    send(event, payload);
  }, []);

  const on = useCallback<SessionContextValue["on"]>((event, handler) => {
    const socket = socketRef.current;
    if (!socket) return;
    const listen = socket.on.bind(socket) as unknown as (ev: string, fn: (data: unknown) => void) => void;
    listen(event, handler as (data: unknown) => void);
  }, []);

  const signIn = useCallback((token: string, user: User) => {
    storeToken(token);
    dispatch({ type: "loggedIn", token, user });
  }, []);

  const signOut = useCallback(() => {
    storeToken(null);
    dispatch({ type: "loggedOut" });
  }, []);

  const setUser = useCallback((user: User) => {
    dispatch({ type: "userUpdated", user });
  }, []);

  const setError = useCallback((message: string | null) => {
    dispatch({ type: "error", message });
  }, []);

  const value = useMemo<SessionContextValue>(
    () => ({ ...state, emit, on, signIn, signOut, setUser, setError }),
    [state, emit, on, signIn, signOut, setUser, setError],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

/** Access the session. Throws when used outside of `SessionProvider`. */
export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside <SessionProvider>.");
  return ctx;
}

/** Group the imperative API behind one helper for callers that prefer it. */
export function useAuth(): {
  signIn: SessionContextValue["signIn"];
  signOut: SessionContextValue["signOut"];
  setUser: SessionContextValue["setUser"];
  setError: SessionContextValue["setError"];
  login: typeof apiLogin;
} {
  const { signIn, signOut, setUser, setError } = useSession();
  return useMemo(
    () => ({ signIn, signOut, setUser, setError, login: apiLogin }),
    [signIn, signOut, setUser, setError],
  );
}
