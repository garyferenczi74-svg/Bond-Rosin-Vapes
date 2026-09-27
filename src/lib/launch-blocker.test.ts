import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

function read(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

const gone = [
  "Join for First Access",
  "Get first access to new drops",
  "be the first to know when your number arrives near you",
  "Retail waitlist open",
  "Announced first to the Haus",
  "Watch your inbox",
  "By joining, you agree to receive emails from Bond.",
  "Formulated for focus, clarity, and momentum.",
  "Focus. Clarity. Momentum.",
  "Elevated by nature",
  "Elevation. Take me further.",
  "Focus. I have somewhere to be.",
  "Stillness. The day is done.",
  "Release. Stillness. Restoration.",
  "Edge. Elevation. Expansion.",
  "focused, still, or elevated",
  "A focused expression",
  "Clarity. Momentum.",
  "Curated for clarity",
  "Bond with your potential.",
  "Bond with your edge.",
  "Higher presence. Deepest expression.",
  "Intense by design",
  "Midnight Zkittlez",
  "The house keeps no copy",
  "No Metrc write",
  "if member accounts launch",
  "a cookie on your device for 30 days",
];

test("launch blocker copy is replaced on Home No1 and No3", () => {
  const home = read("Home.dc.html");
  const no1 = read("No1.dc.html");
  const no3 = read("No3.dc.html");
  const pages = home + "\n" + no1 + "\n" + no3;
  for (const line of gone) {
    if (line === "No Metrc write" || line === "Midnight Zkittlez" || line === "The house keeps no copy") continue;
    if (line === "if member accounts launch" || line === "a cookie on your device for 30 days") continue;
    assert.equal(pages.includes(line), false, line);
  }
  assert.match(home, /Nothing can be reserved right now\. Check back here\./);
  assert.match(home, /Daytime\. Bright\. Crisp\./);
  assert.match(home, /Evening\. Soft\. Round\./);
  assert.match(home, /Reserve Edition\. Solventless live rosin\./);
  assert.match(home, /Which number are you meeting\?/);
  assert.match(home, /No\. 1\. A daytime number\./);
  assert.match(home, /Bond with No\. 1\./);
  assert.equal(home.includes("bond_circle"), false);
  assert.match(home, />Haus</);
  assert.equal(home.includes(">Admin<"), false);
  assert.match(home, /transition-property: opacity/);
  assert.match(no1, /Daytime\. Bright\. Crisp\./);
  assert.match(no1, /PURE CONSUMPTION<br>DAYTIME/);
  assert.match(no1, /No\. 1 is the daytime number in Bond's solventless live rosin collection\./);
  assert.match(no3, /Reserve Edition\. Solventless live rosin\./);
  assert.equal(no3.includes("Elevated by nature"), false);
  assert.equal(no3.includes("Alpine"), false);
});

test("privacy age flag matches sessionStorage and the Haus records section stays", () => {
  const privacy = read("Privacy.dc.html");
  assert.match(
    privacy,
    /we store a flag in sessionStorage for this browser session, under the name bond_age_ok/,
  );
  assert.match(privacy, /It is not a cookie and it is not kept for 30 days\./);
  assert.equal(privacy.includes("if member accounts launch"), false);
  assert.equal(privacy.includes("a cookie on your device for 30 days"), false);
  assert.match(privacy, /Bond does not sell member data\./);
  assert.match(
    privacy,
    /On the Next door the confirmation, with a note that you have seen the welcome, is kept in a cookie for one year\. Signing out does not clear that cookie\./,
  );
  assert.match(privacy, /\[PRIVACY EMAIL\]/);
});

test("order portal says nothing is sent to the state tracking system", () => {
  const copy = read("src/lib/order/copy.ts");
  const client = read("src/app/order/order-client.tsx");
  assert.match(copy, /Nothing is sent to the state tracking system from this page/);
  assert.match(client, /Nothing is sent to the state tracking system from this page/);
  assert.equal(copy.includes("No Metrc write"), false);
  assert.equal(client.includes("No Metrc write"), false);
  assert.equal(client.includes("no Metrc write"), false);
});

test("Haus admin erase line and cultivar name are corrected", () => {
  const admin = read("HausAdmin.dc.html");
  const seed = read("src/lib/haus/seed.ts");
  assert.match(admin, /toast\('Erased\.'\)/);
  assert.equal(admin.includes("keeps no copy"), false);
  assert.equal(admin.includes("Midnight Zkittlez"), false);
  assert.equal(seed.includes("Midnight Zkittlez"), false);
  assert.match(seed, /Sample batch/);
  assert.match(admin, /Sample batch/);
  assert.equal(seed.includes("Alpine Reserve"), false);
  assert.equal(admin.includes("Alpine Reserve"), false);
});
