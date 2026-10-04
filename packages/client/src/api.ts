import { io, type Socket } from "socket.io-client";
import type { User } from "@skat/shared";
import type { ClientToServer, ServerToClient } from "@skat/shared";

/**
 * Socket.IO event maps are maps of *listener functions*, so the protocol types
 * (maps of payloads) are wrapped here once.
 */
export type ServerEventMap = { [K in keyof ServerToClient]: (payload: ServerToClient[K]) => void };
export type ClientEventMap = { [K in keyof ClientToServer]: (payload: ClientToServer[K]) => void };

/**
 * Base URL for REST calls. Empty string means "same origin" (Vite dev proxy or
 * a reverse proxy in production); `VITE_API_URL` overrides it when the API
 * lives on another host.
 */
export const API_BASE: string = (() => {
  const fromEnv = import.meta.env.VITE_API_URL;
  if (typeof fromEnv === "string" && fromEnv.length > 0) return fromEnv;
  return "";
})();

/** WebSocket origin: same as the API base, or the page origin when empty. */
export function socketOrigin(): string {
  if (API_BASE) return API_BASE;
  return typeof window === "undefined" ? "http://localhost:4000" : window.location.origin;
}

export class ApiError extends Error {
  public readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/** Lobby entry as returned by `GET /api/tables` (shape is server-defined). */
export interface OpenTable {
  tableId: string;
  name: string;
  hostUserId?: string;
  hostUsername?: string;
  seated?: number;
  capacity?: number;
  status?: "waiting" | "playing";
}

/** Response of `POST /api/auth/login` (shape is server-defined). */
export interface LoginResult {
  token: string;
  user: User;
}

function jsonHeaders(token?: string): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

/** Extract a server error message from a JSON `{ error | message }` body. */
async function errorMessage(res: Response): Promise<string> {
  try {
    const text = await res.text();
    if (!text) return `${res.status} ${res.statusText}`;
    try {
      const body: unknown = JSON.parse(text);
      if (typeof body === "string") return body;
      if (body && typeof body === "object") {
        const record = body as Record<string, unknown>;
        for (const key of ["message", "error", "detail"]) {
          const value = record[key];
          if (typeof value === "string" && value.length > 0) return value;
        }
      }
      return text;
    } catch {
      return text;
    }
  } catch {
    return `${res.status} ${res.statusText}`;
  }
}

async function request<T>(path: string, init: RequestInit, expectJson: boolean): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, init);
  } catch {
    throw new ApiError(0, "Netzwerkfehler – Server nicht erreichbar.");
  }
  if (!res.ok) {
    throw new ApiError(res.status, await errorMessage(res));
  }
  if (!expectJson) return undefined as T;
  try {
    return (await res.json()) as T;
  } catch {
    throw new ApiError(res.status, "Ungültige Antwort vom Server.");
  }
}

export function login(email: string, password: string): Promise<LoginResult> {
  return request<LoginResult>(
    "/api/auth/login",
    { method: "POST", headers: jsonHeaders(), body: JSON.stringify({ email, password }) },
    true,
  );
}

export function me(token: string): Promise<User> {
  return request<User>("/api/auth/me", { method: "GET", headers: jsonHeaders(token) }, true);
}

/** Uploads the file as a raw binary body with the file's own MIME type. */
export function uploadAvatar(token: string, file: File): Promise<{ avatarUrl?: string }> {
  const contentType = file.type && file.type.length > 0 ? file.type : "application/octet-stream";
  return request<{ avatarUrl?: string }>(
    "/api/profile/avatar",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": contentType },
      body: file,
    },
    false,
  );
}

export function updateProfile(token: string, username: string): Promise<User> {
  return request<User>(
    "/api/profile",
    { method: "PATCH", headers: jsonHeaders(token), body: JSON.stringify({ username }) },
    true,
  );
}

export function fetchTables(token: string): Promise<OpenTable[]> {
  return request<OpenTable[]>("/api/tables", { method: "GET", headers: jsonHeaders(token) }, true);
}

/**
 * Connects the Socket.IO gateway with a JWT in the handshake `auth` payload.
 * Reconnection is automatic; the server resends a full `snapshot` on connect.
 */
export function connectSocket(token: string): Socket<ServerEventMap, ClientEventMap> {
  const socket = io(socketOrigin(), {
    auth: { token },
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionDelay: 500,
    reconnectionDelayMax: 4000,
  });
  // `io()` itself is typed with the default event maps; the cast only swaps in
  // the protocol maps declared above.
  return socket as unknown as Socket<ServerEventMap, ClientEventMap>;
}
