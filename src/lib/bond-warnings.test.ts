import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  D_LINES,
  LICENSE_LINE,
  WARNING_C1,
  WARNING_ROUTES,
  dLineForRoute,
  footerWarnBlockHtml,
  warnBlockForRoute,
  warnBlockHtml,
  warningRouteForPath,
} from "./bond-warnings.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

function read(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

test("each route gets one rotating (d) warning and the slots stay even", () => {
  assert.equal(WARNING_ROUTES.length, 12);
  const counts = [0, 0, 0, 0];
  for (const row of WARNING_ROUTES) {
    counts[row.d - 1] += 1;
    assert.equal(dLineForRoute(row.route), D_LINES[row.d - 1], row.label);
  }
  assert.deepEqual(counts, [3, 3, 3, 3]);
  assert.equal(warningRouteForPath("/haus/welcome"), "/haus/welcome");
  assert.equal(warningRouteForPath("/haus/salon"), "/haus/floor");
  assert.equal(warningRouteForPath("/haus"), "/haus");
  assert.equal(warningRouteForPath("/order"), "/order");
  assert.equal(warningRouteForPath("/No2"), "/no2");
});

test("gate and footer share one warning block and one css rule", () => {
  const css = read("bond-age-gate.css");
  const boxRules = css.split(".bond-warn-box {").length - 1;
  assert.equal(boxRules, 1);
  assert.match(css, /\.bond-warn-box \{[^}]*background: var\(--bond-warning-yellow\)/);
  assert.match(css, /\.bond-warn-box \{[^}]*color: var\(--matte-black\)/);
  assert.match(css, /\.bond-warn-box \{[^}]*border: 1px solid var\(--matte-black\)/);
  assert.match(css, /\.bond-warn-box p \{[^}]*font-family: Arial, Helvetica, sans-serif/);
  assert.match(css, /\.bond-warn-box p \{[^}]*font-size: 9px/);
  assert.match(css, /\.bond-warn-hope,\s*\.bond-warn-hope a,\s*\.bond-warn-license \{[^}]*font-size: 9px/);
  assert.match(css, /\.bond-warn-box p \{[^}]*color: var\(--matte-black\)/);
  assert.equal(css.includes(".bond-age-health"), false);

  const gate = read("src/components/bond-age-gate.tsx");
  const band = read("src/components/compliance-band.tsx");
  const warn = read("src/components/bond-warn.tsx");
  assert.match(gate, /<BondWarn route=\{route\} \/>/);
  assert.match(band, /<BondWarn route=\{route\} holdLicense \/>/);
  assert.match(band, /warningRouteForPath/);
  assert.match(warn, /WARNING_C1/);
  assert.match(warn, /dLineForRoute/);
  assert.match(warn, /className="bond-warn-box"/);
  assert.match(warn, /className="bond-warn-hope"/);
  assert.match(warn, /className="bond-warn-license"/);
  for (const line of D_LINES) {
    assert.equal(warn.includes(line), false, line);
    assert.equal(band.includes(line), false, line);
    assert.equal(gate.includes(line), false, line);
  }

  const ageGate = read("AgeGate.dc.html");
  assert.equal(ageGate.includes(warnBlockHtml("{{ warn }}")), true);
  assert.equal(ageGate.includes('this.props.warn || "Cannabis can be addictive."'), true);
  assert.equal(ageGate.includes("bond-age-health"), false);

  for (const row of WARNING_ROUTES) {
    if (!row.file) continue;
    const html = read(row.file);
    const block = warnBlockForRoute(row.route);
    const copies = html.split(block).length - 1;
    const expected = row.gate === "inline" || row.gate === "import" ? 2 : 1;
    const footerFiles = new Set([
      "FAQ.dc.html",
      "No1.dc.html",
      "No2.dc.html",
      "No3.dc.html",
      "Finder.dc.html",
      "Privacy.dc.html",
      "Terms.dc.html",
    ]);
    if (footerFiles.has(row.file)) {
      assert.equal(copies, 1, row.file);
      const footerBlock = footerWarnBlockHtml(dLineForRoute(row.route));
      assert.equal(html.split(footerBlock).length - 1, 1, row.file);
      const license = footerBlock.match(/<p class="bond-warn-license">([\s\S]*?)<\/p>/);
      assert.ok(license, row.file);
      assert.equal(license[1].replace(/<[^>]+>/g, ""), LICENSE_LINE, row.file);
    } else {
      assert.equal(copies, expected, row.file);
    }
    const assigned = dLineForRoute(row.route);
    for (const line of D_LINES) {
      if (line === assigned) continue;
      if (row.file === "FAQ.dc.html" || row.file === "Terms.dc.html") continue;
      assert.equal(html.includes(line), false, `${row.file} ${line}`);
    }
    const boxes = [...html.matchAll(/<div class="bond-warn-box">([\s\S]*?)<\/div>/g)].map((match) => match[1]);
    assert.equal(boxes.length, expected, row.file);
    for (const box of boxes) {
      assert.equal(box.includes(WARNING_C1), true, row.file);
      assert.equal(box.includes(assigned), true, row.file);
      for (const line of D_LINES) {
        if (line === assigned) continue;
        assert.equal(box.includes(line), false, `${row.file} box ${line}`);
      }
    }
    if (row.gate === "import") {
      assert.match(html, new RegExp(`warn="${assigned.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`));
    }
    assert.equal(html.includes(LICENSE_LINE), true, row.file);
  }

  const faq = read("FAQ.dc.html");
  const riskHeading = faq.indexOf("<h2>Is cannabis risk-free?</h2>");
  const riskSentence =
    "No, and we will not pretend otherwise. Cannabis can be addictive. Cannabis can impair concentration and coordination. Do not operate a vehicle or machinery under the influence of cannabis. There may be health risks associated with consumption of this product. Cannabis is not recommended for use by persons who are pregnant or nursing. If someone accidentally consumes cannabis, contact the Poison Center at 1-800-222-1222 or call 9-1-1.";
  assert.ok(riskHeading > 0);
  assert.ok(faq.indexOf(riskSentence) > riskHeading);

  const termsList = read("Terms.dc.html");
  const termsHeading = termsList.indexOf("<h2>5. Required health and safety information</h2>");
  assert.ok(termsHeading > 0);
  for (const line of D_LINES) {
    assert.ok(termsList.indexOf(`<li>${line}</li>`) > termsHeading);
  }
});

test("footer warnings are 12px and Home keeps the shared 9px rule", () => {
  const css = read("bond-footer-warn.css");
  assert.match(css, /footer \.bond-warn-box p,\s*footer \.bond-warn-hope,\s*footer \.bond-warn-hope a,\s*footer \.bond-warn-license \{\s*font-size: 12px;\s*\}/);
  assert.match(css, /footer \.bond-warn-hope a\[href\^="tel:"\] \{\s*white-space: nowrap;\s*\}/);
  assert.match(css, /footer \.bond-warn-lic-no \{\s*white-space: nowrap;\s*\}/);
  assert.equal(read("Home.dc.html").includes("bond-warn-lic-no"), false);
  assert.equal(read("AgeGate.dc.html").includes("bond-warn-lic-no"), false);
  assert.equal(css.includes("font-size: 9px"), false);
  assert.equal(read("Home.dc.html").includes("bond-footer-warn.css"), false);
  assert.equal(read("AgeGate.dc.html").includes("bond-footer-warn.css"), false);
  assert.equal(read("bond-age-gate.css").includes("bond-footer-warn"), false);
  for (const file of [
    "FAQ.dc.html",
    "No1.dc.html",
    "No2.dc.html",
    "No3.dc.html",
    "Finder.dc.html",
    "Privacy.dc.html",
    "Terms.dc.html",
    "Haus.dc.html",
  ]) {
    assert.equal(read(file).includes('href="/bond-footer-warn.css"'), true, file);
  }
  assert.match(read("src/app/globals.css"), /bond-footer-warn\.css/);
  assert.match(read("scripts/sync-public.mjs"), /bond-footer-warn\.css/);
});

test("warning rotation keys are gone from source and from Privacy section 7", () => {
  const privacy = read("Privacy.dc.html");
  const cookies = privacy.slice(privacy.indexOf("<h2>7. Cookies</h2>"), privacy.indexOf("<h2>8."));
  assert.equal(cookies.includes("bond_warn_idx"), false);
  assert.equal(cookies.includes("bond_warn_ctr"), false);

  const skip = new Set(["node_modules", "public", ".git", "fonts"]);
  const hits: string[] = [];
  function walk(dir: string) {
    for (const name of readdirSync(dir)) {
      if (skip.has(name)) continue;
      const path = join(dir, name);
      const stat = statSync(path);
      if (stat.isDirectory()) {
        walk(path);
        continue;
      }
      if (!/\.(html|tsx|ts|js|mjs|css|md)$/.test(name)) continue;
      if (name.endsWith(".test.ts")) continue;
      const text = readFileSync(path, "utf8");
      if (text.includes("bond_warn_idx") || text.includes("bond_warn_ctr")) hits.push(path);
    }
  }
  walk(root);
  assert.deepEqual(hits, []);
});
