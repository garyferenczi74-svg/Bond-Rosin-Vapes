import assert from "node:assert/strict";
import test from "node:test";
import { writeAudit } from "./audit.ts";
import { hashLockoutIp } from "./lockout.ts";

const meta = {
  ip: "203.0.113.9",
  userAgent: "BondTest",
  path: "/haus",
};

function fakeClient(rows: Array<Record<string, unknown>>) {
  return {
    from(table: string) {
      assert.equal(table, "audit_log");
      return {
        async insert(row: Record<string, unknown>) {
          rows.push(row);
          return { error: null };
        },
      };
    },
  };
}

test("writeAudit stores the keyed IP digest and not the raw address", async () => {
  const prev = process.env.BOND_HASH_KEY;
  process.env.BOND_HASH_KEY = "audit-test-key";
  const rows: Array<Record<string, unknown>> = [];
  try {
    await writeAudit(fakeClient(rows) as never, {
      actor: "11111111-1111-1111-1111-111111111111",
      action: "admin.sign_in",
      target: "vauxhall",
      before: null,
      after: { role: "owner" },
      meta,
    });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].ip, hashLockoutIp("203.0.113.9", "audit-test-key"));
    assert.equal(String(rows[0].ip).includes("203.0.113.9"), false);
    assert.equal(rows[0].user_agent, "BondTest");
    assert.equal(rows[0].path, "/haus");
  } finally {
    if (prev === undefined) delete process.env.BOND_HASH_KEY;
    else process.env.BOND_HASH_KEY = prev;
  }
});

test("writeAudit fails closed in production when BOND_HASH_KEY is missing", async () => {
  const prevNode = process.env.NODE_ENV;
  const prevHash = process.env.BOND_HASH_KEY;
  process.env.NODE_ENV = "production";
  delete process.env.BOND_HASH_KEY;
  let inserted = false;
  const client = {
    from() {
      return {
        async insert() {
          inserted = true;
          return { error: null };
        },
      };
    },
  };
  try {
    await assert.rejects(
      () =>
        writeAudit(client as never, {
          actor: "11111111-1111-1111-1111-111111111111",
          action: "admin.view_wing",
          target: "haus",
          before: null,
          after: null,
          meta,
        }),
      /BOND_HASH_KEY is not configured/,
    );
    assert.equal(inserted, false);
  } finally {
    if (prevNode === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = prevNode;
    if (prevHash === undefined) delete process.env.BOND_HASH_KEY;
    else process.env.BOND_HASH_KEY = prevHash;
  }
});
