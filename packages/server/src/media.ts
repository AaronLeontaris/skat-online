import { Router } from "express";
import type { Request, Response } from "express";
import express from "express";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import sharp from "sharp";
import { config } from "./config";
import { updateAvatar, updateUsername, verifyToken } from "./auth";

export const mediaRouter = Router();

function authUserId(req: Request): string | null {
  const h = req.headers.authorization;
  const token = h && h.startsWith("Bearer ") ? h.slice(7) : null;
  return token ? verifyToken(token) : null;
}

mediaRouter.post(
  "/avatar",
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
    const avatarUrl = `/uploads/${userId}.jpg`;
    await updateAvatar(userId, avatarUrl);
    res.json({ avatarUrl });
  },
);

mediaRouter.patch("/profile", async (req: Request, res: Response) => {
  const userId = authUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Nicht angemeldet" });
    return;
  }
  const username = typeof req.body?.username === "string" ? req.body.username.trim() : "";
  if (username.length < 1 || username.length > 30) {
    res.status(400).json({ error: "Ungültiger Benutzername" });
    return;
  }
  const user = await updateUsername(userId, username);
  res.json({ user });
});
