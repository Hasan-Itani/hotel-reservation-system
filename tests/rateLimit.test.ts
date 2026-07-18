import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  rateLimitHeaders,
  rateLimitInMemory,
  resolveRateLimitBackend,
} from "../lib/rateLimit";

describe("rate limiting", () => {
  it("uses memory locally when Redis is not configured", () => {
    assert.equal(resolveRateLimitBackend({ nodeEnv: "development" }), "memory");
    assert.equal(resolveRateLimitBackend({ nodeEnv: "test" }), "memory");
  });

  it("uses Redis when both credentials are configured", () => {
    assert.equal(
      resolveRateLimitBackend({
        nodeEnv: "production",
        redisUrl: "https://example.upstash.io",
        redisToken: "token",
      }),
      "redis",
    );
  });

  it("rejects incomplete or missing production Redis configuration", () => {
    assert.throws(
      () =>
        resolveRateLimitBackend({
          nodeEnv: "development",
          redisUrl: "https://example.upstash.io",
        }),
      /Both UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN/,
    );
    assert.throws(
      () => resolveRateLimitBackend({ nodeEnv: "production" }),
      /Distributed rate limiting is required in production/,
    );
  });

  it("enforces the local fallback limit and resets after the window", () => {
    const options = {
      key: `test:${Date.now()}:${Math.random()}`,
      windowMs: 1000,
      maxRequests: 2,
    };
    const start = 10_000;

    assert.deepEqual(rateLimitInMemory(options, start), {
      ok: true,
      limit: 2,
      remaining: 1,
      resetAt: 11_000,
      retryAfterSeconds: 1,
    });
    assert.equal(rateLimitInMemory(options, start + 100).ok, true);
    assert.equal(rateLimitInMemory(options, start + 200).ok, false);
    assert.equal(rateLimitInMemory(options, start + 1000).ok, true);
  });

  it("creates rate limit response headers", () => {
    assert.deepEqual(
      rateLimitHeaders({
        ok: false,
        limit: 5,
        remaining: 0,
        resetAt: 12345,
        retryAfterSeconds: 30,
      }),
      {
        "X-RateLimit-Limit": "5",
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": "12345",
      },
    );
  });
});