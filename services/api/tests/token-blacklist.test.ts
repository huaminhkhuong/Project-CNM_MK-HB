/**
 * Test Suite: Token Blacklist on Logout (Step 4)
 * Tests POST /api/auth/logout and ensures blacklisted refresh tokens
 * return 401 on POST /api/auth/refresh.
 */
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";

const BASE = process.env.API_BASE_URL ?? "http://localhost:4000";

// ─── helpers ────────────────────────────────────────────────────────────────

async function request(method: string, path: string, body?: unknown) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, body: json };
}

async function register(suffix: string) {
  const ts = Date.now();
  const email = `blacklist_test_${suffix}_${ts}@example.com`;
  // Generate a unique phone: 09 + last 8 digits of timestamp (ensures >=10 chars)
  const phone = `09${String(ts).slice(-8)}`;
  const r = await request("POST", "/api/auth/register", {
    email,
    password: "Test@1234",
    fullName: "Blacklist Test",
    phone,
  });
  assert.equal(r.status, 201, `register failed: ${JSON.stringify(r.body)}`);
  return r.body.data as { refreshToken: string; accessToken: string };
}

// ─── tests ──────────────────────────────────────────────────────────────────

describe("Token Blacklist on Logout", () => {

  test("POST /api/auth/logout without refreshToken returns 400", async () => {
    const r = await request("POST", "/api/auth/logout", {});
    assert.equal(r.status, 400);
  });

  test("POST /api/auth/logout with valid refreshToken returns 200 loggedOut=true", async () => {
    const tokens = await register("logout_200");
    const r = await request("POST", "/api/auth/logout", {
      refreshToken: tokens.refreshToken,
    });
    assert.equal(r.status, 200);
    assert.equal(r.body.data?.loggedOut, true);
  });

  test("POST /api/auth/refresh after logout returns 401", async () => {
    const tokens = await register("blacklisted");
    // First refresh should work before logout
    const pre = await request("POST", "/api/auth/refresh", {
      refreshToken: tokens.refreshToken,
    });
    assert.equal(pre.status, 200, "pre-logout refresh should succeed");

    // Logout — blacklists the token
    const logoutRes = await request("POST", "/api/auth/logout", {
      refreshToken: tokens.refreshToken,
    });
    assert.equal(logoutRes.status, 200);

    // Now the same refresh token must be rejected
    const post = await request("POST", "/api/auth/refresh", {
      refreshToken: tokens.refreshToken,
    });
    assert.equal(post.status, 401, `expected 401 after logout, got ${post.status}: ${JSON.stringify(post.body)}`);
  });

  test("POST /api/auth/logout is idempotent (double logout returns 200)", async () => {
    const tokens = await register("idempotent");
    const r1 = await request("POST", "/api/auth/logout", { refreshToken: tokens.refreshToken });
    const r2 = await request("POST", "/api/auth/logout", { refreshToken: tokens.refreshToken });
    assert.equal(r1.status, 200);
    assert.equal(r2.status, 200);
  });

  test("Refresh with a completely invalid token returns 401", async () => {
    const r = await request("POST", "/api/auth/refresh", {
      refreshToken: "this.is.not.valid",
    });
    assert.equal(r.status, 401);
  });

});