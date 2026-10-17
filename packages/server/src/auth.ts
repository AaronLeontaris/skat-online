import { Router } from "express";
import type { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { randomUUID } from "node:crypto";
import type { User, LeaderboardEntry } from "@skat/shared";
import type { ScoringMode } from "@skat/engine";
import { config } from "./config";
import { dbOk, pool } from "./db";
import { sendVerificationEmail } from "./email";

interface UserRecord {
  id: string;
  email: string;
  password_hash: string;
  username: string;
  avatar_url: string | null;
  email_verified: boolean;
  verification_token: string | null;
  games_played: number;
  traditional_sum: number;
  traditional_rounds: number;
  seeger_sum: number;
  seeger_rounds: number;
}

// In-memory store (fast lookup + fallback when Postgres is down).
const byId = new Map<string, UserRecord>();
const byEmail = new Map<string, UserRecord>();

function toPublic(u: UserRecord): User {
  return { id: u.id, email: u.email, username: u.username, avatarUrl: u.avatar_url };
}

async function persistInsert(u: UserRecord): Promise<void> {
  if (!dbOk) return;
  await pool
    .query(
      `INSERT INTO users (id, email, password_hash, username, avatar_url, email_verified, verification_token,
         games_played, traditional_sum, traditional_rounds, seeger_sum, seeger_rounds)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT (email) DO NOTHING`,
      [
        u.id,
        u.email,
        u.password_hash,
        u.username,
        u.avatar_url,
        u.email_verified,
        u.verification_token,
        u.games_played,
        u.traditional_sum,
        u.traditional_rounds,
        u.seeger_sum,
        u.seeger_rounds,
      ],
    )
    .catch(() => {});
}

export async function initUsers(): Promise<void> {
  if (dbOk) {
    try {
      const { rows } = await pool.query(
        `SELECT id, email, password_hash, username, avatar_url, email_verified, verification_token,
           games_played, traditional_sum, traditional_rounds, seeger_sum, seeger_rounds FROM users`,
      );
      for (const r of rows) {
        const u: UserRecord = {
          id: r.id,
          email: r.email,
          password_hash: r.password_hash,
          username: r.username,
          avatar_url: r.avatar_url,
          email_verified: r.email_verified ?? false,
          verification_token: r.verification_token ?? null,
          games_played: r.games_played ?? 0,
          traditional_sum: r.traditional_sum ?? 0,
          traditional_rounds: r.traditional_rounds ?? 0,
          seeger_sum: r.seeger_sum ?? 0,
          seeger_rounds: r.seeger_rounds ?? 0,
        };
        byId.set(u.id, u);
        byEmail.set(u.email, u);
      }
    } catch (err) {
      console.warn("[auth] Laden der Benutzer fehlgeschlagen:", (err as Error).message);
    }
  }

  for (const acc of config.seedAccounts) {
    if (byEmail.has(acc.email)) continue;
    const u: UserRecord = {
      id: randomUUID(),
      email: acc.email,
      password_hash: await bcrypt.hash(acc.password, 10),
      username: acc.username,
      avatar_url: null,
      email_verified: true, // pre-seeded accounts are trusted
      verification_token: null,
      games_played: 0,
      traditional_sum: 0,
      traditional_rounds: 0,
      seeger_sum: 0,
      seeger_rounds: 0,
    };
    byId.set(u.id, u);
    byEmail.set(u.email, u);
    await persistInsert(u);
  }
  console.log(`[auth] ${byId.size} Benutzer verfügbar`);
}

export function getUserById(id: string): User | null {
  const u = byId.get(id);
  return u ? toPublic(u) : null;
}

export type LoginResult =
  | { ok: true; user: User }
  | { ok: false; reason: "invalid" | "unverified" };

export async function loginUser(email: string, password: string): Promise<LoginResult> {
  const u = byEmail.get(email.trim().toLowerCase());
  if (!u) return { ok: false, reason: "invalid" };
  const ok = await bcrypt.compare(password, u.password_hash);
  if (!ok) return { ok: false, reason: "invalid" };
  if (!u.email_verified) return { ok: false, reason: "unverified" };
  return { ok: true, user: toPublic(u) };
}

export type RegisterResult =
  | { ok: true; verificationToken: string; email: string }
  | { ok: false; reason: "exists" };

export async function registerUser(email: string, password: string, username: string): Promise<RegisterResult> {
  const normalized = email.trim().toLowerCase();
  if (byEmail.has(normalized)) return { ok: false, reason: "exists" };
  const u: UserRecord = {
    id: randomUUID(),
    email: normalized,
    password_hash: await bcrypt.hash(password, 10),
    username,
    avatar_url: null,
    email_verified: false,
    verification_token: randomUUID(),
    games_played: 0,
    traditional_sum: 0,
    traditional_rounds: 0,
    seeger_sum: 0,
    seeger_rounds: 0,
  };
  byId.set(u.id, u);
  byEmail.set(u.email, u);
  await persistInsert(u);
  return { ok: true, verificationToken: u.verification_token!, email: u.email };
}

export async function verifyEmail(token: string): Promise<boolean> {
  for (const u of byId.values()) {
    if (u.verification_token === token && token.length > 0) {
      u.email_verified = true;
      u.verification_token = null;
      if (dbOk) {
        await pool
          .query("UPDATE users SET email_verified = TRUE, verification_token = NULL WHERE id = $1", [u.id])
          .catch(() => {});
      }
      return true;
    }
  }
  return false;
}

export async function recordRoundStats(userId: string, delta: number, scoringMode: ScoringMode): Promise<void> {
  const u = byId.get(userId);
  if (!u) return;
  u.games_played += 1;
  if (scoringMode === "seegerFabian") {
    u.seeger_sum += delta;
    u.seeger_rounds += 1;
  } else {
    u.traditional_sum += delta;
    u.traditional_rounds += 1;
  }
  if (dbOk) {
    await pool
      .query(
        "UPDATE users SET games_played = $1, traditional_sum = $2, traditional_rounds = $3, seeger_sum = $4, seeger_rounds = $5 WHERE id = $6",
        [u.games_played, u.traditional_sum, u.traditional_rounds, u.seeger_sum, u.seeger_rounds, u.id],
      )
      .catch(() => {});
  }
}

export function getLeaderboard(): LeaderboardEntry[] {
  return [...byId.values()].map((u) => ({
    userId: u.id,
    username: u.username,
    avatarUrl: u.avatar_url,
    gamesPlayed: u.games_played,
    traditionalAvg: u.traditional_rounds > 0 ? u.traditional_sum / u.traditional_rounds : null,
    seegerAvg: u.seeger_rounds > 0 ? u.seeger_sum / u.seeger_rounds : null,
  }));
}

export async function updateUsername(id: string, username: string): Promise<User | null> {
  const u = byId.get(id);
  if (!u) return null;
  u.username = username;
  if (dbOk) {
    await pool.query("UPDATE users SET username = $1 WHERE id = $2", [username, id]).catch(() => {});
  }
  return toPublic(u);
}

export async function updateAvatar(id: string, avatarUrl: string): Promise<User | null> {
  const u = byId.get(id);
  if (!u) return null;
  u.avatar_url = avatarUrl;
  if (dbOk) {
    await pool.query("UPDATE users SET avatar_url = $1 WHERE id = $2", [avatarUrl, id]).catch(() => {});
  }
  return toPublic(u);
}

export function signToken(userId: string): string {
  return jwt.sign({ sub: userId }, config.jwtSecret, { expiresIn: "7d" });
}

export function verifyToken(token: string): string | null {
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    if (typeof payload === "object" && payload && typeof payload.sub === "string") {
      return payload.sub;
    }
    return null;
  } catch {
    return null;
  }
}

