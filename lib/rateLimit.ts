type RateLimitOptions = {
  key: string;
  windowMs: number;
  maxRequests: number;
};

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

export type RateLimitResult = {
  ok: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
};

declare global {
  var __rateLimitStore: Map<string, RateLimitEntry> | undefined;
}

const store = globalThis.__rateLimitStore ?? new Map<string, RateLimitEntry>();

if (!globalThis.__rateLimitStore) {
  globalThis.__rateLimitStore = store;
}

function cleanupExpiredEntries(now: number) {
  for (const [key, entry] of store.entries()) {
    if (entry.resetAt <= now) {
      store.delete(key);
    }
  }
}

export function rateLimit({
  key,
  windowMs,
  maxRequests,
}: RateLimitOptions): RateLimitResult {
  const now = Date.now();

  if (store.size > 1000) {
    cleanupExpiredEntries(now);
  }

  const existingEntry = store.get(key);

  if (!existingEntry || existingEntry.resetAt <= now) {
    const resetAt = now + windowMs;

    store.set(key, {
      count: 1,
      resetAt,
    });

    return {
      ok: true,
      limit: maxRequests,
      remaining: Math.max(0, maxRequests - 1),
      resetAt,
      retryAfterSeconds: Math.ceil(windowMs / 1000),
    };
  }

  if (existingEntry.count >= maxRequests) {
    return {
      ok: false,
      limit: maxRequests,
      remaining: 0,
      resetAt: existingEntry.resetAt,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((existingEntry.resetAt - now) / 1000),
      ),
    };
  }

  existingEntry.count += 1;
  store.set(key, existingEntry);

  return {
    ok: true,
    limit: maxRequests,
    remaining: Math.max(0, maxRequests - existingEntry.count),
    resetAt: existingEntry.resetAt,
    retryAfterSeconds: Math.max(
      1,
      Math.ceil((existingEntry.resetAt - now) / 1000),
    ),
  };
}

export function rateLimitHeaders(limiter: RateLimitResult) {
  return {
    "X-RateLimit-Limit": String(limiter.limit),
    "X-RateLimit-Remaining": String(limiter.remaining),
    "X-RateLimit-Reset": String(limiter.resetAt),
  };
}