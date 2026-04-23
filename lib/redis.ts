import { Redis } from "@upstash/redis";

function envPair(): { url?: string; token?: string } {
  const url =
    process.env.KV_REST_API_URL?.trim() ||
    process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token =
    process.env.KV_REST_API_TOKEN?.trim() ||
    process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  return { url, token };
}

export function isConfigured(): boolean {
  const { url, token } = envPair();
  return Boolean(url && token);
}

let cached: Redis | null = null;

export function getRedis(): Redis {
  if (cached) return cached;
  const { url, token } = envPair();
  if (!url || !token) {
    throw new Error(
      "Upstash Redis 未配置：请设置 KV_REST_API_URL 与 KV_REST_API_TOKEN（或 UPSTASH_REDIS_REST_URL/TOKEN）。",
    );
  }
  cached = new Redis({ url, token });
  return cached;
}