function bearer(req: Request): string | null {
  const h = req.headers.authorization;
  return h && h.startsWith("Bearer ") ? h.slice(7) : null;
}

export const authRouter = Router();

authRouter.post("/login", async (req: Request, res: Response) => {
  const email = typeof req.body?.email === "string" ? req.body.email : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  const result = await loginUser(email.trim(), password);
  if (!result.ok) {
    if (result.reason === "unverified") {
      res.status(403).json({ error: "Bitte bestätige zuerst deine E-Mail-Adresse." });
    } else {
      res.status(401).json({ error: "Ungültige Zugangsdaten" });
    }
    return;
  }
  res.json({ token: signToken(result.user.id), user: result.user });
});

authRouter.post("/register", async (req: Request, res: Response) => {
  const email = typeof req.body?.email === "string" ? req.body.email : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  const username = typeof req.body?.username === "string" ? req.body.username.trim() : "";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    res.status(400).json({ error: "Ungültige E-Mail-Adresse." });
    return;
  }
  if (password.length < 6) {
    res.status(400).json({ error: "Passwort muss mindestens 6 Zeichen lang sein." });
    return;
  }
  if (username.length < 1 || username.length > 30) {
    res.status(400).json({ error: "Ungültiger Benutzername." });
    return;
  }
  const result = await registerUser(email, password, username);
  if (!result.ok) {
    res.status(409).json({ error: "Diese E-Mail ist bereits registriert." });
    return;
  }
  await sendVerificationEmail(result.email, result.verificationToken);
  res.status(201).json({ ok: true, email: result.email });
});

authRouter.post("/verify", async (req: Request, res: Response) => {
  const token = typeof req.body?.token === "string" ? req.body.token.trim() : "";
  const ok = token.length > 0 && (await verifyEmail(token));
  if (!ok) {
    res.status(400).json({ error: "Ungültiger oder abgelaufener Bestätigungslink." });
    return;
  }
  res.json({ ok: true });
});

authRouter.get("/me", (req: Request, res: Response) => {
  const token = bearer(req);
  const userId = token ? verifyToken(token) : null;
  const user = userId ? getUserById(userId) : null;
  if (!user) {
    res.status(401).json({ error: "Nicht angemeldet" });
    return;
  }
  res.json({ user });
});
