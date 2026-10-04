import dotenv from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// packages/server/src -> repo root is three levels up.
const here = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(here, "../../../.env") });
dotenv.config();

export interface Config {
  port: number;
  nodeEnv: string;
  jwtSecret: string;
  clientOrigin: string;
  postgres: { host: string; port: number; database: string; user: string; password: string };
  redis: { host: string; port: number };
  uploadDir: string;
  maxUploadMb: number;
  seedAccounts: { email: string; password: string; username: string }[];
}

function int(value: string | undefined, fallback: number): number {
  const n = value ? parseInt(value, 10) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

function parseSeed(raw: string): Config["seedAccounts"] {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((entry) => {
      const [email, password, username] = entry.split(":");
      return { email: email ?? "", password: password ?? "", username: username ?? email ?? "" };
    })
    .filter((a) => a.email.length > 0 && a.password.length > 0);
}

export const config: Config = {
  port: int(process.env.PORT, 4000),
  nodeEnv: process.env.NODE_ENV ?? "development",
  jwtSecret: process.env.JWT_SECRET ?? "dev-secret-change-me",
  clientOrigin: process.env.CLIENT_ORIGIN ?? "http://localhost:5173",
  postgres: {
    host: process.env.POSTGRES_HOST ?? "localhost",
    port: int(process.env.POSTGRES_PORT, 5432),
    database: process.env.POSTGRES_DB ?? "skat",
    user: process.env.POSTGRES_USER ?? "skat",
    password: process.env.POSTGRES_PASSWORD ?? "skat",
  },
  redis: {
    host: process.env.REDIS_HOST ?? "localhost",
    port: int(process.env.REDIS_PORT, 6379),
  },
  uploadDir: process.env.UPLOAD_DIR ?? "./uploads",
  maxUploadMb: int(process.env.MAX_UPLOAD_MB, 8),
  seedAccounts: parseSeed(process.env.SEED_ACCOUNTS ?? ""),
};
