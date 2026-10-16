import { Redis } from "ioredis";
import { config } from "./config";

/**
 * Redis is used for presence (online status) in v1 and is the seam for future
 * pub/sub-based horizontal scaling. It degrades gracefully: if Redis is not
 * reachable, the server keeps running and presence becomes a no-op.
 */
export let redis: Redis | null = null;
export let redisOk = false;

export async function initRedis(): Promise<void> {
  for (let attempt = 1; attempt <= 5; attempt++) {
    const client = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      retryStrategy: () => null,
    });
    try {
      await client.connect();
      redis = client;
      redisOk = true;
      console.log("[redis] verbunden");
      return;
    } catch (err) {
      console.warn(`[redis] Versuch ${attempt}/5 fehlgeschlagen:`, (err as Error).message);
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
  redisOk = false;
  console.warn("[redis] nicht erreichbar — Presence deaktiviert");
}

export async function setPresence(userId: string): Promise<void> {
  if (!redisOk || !redis) return;
  await redis.set(`presence:${userId}`, "1", "EX", 120).catch(() => {});
}

export async function clearPresence(userId: string): Promise<void> {
  if (!redisOk || !redis) return;
  await redis.del(`presence:${userId}`).catch(() => {});
}
