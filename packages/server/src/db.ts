import { Pool } from "pg";
import { config } from "./config";

export const pool = new Pool({
  host: config.postgres.host,
  port: config.postgres.port,
  database: config.postgres.database,
  user: config.postgres.user,
  password: config.postgres.password,
  connectionTimeoutMillis: 10000,
  max: 10,
});

// Never crash the process on an idle client error.
pool.on("error", (err) => {
  console.warn("[db] idle client error:", err.message);
});

/** True once the schema is confirmed and a query has succeeded. */
export let dbOk = false;

export async function initDb(): Promise<void> {
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          email TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          username TEXT NOT NULL,
          avatar_url TEXT,
          email_verified BOOLEAN NOT NULL DEFAULT FALSE,
          verification_token TEXT,
          games_played INTEGER NOT NULL DEFAULT 0,
          traditional_sum INTEGER NOT NULL DEFAULT 0,
          traditional_rounds INTEGER NOT NULL DEFAULT 0,
          seeger_sum INTEGER NOT NULL DEFAULT 0,
          seeger_rounds INTEGER NOT NULL DEFAULT 0,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `);
      // Migrations for databases created before these columns existed.
      await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE`);
      await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_token TEXT`);
      await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS games_played INTEGER NOT NULL DEFAULT 0`);
      await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS traditional_sum INTEGER NOT NULL DEFAULT 0`);
      await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS traditional_rounds INTEGER NOT NULL DEFAULT 0`);
      await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS seeger_sum INTEGER NOT NULL DEFAULT 0`);
      await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS seeger_rounds INTEGER NOT NULL DEFAULT 0`);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS chat_messages (
          id TEXT PRIMARY KEY,
          table_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          username TEXT NOT NULL,
          text TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `);
      dbOk = true;
      console.log("[db] Postgres verbunden");
      return;
    } catch (err) {
      console.warn(`[db] Versuch ${attempt}/5 fehlgeschlagen:`, (err as Error).message);
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
  dbOk = false;
  console.warn("[db] Postgres nicht erreichbar — in-memory Modus");
}
