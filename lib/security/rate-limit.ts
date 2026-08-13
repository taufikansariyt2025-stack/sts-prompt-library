import "server-only";

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

/**
 * Rate limiting.
 *
 * Uses Upstash Redis when configured. Falls back to an in-memory sliding
 * window so local development works without any external service — that
 * fallback is per-instance and therefore NOT sufficient in production, which
 * is why `isDistributed()` is exposed for a startup warning.
 */

type Result = { success: boolean; remaining: number; resetMs: number };

const redis = (() => {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
})();

export function isDistributed(): boolean {
  return redis !== null;
}

const limiters = new Map<string, Ratelimit>();

/** In-memory fallback: key → timestamps within the current window. */
const memory = new Map<string, number[]>();

export const LIMITS = {
  login: { requests: 5, windowSec: 900 }, // 5 / 15 min
  uploadUrl: { requests: 30, windowSec: 600 }, // 30 / 10 min
  adminWrite: { requests: 120, windowSec: 300 }, // 120 / 5 min
  metric: { requests: 60, windowSec: 60 },
  imageProxy: { requests: 100, windowSec: 300 },
} as const;

export type LimitName = keyof typeof LIMITS;

export async function rateLimit(name: LimitName, identifier: string): Promise<Result> {
  const { requests, windowSec } = LIMITS[name];
  const key = `${name}:${identifier}`;

  if (redis) {
    let limiter = limiters.get(name);
    if (!limiter) {
      limiter = new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(requests, `${windowSec} s`),
        prefix: `sts:rl:${name}`,
        analytics: false,
      });
      limiters.set(name, limiter);
    }
    const result = await limiter.limit(identifier);
    return {
      success: result.success,
      remaining: result.remaining,
      resetMs: Math.max(0, result.reset - Date.now()),
    };
  }

  const now = Date.now();
  const windowMs = windowSec * 1000;
  const hits = (memory.get(key) ?? []).filter((t) => now - t < windowMs);

  if (hits.length >= requests) {
    const oldest = hits[0] ?? now;
    return { success: false, remaining: 0, resetMs: windowMs - (now - oldest) };
  }

  hits.push(now);
  memory.set(key, hits);

  // Opportunistic cleanup so the map can't grow without bound.
  if (memory.size > 5000) {
    for (const [k, v] of memory) {
      if (v.every((t) => now - t >= windowMs)) memory.delete(k);
    }
  }

  return { success: true, remaining: requests - hits.length, resetMs: windowMs };
}

/**
 * Best-effort client IP.
 *
 * Only trusted behind a proxy that overwrites these headers (Vercel and
 * Cloudflare both do). Used for rate limiting only, never stored.
 */
export function clientIp(request: Request): string {
  const headers = request.headers;
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return headers.get("x-real-ip") ?? headers.get("cf-connecting-ip") ?? "unknown";
}
