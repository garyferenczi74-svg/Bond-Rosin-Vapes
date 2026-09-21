import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { lockoutFallback, readLockoutState, recordAuthAttempt } from "./lockout.ts";
import {
  assertServiceRoleServerOnly,
  createSupabaseServiceRole,
  readServiceRoleConfig,
  SUPABASE_SERVICE_ROLE_KEY,
} from "./supabase/service.ts";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "../..");

function read(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

function walk(rel: string, visit: (path: string, text: string) => void): void {
  const full = join(root, rel);
  const stat = statSync(full);
  if (stat.isDirectory()) {
    for (const name of readdirSync(full)) walk(join(rel, name), visit);
    return;
  }
  if (!/\.(ts|tsx|js|mjs|md|example)$/.test(full) || full.endsWith(".test.ts")) return;
  visit(rel, readFileSync(full, "utf8"));
}

const sampleEnv = {
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
};

test("service role config stays server-only and never names the key in errors", () => {
  assert.equal(typeof window, "undefined");
  assert.doesNotThrow(() => assertServiceRoleServerOnly());

  const missing = readServiceRoleConfig({});
  assert.equal(missing.ok, false);
  if (!missing.ok) {
    assert.match(missing.reason, /not configured/);
    assert.equal(missing.reason.includes("test-service-role-key"), false);
    assert.equal(missing.reason.includes(SUPABASE_SERVICE_ROLE_KEY), false);
  }

  const ready = readServiceRoleConfig(sampleEnv);
  assert.equal(ready.ok, true);
  if (ready.ok) {
    assert.equal(ready.url, sampleEnv.NEXT_PUBLIC_SUPABASE_URL);
    assert.equal(ready.key, sampleEnv.SUPABASE_SERVICE_ROLE_KEY);
  }

  assert.throws(
    () => createSupabaseServiceRole({}),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /not configured/);
      assert.equal(error.message.includes(sampleEnv.SUPABASE_SERVICE_ROLE_KEY), false);
      return true;
    },
  );
});

test("service role client is created without a user cookie session", () => {
  const client = createSupabaseServiceRole(sampleEnv);
  assert.equal(typeof client.rpc, "function");
  assert.equal(client.supabaseUrl, sampleEnv.NEXT_PUBLIC_SUPABASE_URL);
});

