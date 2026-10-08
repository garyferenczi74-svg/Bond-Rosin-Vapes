import assert from "node:assert/strict";
import test from "node:test";
import { registerPartnerDoor } from "../order/door.ts";
import { clonePartnerAccounts, SEED_PARTNER_PASSWORD } from "../order/seed.ts";
import { openSessionId, sealSessionId } from "./cookie.ts";
import { MemorySignupStore } from "./memory.ts";

test("a new dispensary stays pending and a tampered cookie cannot approve it", async () => {
  const store = new MemorySignupStore();
  const rows = clonePartnerAccounts();
  const bound = registerPartnerDoor(
    {
      dispensaryName: "Harbor House",
      address: "18 Harbor Street, Albany, NY 12207",
      contactName: "Harbor Buyer",
      phone: "518-555-0199",
      email: "harbor.buyer@example.test",
      license: "OCM-HARBOR-19",
      password: "Harbor-Pass-21",
      confirm: "Harbor-Pass-21",
      age21: true,
    },
    rows,
  );
  assert.equal(bound.ok, true);
  if (!bound.ok) return;
  const created = rows[rows.length - 1];
  assert.ok(created);
  const stored = await store.insertDispensary({
    dispensaryName: created.dispensaryName,
    address: created.address,
    contactName: created.contactName,
    phone: created.phone,
    ocmLicense: created.license,
    email: created.email,
    passwordHash: created.passwordHash,
    passwordSalt: created.passwordSalt,
    age21AckAt: "2026-10-08T00:00:00.000Z",
  });
  assert.equal(stored.status, "pending");
  assert.equal(stored.passwordHash.includes("Harbor-Pass-21"), false);

  const sessionId = await store.openDispensarySession(stored.id);
  const sealed = sealSessionId(sessionId);
  const opened = await store.accountForDispensarySession(openSessionId(sealed) ?? "");
  assert.equal(opened?.status, "pending");
  assert.equal(openSessionId(JSON.stringify({ elevated: true, status: "approved" })), null);
  assert.equal(openSessionId(`${sealed}tamper`), null);

  assert.throws(
    () =>
      store.insertOrder({
        dispensaryAccountId: stored.id,
        lines: [{ skuId: "no-1", format: "1g", qty: 1 }],
        promisedOn: "2026-10-12",
        notes: "",
      }),
    /not approved/,
  );
});

test("an approved server row can file an order and Haus membership is the sign-up row", async () => {
  const store = new MemorySignupStore();
  const rows = await store.listAccounts();
  const north = rows.find((row) => row.email === "north.buyer@example.test");
  assert.ok(north);
  assert.equal(north.status, "approved");
  assert.equal(north.passwordHash.includes(SEED_PARTNER_PASSWORD), false);

  const sessionId = await store.openDispensarySession(north.id);
  const filed = await store.insertOrder({
    dispensaryAccountId: north.id,
    lines: [{ skuId: "no-2", format: "1g", qty: 2 }],
    promisedOn: "2026-10-20",
    notes: "Receiving dock",
  });
  assert.equal(filed.lines.some((line) => "metrcUid" in line), false);
  const account = await store.accountForDispensarySession(sessionId);
  assert.equal(account?.status, "approved");

  const hausId = await store.openHausSession("member@bond.test");
  assert.equal((await store.readHausSession(hausId))?.signup, null);
  const signup = await store.recordHausSignup("member@bond.test");
  const view = await store.readHausSession(hausId);
  assert.equal(view?.email, "member@bond.test");
  assert.equal(view?.signup?.id, signup.id);
  assert.ok(view?.signup?.age21AckAt);
  await store.closeHausSession(hausId);
  assert.equal(await store.readHausSession(hausId), null);
  assert.equal((await store.ledger()).haus.some((row) => row.email === "member@bond.test"), true);
});
