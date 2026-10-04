import { Redis } from "ioredis";
import { config } from "./config";

/**
 * Redis is used for presence (online status) in v1 and is the seam for future
 * pub/sub-based horizontal scaling. It degrades gracefully: if Redis is not
 * reachable, the server keeps running and presence becomes a no-op.
 */
export const redis = new Redis({
  host: config.redis.host,
  port: config.redis.port,
  lazyConnect: true,
  maxRetriesPerRequest: 1,
  retryStrategy: () => null,
});

export let redisOk = false;

export async function initRedis(): Promise<void> {
  try {
    await redis.connect();
    redisOk = true;
    console.log("[redis] verbunden");
  } catch (err) {
    redisOk = false;
    console.warn("[redis] nicht erreichbar — Presence deaktiviert:", (err as Error).message);
  }
}

export async function setPresence(userId: string): Promise<void> {
  if (!redisOk) return;
  await redis.set(`presence:${userId}`, "1", "EX", 120).catch(() => {});
}

export async function clearPresence(userId: string): Promise<void> {
  if (!redisOk) return;
  await redis.del(`presence:${userId}`).catch(() => {});
}
