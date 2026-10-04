import { Router } from "express";
import type { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { randomUUID } from "node:crypto";
import type { User } from "@skat/shared";
import { config } from "./config";
import { dbOk, pool } from "./db";

interface UserRecord {
  id: string;
  email: string;
  password_hash: string;
  username: string;
  avatar_url: string | null;
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
      "INSERT INTO users (id, email, password_hash, username, avatar_url) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (email) DO NOTHING",
      [u.id, u.email, u.password_hash, u.username, u.avatar_url],
    )
    .catch(() => {});
}

export async function initUsers(): Promise<void> {
  if (dbOk) {
    try {
      const { rows } = await pool.query(
        "SELECT id, email, password_hash, username, avatar_url FROM users",
      );
      for (const r of rows) {
        const u: UserRecord = {
          id: r.id,
          email: r.email,
          password_hash: r.password_hash,
          username: r.username,
          avatar_url: r.avatar_url,
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

export async function loginUser(email: string, password: string): Promise<User | null> {
  const u = byEmail.get(email);
  if (!u) return null;
  const ok = await bcrypt.compare(password, u.password_hash);
  return ok ? toPublic(u) : null;
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
  const user = await loginUser(email.trim(), password);
  if (!user) {
    res.status(401).json({ error: "Ungültige Zugangsdaten" });
    return;
  }
  res.json({ token: signToken(user.id), user });
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
