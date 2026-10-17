import { Router } from "express";
import type { Request, Response } from "express";
import type { Server } from "socket.io";
import express from "express";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import sharp from "sharp";
import { updateAvatar, updateDeckType, updateUsername, verifyToken } from "./auth";
import { config } from "./config";
import { sync } from "./socket";
import type { TableStore } from "./tables";

function authUserId(req: Request): string | null {
  const h = req.headers.authorization;
  const token = h && h.startsWith("Bearer ") ? h.slice(7) : null;
  return token ? verifyToken(token) : null;
}

export function createMediaRouter(store: TableStore, io: Server): Router {
  const router = Router();

  router.post(
    "/profile/avatar",
    express.raw({
      type: ["image/png", "image/jpeg", "image/heic", "image/heif", "application/octet-stream"],
      limit: `${config.maxUploadMb}mb`,
    }),
    async (req: Request, res: Response) => {
      const userId = authUserId(req);
      if (!userId) {
        res.status(401).json({ error: "Nicht angemeldet" });
        return;
      }
      if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
        res.status(400).json({ error: "Keine Bilddaten" });
        return;
      }
      try {
        const dir = resolve(config.uploadDir);
        mkdirSync(dir, { recursive: true });
        // sharp decodes PNG/JPG/HEIC and normalizes to a 256px JPEG thumbnail.
        await sharp(req.body).rotate().resize(256, 256, { fit: "cover" }).jpeg({ quality: 85 }).toFile(
          resolve(dir, `${userId}.jpg`),
        );
      } catch {
        res.status(400).json({ error: "Ungültiges Bild" });
        return;
      }
      // Cache-busting version so other clients reload the new image.
      const avatarUrl = `/uploads/${userId}.jpg?v=${Date.now()}`;
      const user = await updateAvatar(userId, avatarUrl);
      const table = store.tableOfUser(userId);
      if (table && user) {
        store.updateSeatProfile(table, userId, user.username, user.avatarUrl);
        void sync(io, table);
      }
      res.json({ avatarUrl });
    },
  );

  router.patch("/profile", async (req: Request, res: Response) => {
    const userId = authUserId(req);
    if (!userId) {
      res.status(401).json({ error: "Nicht angemeldet" });
      return;
    }
    const username = typeof req.body?.username === "string" ? req.body.username.trim() : null;
    const deckType = typeof req.body?.deckType === "string" ? req.body.deckType : null;

    if (username !== null && (username.length < 1 || username.length > 30)) {
      res.status(400).json({ error: "Ungültiger Benutzername" });
      return;
    }
    if (deckType !== null && deckType !== "normal" && deckType !== "turnier") {
      res.status(400).json({ error: "Ungültiges Deck" });
      return;
    }

    let user = null;
    if (username !== null) user = await updateUsername(userId, username);
    if (deckType !== null) user = await updateDeckType(userId, deckType);

    if (user && username !== null) {
      const table = store.tableOfUser(userId);
      if (table) {
        store.updateSeatProfile(table, userId, user.username, user.avatarUrl);
        void sync(io, table);
      }
    }
    res.json({ user });
  });

  return router;
}
