import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

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

export type RateLimitRuntimeConfig = {
  nodeEnv?: string;
  redisUrl?: string;
  redisToken?: string;
};

export type RateLimitBackend = "memory" | "redis";

declare global {
  var __rateLimitStore: Map<string, RateLimitEntry> | undefined;
}

const store = globalThis.__rateLimitStore ?? new Map<string, RateLimitEntry>();
const distributedLimiters = new Map<string, Ratelimit>();
let redisClient: Redis | null = null;

if (!globalThis.__rateLimitStore) {
  globalThis.__rateLimitStore = store;
}

function validateOptions({ key, windowMs, maxRequests }: RateLimitOptions) {
  if (!key.trim()) throw new Error("Rate limit key is required");

  if (!Number.isInteger(windowMs) || windowMs <= 0) {
    throw new Error("Rate limit window must be a positive integer");
  }

  if (!Number.isInteger(maxRequests) || maxRequests <= 0) {
    throw new Error("Rate limit maximum must be a positive integer");
  }
}

function cleanupExpiredEntries(now: number) {
  for (const [key, entry] of store.entries()) {
    if (entry.resetAt <= now) {
      store.delete(key);
    }
  }
}

export function resolveRateLimitBackend({
  nodeEnv,
  redisUrl,
  redisToken,
}: RateLimitRuntimeConfig): RateLimitBackend {
  const hasRedisUrl = Boolean(redisUrl?.trim());
  const hasRedisToken = Boolean(redisToken?.trim());

  if (hasRedisUrl !== hasRedisToken) {
    throw new Error(
      "Both UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be set",
    );
  }

  if (hasRedisUrl && hasRedisToken) return "redis";

  if (nodeEnv === "production") {
    throw new Error(
      "Distributed rate limiting is required in production. Set the Upstash Redis environment variables.",
    );
  }

  return "memory";
}

export function rateLimitInMemory(
  options: RateLimitOptions,
  now = Date.now(),
): RateLimitResult {
  validateOptions(options);

  const { key, windowMs, maxRequests } = options;

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

function getRedisClient(redisUrl: string, redisToken: string) {
  if (!redisClient) {
    redisClient = new Redis({
      url: redisUrl,
      token: redisToken,
      enableTelemetry: false,
    });
  }

  return redisClient;
}

function getDistributedLimiter(
  options: RateLimitOptions,
  redisUrl: string,
  redisToken: string,
) {
  const cacheKey = `${options.maxRequests}:${options.windowMs}`;
  const existingLimiter = distributedLimiters.get(cacheKey);

  if (existingLimiter) return existingLimiter;

  const limiter = new Ratelimit({
    redis: getRedisClient(redisUrl, redisToken),
    limiter: Ratelimit.slidingWindow(
      options.maxRequests,
      `${options.windowMs} ms`,
    ),
    prefix: `hotel-system:rate-limit:${cacheKey}`,
    analytics: false,
    timeout: 1500,
  });

  distributedLimiters.set(cacheKey, limiter);

  return limiter;
}

async function rateLimitWithRedis(
  options: RateLimitOptions,
  redisUrl: string,
  redisToken: string,
): Promise<RateLimitResult> {
  validateOptions(options);

  const result = await getDistributedLimiter(
    options,
    redisUrl,
    redisToken,
  ).limit(options.key);
  const now = Date.now();

  if (result.reason === "timeout") {
    console.error("Distributed rate limit check timed out");
  }

  return {
    ok: result.success,
    limit: result.limit,
    remaining: result.remaining,
    resetAt: result.reset,
    retryAfterSeconds: Math.max(1, Math.ceil((result.reset - now) / 1000)),
  };
}

export async function rateLimit(
  options: RateLimitOptions,
): Promise<RateLimitResult> {
  const runtimeConfig: RateLimitRuntimeConfig = {
    nodeEnv: process.env.NODE_ENV,
    redisUrl: process.env.UPSTASH_REDIS_REST_URL,
    redisToken: process.env.UPSTASH_REDIS_REST_TOKEN,
  };
  const backend = resolveRateLimitBackend(runtimeConfig);

  if (backend === "memory") {
    return rateLimitInMemory(options);
  }

  return rateLimitWithRedis(
    options,
    runtimeConfig.redisUrl as string,
    runtimeConfig.redisToken as string,
  );
}

export function rateLimitHeaders(limiter: RateLimitResult) {
  return {
    "X-RateLimit-Limit": String(limiter.limit),
    "X-RateLimit-Remaining": String(limiter.remaining),
    "X-RateLimit-Reset": String(limiter.resetAt),
  };
}