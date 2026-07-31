import { describe, expect, it, beforeEach } from "vitest";
import {
  __resetRateLimitForTests,
  rateLimit,
} from "./rate-limit";

describe("rateLimit", () => {
  beforeEach(() => {
    __resetRateLimitForTests();
  });

  it("allows up to the limit then blocks", () => {
    expect(rateLimit("a", 2, 60_000).ok).toBe(true);
    expect(rateLimit("a", 2, 60_000).ok).toBe(true);
    const blocked = rateLimit("a", 2, 60_000);
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.retryAfterSec).toBeGreaterThan(0);
  });

  it("isolates keys", () => {
    expect(rateLimit("x", 1, 60_000).ok).toBe(true);
    expect(rateLimit("y", 1, 60_000).ok).toBe(true);
    expect(rateLimit("x", 1, 60_000).ok).toBe(false);
  });
});
