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
  "nothing removed",
  "five zeros",
  "pure",
  "purity",
  "cleaner high",
  "fillers",
  "additives",
  "added terpenes",
  "exactly as it made it",
];

const heroLock =
  "Bond is 100 percent solventless live rosin, made without chemical solvents, added terpenes, distillate, fillers, or additives";

const privacyForm =
  "The Home Haus form stores nothing and sends nothing. Nothing else.";

const heroHash = "505ef54e1f3dca50cdffa9eb38103677de8ae74302f5b0ce97871bc0182ae948";
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
  const aliases = [
    ["/no-1", "No1.dc.html"],
    ["/No1.dc.html", "No1.dc.html"],
    ["/no-2", "No2.dc.html"],
    ["/No2.dc.html", "No2.dc.html"],
    ["/no-3", "No3.dc.html"],
    ["/No3.dc.html", "No3.dc.html"],
    ["/Home.dc.html", "Home.dc.html"],
    ["/FAQ.dc.html", "FAQ.dc.html"],
    ["/Privacy.dc.html", "Privacy.dc.html"],
    ["/Terms.dc.html", "Terms.dc.html"],
    ["/Finder.dc.html", "Finder.dc.html"],
    ["/AgeGate.dc.html", "AgeGate.dc.html"],
  ] as const;
  for (const pair of aliases) rows.push({ route: pair[0], files: [pair[1]] });
  return rows;
}

const coverPages = ["Home.dc.html", "No1.dc.html", "No2.dc.html", "No3.dc.html"];

function assertCoverFirst(name: string, html: string) {
  const head = html.slice(0, html.indexOf("</head>"));
  const bodyAt = html.indexOf("<body");
  const body = html.slice(bodyAt);
  const openEnd = body.indexOf(">");
  const after = body.slice(openEnd + 1).trimStart();
  assert.match(after, /^<div id="bond-gate-cover"/, name);
  assert.match(head, /id="bond-gate-boot"/, name);
  assert.match(head, /sessionStorage\.getItem\("bond_age_ok"\)/, name);
  assert.match(head, /#bond-gate-cover\{[^}]*background:#1B1D1C/, name);
  assert.equal(head.includes("--matte-black:#"), false, name);
  assert.equal(head.includes("var(--matte-black,"), false, name);
  assert.match(head, /body>\*:not\(#bond-gate-cover\)\{display:none !important\}/, name);
  assert.match(html, /This site is intended for adults 21 and older\. Please enable JavaScript to verify your age\./, name);
  assert.match(head, /pointer-events:auto/, name);
  assert.match(html, /id="bond-gate-hold"/, name);
  assert.match(html, /<x-dc inert>/, name);
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

test("every Home section is scanned and the product pages open on the cover", () => {
  const home = read("Home.dc.html");
  const sections = home.match(/<section\b[\s\S]*?<\/section>/g) ?? [];
  assert.ok(sections.length >= 5);
  assert.ok(sections.some((section) => section.includes('id="top"')));
  assert.ok(sections.some((section) => section.includes('id="process"')));
  for (const section of sections) {
    let text = section;
    if (section.includes('id="top"')) text = text.replace(heroLock, " ");
    text = normalize(text);
    for (const phrase of banned) {
      assert.equal(text.includes(phrase), false, phrase);
    }
  }
  for (const name of coverPages) assertCoverFirst(name, read(name));
  for (const name of ["FAQ.dc.html", "Privacy.dc.html", "Terms.dc.html", "Finder.dc.html"]) {
    const html = read(name);
    assert.match(html, /class="bond-floor" inert/, name);
    assert.match(html, /html:not\(\[data-bond-age="ok"\]\) \.bond-floor \{ visibility: hidden; \}/, name);
    assert.ok(html.indexOf('id="bond-age-gate"') < html.indexOf('class="bond-floor"'), name);
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