test("recordAuthAttempt fail-opens when service role env is missing", async () => {
  const prevUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const prevKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  try {
    assert.deepEqual(await recordAuthAttempt("ops@bond.test", "1.1.1.1", "check"), {
      allowed: false,
      locked: false,
    });
    assert.deepEqual(await recordAuthAttempt("ops@bond.test", "1.1.1.1", "success"), {
      allowed: true,
      locked: false,
    });
    assert.deepEqual(await recordAuthAttempt("ops@bond.test", null, "fail"), {
      allowed: false,
      locked: false,
    });
  } finally {
    if (prevUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = prevUrl;
    if (prevKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = prevKey;
  }
});

test("recordAuthAttempt posts record_auth_attempt with the service role key", async () => {
  const prevUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const prevKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const prevFetch = globalThis.fetch;
  process.env.NEXT_PUBLIC_SUPABASE_URL = sampleEnv.NEXT_PUBLIC_SUPABASE_URL;
  process.env.SUPABASE_SERVICE_ROLE_KEY = sampleEnv.SUPABASE_SERVICE_ROLE_KEY;

  const calls: Array<{ url: string; headers: Record<string, string>; body: string }> = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    const packed: Record<string, string> = {};
    headers.forEach((value, key) => {
      packed[key.toLowerCase()] = value;
    });
    calls.push({
      url: String(input),
      headers: packed,
      body: typeof init?.body === "string" ? init.body : "",
    });
    return new Response(JSON.stringify({ allowed: false, locked: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;

  try {
    const result = await recordAuthAttempt("ops@bond.test", "203.0.113.9", "check");
    const rpc = calls.find((call) => call.url.includes("/rest/v1/rpc/record_auth_attempt"));
    assert.ok(rpc, "expected record_auth_attempt RPC");
    assert.equal(rpc.headers.apikey, sampleEnv.SUPABASE_SERVICE_ROLE_KEY);
    assert.equal(rpc.headers.authorization, `Bearer ${sampleEnv.SUPABASE_SERVICE_ROLE_KEY}`);
    assert.equal(rpc.headers.apikey.includes("anon"), false);
    const payload = JSON.parse(rpc.body) as { p_email: string; p_ip: string; p_outcome: string };
    assert.deepEqual(payload, {
      p_email: "ops@bond.test",
      p_ip: "203.0.113.9",
      p_outcome: "check",
    });
    assert.deepEqual(result, { allowed: false, locked: true });
  } finally {
    globalThis.fetch = prevFetch;
    if (prevUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = prevUrl;
    if (prevKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = prevKey;
  }
});

test("lockout result helper keeps the existing fail-open shape", () => {
  assert.deepEqual(lockoutFallback("check"), { allowed: false, locked: false });
  assert.deepEqual(lockoutFallback("success"), { allowed: true, locked: false });
  assert.deepEqual(readLockoutState(null, "fail"), { allowed: false, locked: false });
  assert.deepEqual(readLockoutState({ allowed: true, locked: false }, "check"), {
    allowed: true,
    locked: false,
  });
});

test("/haus lockout writes use the service role client only", () => {
  const lockout = read("src/lib/lockout.ts");
  const service = read("src/lib/supabase/service.ts");
  const actions = read("src/app/haus/actions.ts");

  assert.match(service, /createClient<Database>/);
  assert.match(service, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(service, /persistSession: false/);
  assert.equal(service.includes("NEXT_PUBLIC_SUPABASE_SERVICE"), false);
  assert.equal(service.includes("createServerClient"), false);
  assert.equal(service.includes("console.log"), false);
  assert.equal(service.includes("console.error"), false);

  assert.match(lockout, /createSupabaseServiceRole/);
  assert.match(lockout, /record_auth_attempt/);
  assert.equal(lockout.includes("createSupabaseServer"), false);
  assert.equal(lockout.includes("NEXT_PUBLIC_SUPABASE_ANON_KEY"), false);

  const recordCalls = [...actions.matchAll(/recordAuthAttempt\(([^)]*)\)/g)].map((m) => m[1]);
  assert.ok(recordCalls.length >= 5);
  for (const args of recordCalls) {
    assert.equal(args.includes("supabase"), false, args);
    assert.match(args, /email,\s*meta\.ip,/);
  }

  assert.match(actions, /supabase\.rpc\("mark_admin_mfa_enrolled"\)/);
  assert.equal(actions.includes('rpc("is_admin")'), false);
  assert.equal(actions.includes('rpc("admin_role")'), false);
  assert.equal(actions.includes("createSupabaseServiceRole"), false);
});

test("service role key never lands in browser or NEXT_PUBLIC_ surfaces", () => {
  const hits: string[] = [];
  const secret = /SUPABASE_SERVICE_ROLE_KEY|createSupabaseServiceRole/;
  for (const dir of ["src/components", "src/app/order", "src/lib/order"]) {
    walk(dir, (path, text) => {
      if (secret.test(text)) hits.push(path);
    });
  }
  walk("src/lib/supabase/server.ts", (path, text) => {
    if (secret.test(text)) hits.push(path);
  });
  walk("src/lib/supabase/middleware.ts", (path, text) => {
    if (secret.test(text)) hits.push(path);
  });
  const envExample = read(".env.example");
  assert.match(envExample, /# SUPABASE_SERVICE_ROLE_KEY=/);
  assert.equal(envExample.includes("NEXT_PUBLIC_SUPABASE_SERVICE"), false);
  assert.deepEqual(hits, []);
});
