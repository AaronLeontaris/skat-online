import http from "node:http";
import express from "express";
import { resolve } from "node:path";
import { Server } from "socket.io";
import { authRouter, initUsers } from "./auth";
import { config } from "./config";
import { initDb } from "./db";
import { mediaRouter } from "./media";
import { buildTablePublic } from "./snapshot";
import { setupSocket } from "./socket";
import { TableStore } from "./tables";

async function main(): Promise<void> {
  await initDb();
  await initUsers();

  const store = new TableStore();

  const app = express();
  app.use(express.json());
  app.use("/api/auth", authRouter);
  app.use("/api", mediaRouter);
  app.use("/uploads", express.static(resolve(config.uploadDir)));

  app.get("/api/tables", (_req, res) => {
    res.json(store.openTables().map(buildTablePublic));
  });

  const server = http.createServer(app);
  const io = new Server(server, {
    cors: { origin: config.clientOrigin, credentials: true },
  });
  setupSocket(io, store);

  server.listen(config.port, () => {
    console.log(`[server] läuft auf http://localhost:${config.port}`);
  });
}

main().catch((err) => {
  console.error("[server] Start fehlgeschlagen:", err);
  process.exit(1);
});
