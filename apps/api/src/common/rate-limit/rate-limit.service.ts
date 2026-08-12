import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
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

const UPSTASH_RATE_LIMIT_TIMEOUT_MS = 5000;

@Injectable()
export class RateLimitService {
  private readonly memoryStore = new Map<string, RateLimitEntry>();
  private readonly distributedLimiters = new Map<string, Ratelimit>();
  private redisClient: Redis | null = null;

  constructor(@Inject(ConfigService) private readonly config: ConfigService) {}

  async check(options: RateLimitOptions): Promise<RateLimitResult> {
    this.validateOptions(options);

    const nodeEnv = this.config.get<string>("NODE_ENV");
    const redisUrl = this.config.get<string>("UPSTASH_REDIS_REST_URL");
    const redisToken = this.config.get<string>("UPSTASH_REDIS_REST_TOKEN");
    const hasRedisUrl = Boolean(redisUrl?.trim());
    const hasRedisToken = Boolean(redisToken?.trim());

    if (hasRedisUrl !== hasRedisToken) {
      throw new Error(
        "Both UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be set",
      );
    }

    if (nodeEnv !== "production") {
      return this.checkMemory(options);
    }

    if (!hasRedisUrl || !hasRedisToken) {
      throw new Error(
        "Distributed rate limiting is required in production. Set the Upstash Redis environment variables.",
      );
    }

    return this.checkRedis(options, redisUrl as string, redisToken as string);
  }

  private checkMemory(options: RateLimitOptions): RateLimitResult {
    const now = Date.now();
    const existingEntry = this.memoryStore.get(options.key);

    if (!existingEntry || existingEntry.resetAt <= now) {
      const resetAt = now + options.windowMs;
      this.memoryStore.set(options.key, { count: 1, resetAt });

      return {
        ok: true,
        limit: options.maxRequests,
        remaining: Math.max(0, options.maxRequests - 1),
        resetAt,
        retryAfterSeconds: Math.ceil(options.windowMs / 1000),
      };
    }

    if (existingEntry.count >= options.maxRequests) {
      return {
        ok: false,
        limit: options.maxRequests,
        remaining: 0,
        resetAt: existingEntry.resetAt,
        retryAfterSeconds: Math.max(
          1,
          Math.ceil((existingEntry.resetAt - now) / 1000),
        ),
      };
    }

    existingEntry.count += 1;
    this.memoryStore.set(options.key, existingEntry);

    return {
      ok: true,
      limit: options.maxRequests,
      remaining: Math.max(0, options.maxRequests - existingEntry.count),
      resetAt: existingEntry.resetAt,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((existingEntry.resetAt - now) / 1000),
      ),
    };
  }

  private async checkRedis(
    options: RateLimitOptions,
    redisUrl: string,
    redisToken: string,
  ): Promise<RateLimitResult> {
    const limiter = this.getDistributedLimiter(options, redisUrl, redisToken);
    const result = await limiter.limit(options.key);
    const now = Date.now();

    return {
      ok: result.success,
      limit: result.limit,
      remaining: result.remaining,
      resetAt: result.reset,
      retryAfterSeconds: Math.max(1, Math.ceil((result.reset - now) / 1000)),
    };
  }

  private getDistributedLimiter(
    options: RateLimitOptions,
    redisUrl: string,
    redisToken: string,
  ) {
    const cacheKey = `${options.maxRequests}:${options.windowMs}`;
    const existingLimiter = this.distributedLimiters.get(cacheKey);

    if (existingLimiter) {
      return existingLimiter;
    }

    if (!this.redisClient) {
      this.redisClient = new Redis({
        url: redisUrl,
        token: redisToken,
        enableTelemetry: false,
      });
    }

    const limiter = new Ratelimit({
      redis: this.redisClient,
      limiter: Ratelimit.slidingWindow(
        options.maxRequests,
        `${options.windowMs} ms`,
      ),
      prefix: `hotel-system:rate-limit:${cacheKey}`,
      analytics: false,
      timeout: UPSTASH_RATE_LIMIT_TIMEOUT_MS,
    });
    this.distributedLimiters.set(cacheKey, limiter);

    return limiter;
  }

  private validateOptions(options: RateLimitOptions) {
    if (!options.key.trim()) {
      throw new Error("Rate limit key is required");
    }

    if (!Number.isInteger(options.windowMs) || options.windowMs <= 0) {
      throw new Error("Rate limit window must be a positive integer");
    }

    if (!Number.isInteger(options.maxRequests) || options.maxRequests <= 0) {
      throw new Error("Rate limit maximum must be a positive integer");
    }
  }
}
