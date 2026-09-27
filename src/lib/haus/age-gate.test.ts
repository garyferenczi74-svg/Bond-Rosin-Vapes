import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  AGE_GATE_CRITICAL,
  BOND_AGE_KEY,
  BOND_AGE_MONTHS,
  HAUS_AGE_BOOT,
  bondAgeDecision,
  hausRouteShowsAgeGate,
  hausShowsAgeGate,
  routeShowsAgeGate,
} from "./age-gate.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");

function read(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

function bootMark(stored: string | null, blocked = false): string | null {
  const attrs = new Map<string, string>();
  const document = {
    documentElement: {
      setAttribute(name: string, value: string) {
        attrs.set(name, value);
      },
      removeAttribute(name: string) {
        attrs.delete(name);
      },
    },
  };
  const sessionStorage = {
    getItem(key: string) {
      if (blocked) throw new Error("blocked");
      assert.equal(key, BOND_AGE_KEY);
      return stored;
    },
  };
  const run = new Function("document", "sessionStorage", HAUS_AGE_BOOT);
  run(document, sessionStorage);
  return attrs.get("data-bond-age") ?? null;
}

test("AgeGate shows on an unverified Haus door or floor and skips when the session is already verified", () => {
  assert.equal(hausShowsAgeGate(null), true);
  assert.equal(hausShowsAgeGate(""), true);
  assert.equal(hausShowsAgeGate("1710000000000"), false);

  assert.equal(hausRouteShowsAgeGate("/haus", null), true);
  assert.equal(hausRouteShowsAgeGate("/haus", "1710000000000"), false);
  assert.equal(hausRouteShowsAgeGate("/haus/welcome", null), true);
  assert.equal(hausRouteShowsAgeGate("/haus/welcome", "1710000000000"), false);
  assert.equal(hausRouteShowsAgeGate("/haus/salon", null), true);
  assert.equal(hausRouteShowsAgeGate("/haus/salon", "1710000000000"), false);
  assert.equal(hausRouteShowsAgeGate("/vauxhall/haus", null), false);

  for (const path of ["/faq", "/privacy", "/terms", "/order", "/haus", "/haus/welcome"]) {
    assert.equal(routeShowsAgeGate(path, null), true, path);
    assert.equal(routeShowsAgeGate(path, ""), true, path);
    assert.equal(routeShowsAgeGate(path, "1710000000000"), false, path);
  }
  assert.equal(routeShowsAgeGate("/faq/", null), true);
  assert.equal(routeShowsAgeGate("/", null), false);
  assert.equal(routeShowsAgeGate("/vauxhall/haus", null), false);

  assert.equal(bootMark(null), null);
  assert.equal(bootMark(""), null);
  assert.equal(bootMark("1710000000000"), "ok");
  assert.equal(bootMark(null, true), null);
});

test("Haus and order render the native gate and the old host stays unpublished", () => {
  const haus = read("src/app/haus/layout.tsx");
  const order = read("src/app/order/layout.tsx");
  const shell = read("src/components/age-gate-shell.tsx");
  const gate = read("AgeGate.dc.html");
  const sync = read("scripts/sync-public.mjs");
  const filesBlock = sync.slice(sync.indexOf("const files"), sync.indexOf("const dirs"));
  const blockedStart = sync.indexOf("const blocked = new Set");
  const blockedBlock = sync.slice(blockedStart, sync.indexOf("]);", blockedStart));

  assert.match(read("src/app/haus/page.tsx"), /HausClient/);
  assert.match(haus, /AgeGateShell/);
  assert.match(order, /AgeGateShell/);
  assert.match(shell, /BondAgeGate/);
  assert.match(shell, /HAUS_AGE_BOOT/);
  assert.match(shell, /id="bond-gate-cover"/);
  assert.match(AGE_GATE_CRITICAL, /#bond-gate-cover/);
  assert.match(AGE_GATE_CRITICAL, /font-display:swap/);
  assert.match(AGE_GATE_CRITICAL, /size-adjust:107\.89%/);
  assert.match(AGE_GATE_CRITICAL, /\/fonts\/inter-latin\.woff2/);
  assert.match(AGE_GATE_CRITICAL, /\.bond-age-ask \.bond-age-body/);
  assert.equal(read("src/app/layout.tsx").includes("next/font/google"), false);
  assert.equal(read("src/app/layout.tsx").includes("fonts.googleapis.com"), false);
  assert.match(read("src/app/globals.css"), /@import "\.\.\/\.\.\/bond-age-gate\.css"/);
  assert.equal(haus.includes("iframe"), false);
  assert.equal(order.includes("iframe"), false);
  assert.equal(shell.includes("iframe"), false);
  assert.equal(shell.includes("unpkg.com"), false);
  assert.equal(shell.includes("fonts.googleapis.com"), false);
  assert.equal(existsSync(join(root, "haus-age-host.dc.html")), false);
  assert.equal(existsSync(join(root, "src/app/haus/age-gate-client.tsx")), false);
  assert.equal(filesBlock.includes("haus-age-host.dc.html"), false);
  assert.match(blockedBlock, /haus-age-host\.dc\.html/);
  assert.match(gate, /sessionStorage\.getItem\('bond_age_ok'\)/);
  assert.match(gate, /sessionStorage\.setItem\('bond_age_ok'/);
  assert.match(read("bond-age-gate.css"), /var\(--font-didot\)/);
  assert.equal(read("src/app/haus/haus-client.tsx").includes("AgeGate"), false);
  assert.equal(read("src/components/haus-frame.tsx").includes("AgeGate"), false);
});

test("faq privacy terms and order use an in page gate with bond_age_ok", () => {
  const order = read("src/app/order/layout.tsx");
  const gateJs = read("bond-age-gate.js");
  const gateCss = read("bond-age-gate.css");
  const gateView = read("src/components/bond-age-gate.tsx");
  const thirdPartyScript = /unpkg\.com|fonts\.googleapis\.com|fonts\.gstatic\.com|support\.js|haus-age-host/;

  assert.match(order, /AgeGateShell/);
  assert.equal(order.includes("HausAgeGate"), false);
  assert.equal(order.includes("iframe"), false);
  assert.equal(thirdPartyScript.test(order), false);
  assert.equal(thirdPartyScript.test(gateJs), false);
  assert.equal(thirdPartyScript.test(gateCss), false);
  assert.equal(thirdPartyScript.test(gateView), false);
  assert.equal(gateJs.includes("iframe"), false);
  assert.equal(gateView.includes("iframe"), false);

  assert.match(read("next.config.ts"), /source: "\/faq", destination: "\/FAQ\.dc\.html"/);
  assert.match(read("next.config.ts"), /source: "\/privacy", destination: "\/Privacy\.dc\.html"/);
  assert.match(read("next.config.ts"), /source: "\/terms", destination: "\/Terms\.dc\.html"/);
  assert.match(read("scripts/sync-public.mjs"), /bond-age-gate\.js/);
  assert.match(read("scripts/sync-public.mjs"), /bond-age-gate\.css/);

  for (const name of ["FAQ.dc.html", "Privacy.dc.html", "Terms.dc.html"]) {
    const html = read(name);
    assert.match(html, /id="bond-age-gate"/, name);
    assert.match(html, /href="\/bond-age-gate\.css"/, name);
    assert.match(html, /src="\/bond-age-gate\.js"/, name);
    assert.match(html, /sessionStorage\.getItem\("bond_age_ok"\)/, name);
    assert.match(html, /class="bond-floor" inert/, name);
    assert.match(html, /Please confirm your age\./, name);
    assert.match(html, /Birth month/, name);
    assert.match(html, /Not yet/, name);
    assert.match(html, /html:not\(\[data-bond-age="ok"\]\) \.bond-floor \{ visibility: hidden; \}/, name);
    assert.equal(html.includes("haus-age-host"), false, name);
    assert.equal(html.includes("<iframe"), false, name);
    assert.equal(html.includes("unpkg.com"), false, name);
    assert.equal(html.includes("support.js"), false, name);
    assert.equal(html.includes('sessionStorage.setItem("bond_age_ok"'), false, name);
    assert.equal(html.includes("sessionStorage.setItem('bond_age_ok'"), false, name);
  }

  assert.match(gateJs, /sessionStorage\.setItem\(KEY, String\(Date\.now\(\)\)\)/);
  assert.match(gateJs, /localStorage\.removeItem\(KEY\)/);
  assert.match(gateJs, /data-declined", "true"/);
  assert.match(gateView, /sessionStorage\.setItem\(BOND_AGE_KEY, String\(Date\.now\(\)\)\)/);
  assert.match(gateView, /Please confirm your age\./);
  assert.match(gateView, /Not yet/);
  assert.match(gateCss, /transition-property: opacity/);
  const reduced = gateCss.slice(gateCss.indexOf("@media (prefers-reduced-motion: reduce)"));
  assert.equal(reduced.includes("translate"), false);
  assert.equal(reduced.includes("scale"), false);
  assert.match(reduced, /transform: none/);

  const fnMatch = gateJs.match(/function bondAgeDecision\(month, year, now\) \{[\s\S]*?\n  \}/);
  assert.ok(fnMatch);
  const bondAgeDecisionJs = new Function(`return (${fnMatch[1] ?? fnMatch[0]})`)() as typeof bondAgeDecision;
  const monthList = gateJs.match(/var MONTHS = (\[[\s\S]*?\]);/);
  assert.ok(monthList);
  assert.deepEqual(JSON.parse(monthList[1].replace(/'/g, '"')), [...BOND_AGE_MONTHS]);
  const samples = [
    ["", "1990", new Date(2026, 8, 27), "wait"],
    ["0", "", new Date(2026, 8, 27), "wait"],
    ["0", "1990", new Date(2026, 8, 27), "enter"],
    ["8", "2005", new Date(2026, 8, 27), "enter"],
    ["9", "2005", new Date(2026, 8, 27), "decline"],
    ["0", "2006", new Date(2026, 8, 27), "decline"],
  ] as const;
  for (const [month, year, now, expected] of samples) {
    assert.equal(bondAgeDecision(month, year, now), expected);
    assert.equal(bondAgeDecisionJs(month, year, now), expected);
  }

  const band = read("src/components/compliance-band.tsx");
  const warnings = read("src/lib/bond-warnings.ts");
  assert.match(band, /21\+ Cannabis products\. Keep out of reach of children\./);
  assert.match(band, /BondWarn/);
  assert.match(band, /warningRouteForPath/);
  assert.match(warnings, /For use only by persons 21 years of age and older\./);
  assert.match(read("bond-age-gate.css"), /--bond-warning-yellow/);
  assert.match(warnings, /Cedargrowth LLC\./);
  assert.equal(warnings.includes("Cedargrowth Organics"), false);
  assert.match(warnings, /Cannabis can impair concentration and coordination\./);
  assert.match(warnings, /There may be health risks associated with consumption of this product\./);
  assert.match(warnings, /Cannabis is not recommended for use by persons who are pregnant or nursing\./);
  assert.equal(band.includes("bond_warn_idx"), false);
  assert.equal(warnings.includes("bond_warn_idx"), false);
  assert.match(warnings, /tel:18778467369/);
  assert.match(warnings, /https:\/\/oasas\.ny\.gov\/hopeline/);
  assert.match(warnings, /texting HOPENY \(467369\)/);
  assert.match(warnings, /1-877-8-HOPENY/);
  assert.match(warnings, /Cannabis can be addictive\./);
  assert.match(warnings, /OCM-PROC-25-000329/);
  assert.equal(warnings.includes("OCM-Proc-25-000329"), false);
  assert.match(read("src/app/haus/haus-client.tsx"), /ComplianceBand/);
  assert.match(read("src/app/order/order-client.tsx"), /ComplianceBand/);

  const faq = read("FAQ.dc.html");
  const riskHeading = faq.indexOf("<h2>Is cannabis risk-free?</h2>");
  assert.ok(riskHeading > 0);
  const riskSentence =
    "No, and we will not pretend otherwise. Cannabis can be addictive. Cannabis can impair concentration and coordination. Do not operate a vehicle or machinery under the influence of cannabis. There may be health risks associated with consumption of this product. Cannabis is not recommended for use by persons who are pregnant or nursing. If someone accidentally consumes cannabis, contact the Poison Center at 1-800-222-1222 or call 9-1-1.";
  assert.ok(faq.includes(riskSentence));
  assert.ok(faq.indexOf(riskSentence) > riskHeading);
});

test("the shared bond_age_ok key clears the gate both ways and under 21 writes nothing", () => {
  const marketing = read("AgeGate.dc.html");
  const view = read("src/components/bond-age-gate.tsx");
  const gateJs = read("bond-age-gate.js");
  const stored = "1710000000000";

  assert.match(marketing, /sessionStorage\.setItem\('bond_age_ok'/);
  assert.match(marketing, /sessionStorage\.getItem\('bond_age_ok'\)/);
  assert.match(marketing, /if \(raw\)/);
  assert.equal(BOND_AGE_KEY, "bond_age_ok");

  for (const path of ["/haus", "/faq", "/privacy", "/terms", "/order"]) {
    assert.equal(routeShowsAgeGate(path, stored), false, path);
    assert.equal(routeShowsAgeGate(path, null), true, path);
  }
  assert.equal(hausShowsAgeGate(stored), false);
  assert.equal(bootMark(stored), "ok");
  assert.equal(bootMark(null), null);

  const enterAt = gateJs.indexOf('if (decision === "enter")');
  const setAt = gateJs.indexOf("sessionStorage.setItem");
  const declineAt = gateJs.indexOf('root.setAttribute("data-declined", "true")');
  assert.ok(enterAt > 0 && setAt > enterAt && declineAt > setAt);

  const viewDecline = view.indexOf('if (decision === "decline")');
  const viewSet = view.indexOf("sessionStorage.setItem");
  assert.ok(viewDecline > 0 && viewDecline < viewSet);
  assert.match(view, /setDeclined\(true\)/);
  assert.equal(bondAgeDecision("0", "2006", new Date(2026, 8, 27)), "decline");
  assert.equal(bondAgeDecision("0", "1990", new Date(2026, 8, 27)), "enter");
});
