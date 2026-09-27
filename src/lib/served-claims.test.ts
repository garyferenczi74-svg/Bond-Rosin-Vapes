import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { WARNING_ROUTES } from "./bond-warnings.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

function read(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

const banned = [
  "nothing else",
  "no fillers",
  "no additives",
  "nothing added",
  "five zeros",
  "pure",
  "purity",
  "cleaner high",
];

const heroLock =
  "Bond is 100 percent solventless live rosin, made without chemical solvents, added terpenes, distillate, fillers, or additives";

const privacyForm =
  "The Home Haus form stores nothing and sends nothing. Nothing else.";

const heroHash = "265db66a936309c5852cf9718adc0ea41b216620f95e13246a842ba1b270d3dc";
const videoHash = "3a0e46818304d3980f2202950372e5aea6b1cfe59f313ebbe203aa42634513e3";

function normalize(html: string) {
  return html.replace(/<br\s*\/?>/gi, " ").replace(/\s+/g, " ").toLowerCase();
}

function reactFiles(route: string) {
  if (route === "/order") {
    return [
      "src/app/order/page.tsx",
      "src/app/order/order-client.tsx",
      "src/app/order/layout.tsx",
      "src/lib/order/copy.ts",
      "src/components/bond-age-gate.tsx",
      "src/components/age-gate-shell.tsx",
    ];
  }
  if (route === "/haus") {
    return [
      "src/app/haus/page.tsx",
      "src/app/haus/haus-client.tsx",
      "src/app/haus/layout.tsx",
      "src/components/bond-age-gate.tsx",
      "src/components/age-gate-shell.tsx",
    ];
  }
  if (route === "/haus/welcome") {
    return [
      "src/app/haus/welcome/page.tsx",
      "src/app/haus/welcome-client.tsx",
      "src/app/haus/layout.tsx",
      "src/components/bond-age-gate.tsx",
      "src/components/age-gate-shell.tsx",
    ];
  }
  return [];
}

function routeFiles() {
  const rows = WARNING_ROUTES.map((row) => ({
    route: row.route,
    files: row.file ? [row.file] : reactFiles(row.route),
  }));
  rows.push({ route: "/no-1", files: ["No1.dc.html"] });
  rows.push({ route: "/No1.dc.html", files: ["No1.dc.html"] });
  return rows;
}

function servedText(files: string[]) {
  let text = files.map((file) => read(file)).join("\n");
  if (files.includes("Home.dc.html")) {
    assert.equal(text.includes(heroLock), true);
    text = text.replace(heroLock, " ");
  }
  if (files.includes("Privacy.dc.html")) {
    assert.equal(text.includes(privacyForm), true);
    text = text.replace(privacyForm, " ");
  }
  return normalize(text);
}

test("served routes reject unfinished purity claims", () => {
  for (const row of routeFiles()) {
    assert.ok(row.files.length > 0, row.route);
    const text = servedText(row.files);
    for (const phrase of banned) {
      assert.equal(text.includes(phrase), false, `${row.route} ${phrase}`);
    }
  }
});

test("faq answer names only the two zero claims", () => {
  const faq = read("FAQ.dc.html");
  assert.match(faq, /<p>No chemical solvents\. No distillate\.<\/p>/);
  assert.equal(faq.includes("Five zeros"), false);
  assert.equal(faq.includes("Nothing else added"), false);
});

test("home hero lock and video policy stay byte identical", () => {
  const home = read("Home.dc.html");
  const start = home.indexOf('<section id="top"');
  const end = home.indexOf("</section>", start);
  const section = home.slice(start, end + "</section>".length);
  assert.equal(createHash("sha256").update(section).digest("hex"), heroHash);
  assert.equal(createHash("sha256").update(read("video-policy.js")).digest("hex"), videoHash);
  assert.match(home, /\.hero-tagline h1 \{[^}]*font-weight: 500/);
});

test("staff page view records role and an unconfirmed factor is reused", () => {
  const page = read("src/app/vauxhall/[[...slug]]/page.tsx");
  assert.match(page, /actor: session\.userId/);
  assert.match(page, /role: session\.role/);
  assert.match(page, /readRequestMeta\(route\.path\)/);
  const actions = read("src/app/haus/actions.ts");
  assert.match(actions, /factorId: unverified\[0\]\.id/);
  assert.match(actions, /qr: null as string \| null/);
  const audit = read("src/lib/audit.ts");
  assert.match(audit, /ip: payload\.meta\.ip/);
  assert.match(audit, /user_agent: payload\.meta\.userAgent/);
  assert.match(audit, /path: payload\.meta\.path/);
});
