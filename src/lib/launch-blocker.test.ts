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
  assert.match(home, /Daytime\. Solventless live rosin\./);
  assert.match(home, /Evening\. Solventless live rosin\./);
  assert.match(home, /Reserve Edition\. Solventless live rosin\./);
  assert.equal(home.includes("Reserve Edition. Reserve Edition."), false);
  assert.match(home, /Which number are you meeting\?/);
  assert.match(home, /No\. 1\. A daytime number\./);
  assert.match(home, /Bond with No\. 1\./);
  assert.equal(home.includes("bond_circle"), false);
  assert.match(home, />Haus</);
  assert.equal(home.includes(">Admin<"), false);
  assert.match(home, /transition-property: opacity/);
  assert.match(no1, /Daytime\. Solventless live rosin\./);
  assert.match(no1, /LIVE ROSIN<br>DAYTIME/);
  assert.equal(no1.includes("PURE CONSUMPTION"), false);
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
  assert.match(privacy, /optional notes on a batch you shelve/);
  assert.equal(privacy.includes("optional tasting notes"), false);
  assert.equal(privacy.includes("erase tasting notes"), false);
  assert.match(privacy, /which chapter of The Number Guide you last opened/);
  assert.equal(privacy.includes("Experience Guide"), false);
  assert.equal(privacy.includes("email delivery"), false);
  assert.match(privacy, /\(hosting, analytics\)/);
  assert.equal(privacy.includes("Correspondence preference"), false);
  assert.match(privacy, /Bond does not store a Haus correspondence preference/);
  assert.match(privacy, /There is no Bond Haus email list/);
  assert.match(privacy, /While waiver W-2026-09-15-P1-OVERRIDE is on/);
  assert.match(privacy, /the Haus door does not ask for an authenticator code and stores none/);
  assert.match(privacy, /factor named Bond Haus/);
  assert.match(privacy, /Bond does not set a time limit on the factor or on mfa_enrolled/);
  assert.match(privacy, /Effective date: September 27, 2026\./);
  assert.match(read("Terms.dc.html"), /Effective date: September 27, 2026\./);
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
  assert.match(seed, /Sample batch A/);
  assert.match(seed, /Sample batch C/);
  assert.match(seed, /Sample batch D/);
  assert.match(seed, /Sample batch E/);
  assert.match(admin, /Sample batch A/);
  assert.match(admin, /Sample batch B/);
  assert.match(admin, /Sample batch C/);
  assert.match(admin, /Sample batch D/);
  assert.match(admin, /Sample batch E/);
  assert.equal(seed.includes("Alpine Reserve"), false);
  assert.equal(admin.includes("Alpine Reserve"), false);
  for (const invented of [
    "Sunrise Runtz",
    "Evening Papaya",
    "Autumn Gelato",
    "Morning Mimosa",
    "Lavender",
    "Bergamot",
    "Chamomile",
    "Clove",
    "Sandalwood",
    "Musk",
    "Gardenia",
    "Fennel",
    "Stone fruit",
    "Cardamom",
    "Loam",
    "COA-0518",
    "COA-0731",
    "COA-0214",
    "COA-0198",
    "Terpene notes",
  ]) {
    assert.equal(seed.includes(invented), false, invented);
    assert.equal(admin.includes(invented), false, invented);
    assert.equal(read("Haus.dc.html").includes(invented), false, invented);
  }
  assert.equal(read("Haus.dc.html").includes("circleCorrespondence"), false);
  assert.equal(read("Haus.dc.html").includes("prefHaus"), false);
  assert.equal(read("Haus.dc.html").includes("Haus correspondence"), false);
});

test("process label, HOPEline short code, and license case stay on the served pages", () => {
  const hope = "texting HOPENY (467369)";
  const license = "OCM-PROC-25-000329";
  for (const name of ["Home.dc.html", "No1.dc.html", "No2.dc.html", "No3.dc.html", "Finder.dc.html", "FAQ.dc.html", "Privacy.dc.html", "Terms.dc.html"]) {
    const html = read(name);
    assert.equal(html.includes(hope), true, name);
    assert.equal(html.includes("texting HOPENY,"), false, name);
    assert.equal(html.includes(license), true, name);
    assert.equal(html.includes("OCM-Proc-25-000329"), false, name);
    assert.equal(html.includes("tel:18778467369"), true, name);
    assert.equal(html.includes("https://oasas.ny.gov/hopeline"), true, name);
    assert.equal(html.includes("1-877-8-HOPENY"), true, name);
  }
  for (const name of ["No1.dc.html", "No2.dc.html", "No3.dc.html"]) {
    const html = read(name);
    assert.equal(html.includes('data-screen-label="Process"'), true, name);
    assert.equal(html.includes('data-screen-label="Purity"'), false, name);
    assert.equal(html.includes("THE PRODUCT IS PURE"), false, name);
  }
  assert.equal(read("No2.dc.html").includes(">Process</div>"), true);
  assert.equal(read("No3.dc.html").includes(">SOLVENTLESS LIVE ROSIN</span>"), true);
  assert.equal(read("No3.dc.html").includes(">SOLVENTLESS LIVE ROSIN</span><br>"), false);
});
