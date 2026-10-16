import http from "node:http";
import { existsSync } from "node:fs";
import express from "express";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Server } from "socket.io";
import { authRouter, initUsers } from "./auth";
import { config } from "./config";
import { initDb } from "./db";
import { mediaRouter } from "./media";
import { initRedis } from "./redis";
import { buildTablePublic } from "./snapshot";
import { setupSocket } from "./socket";
import { TableStore } from "./tables";

async function main(): Promise<void> {
  await initDb();
  await initUsers();
  await initRedis();

  const store = new TableStore();

  const app = express();
  app.use(express.json());
  app.use("/api/auth", authRouter);
  app.use("/api", mediaRouter);
  app.use("/uploads", express.static(resolve(config.uploadDir)));

  app.get("/api/tables", (_req, res) => {
    res.json(store.openTables().map(buildTablePublic));
  });

  // Serve the built client (SPA) in production; skipped when dist/ is absent (dev).
  const clientDist = resolve(dirname(fileURLToPath(import.meta.url)), "../../../client/dist");
  if (existsSync(clientDist)) {
    app.use(express.static(clientDist));
    app.get("*", (req, res, next) => {
      if (req.path.startsWith("/api") || req.path.startsWith("/uploads") || req.path.startsWith("/socket.io")) {
        return next();
      }
      res.sendFile(resolve(clientDist, "index.html"));
    });
  }

  const server = http.createServer(app);
  const io = new Server(server, {
    cors: { origin: config.clientOrigin, credentials: true },
  });
  setupSocket(io, store);

  server.listen(config.port, "0.0.0.0", () => {
    console.log(`[server] läuft auf http://0.0.0.0:${config.port}`);
  });
}

main().catch((err) => {
  console.error("[server] Start fehlgeschlagen:", err);
  process.exit(1);
});
