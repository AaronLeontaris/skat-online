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
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `);
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
