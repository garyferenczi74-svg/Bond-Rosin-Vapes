import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  AGE_GATE_CRITICAL,
  HAUS_FONT_LATE,
  HAUS_FONT_LATE_CSS,
  BOND_AGE_KEY,
  BOND_AGE_MONTHS,
  HAUS_AGE_BOOT,
  bondAgeDecision,
  bondAgeEntry,
  hausRouteShowsAgeGate,
  hausShowsAgeGate,
  markBondAgePassed,
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
  assert.match(AGE_GATE_CRITICAL, /background:#1B1D1C/);
  const ringGuard = "@supports ((mask-composite: exclude) or (-webkit-mask-composite: xor))";
  const clipGuard =
    "@supports ((-webkit-clip-path: polygon(evenodd, 0 0, 1px 0, 0 1px)) or (clip-path: polygon(evenodd, 0 0, 1px 0, 0 1px)))";
  for (const name of [
    "bond-age-gate.css",
    "AgeGate.dc.html",
    "Home.dc.html",
    "No1.dc.html",
    "No2.dc.html",
    "No3.dc.html",
    "Finder.dc.html",
    "FAQ.dc.html",
    "Privacy.dc.html",
    "Terms.dc.html",
  ]) {
    const html = read(name);
    assert.ok(html.includes(ringGuard), name);
    assert.ok(html.includes(clipGuard), name);
    const clipAt = html.indexOf(clipGuard);
    const selAt = html.indexOf(".bond-age-gate .bond-warn-box::before");
    assert.ok(clipAt >= 0 && selAt > clipAt, name);
    assert.ok(html.indexOf(ringGuard) > clipAt, name);
  }
  assert.ok(AGE_GATE_CRITICAL.includes(ringGuard));
  assert.ok(AGE_GATE_CRITICAL.includes(clipGuard));
  assert.ok(
    AGE_GATE_CRITICAL.indexOf(".bond-age-gate .bond-warn-box::before") > AGE_GATE_CRITICAL.indexOf(clipGuard),
  );
  assert.equal(AGE_GATE_CRITICAL.includes("local("), false);
  assert.equal(AGE_GATE_CRITICAL.includes("--matte-black:"), false);
  assert.equal(AGE_GATE_CRITICAL.includes("--bone:"), false);
  assert.equal(AGE_GATE_CRITICAL.includes("var(--matte-black,"), false);
  assert.equal(AGE_GATE_CRITICAL.includes("var(--bone,"), false);
  assert.match(AGE_GATE_CRITICAL, /\.bond-age-gate \.bond-age-ask \.bond-age-body/);
  assert.match(gate, /aria-label="Birth month"/);
  assert.match(gate, /aria-label="Birth year"/);
  assert.equal(AGE_GATE_CRITICAL.includes("woff2"), false);
  assert.equal(AGE_GATE_CRITICAL.includes("font-display"), false);
  assert.match(HAUS_FONT_LATE_CSS, /font-display:swap/);
  assert.match(HAUS_FONT_LATE_CSS, /\/fonts\/inter-latin\.woff2/);
  assert.match(HAUS_FONT_LATE_CSS, /\/fonts\/gfs-didot-latin-400\.woff2/);
  assert.match(HAUS_FONT_LATE_CSS, /html body \.bond-age-gate \.bond-age-ask \.bond-age-body/);
  assert.match(HAUS_FONT_LATE, /document\.body/);
  assert.match(HAUS_FONT_LATE, /addEventListener\("load"/);
  assert.match(read("src/app/layout.tsx"), /HAUS_FONT_LATE/);
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
    if (name === "Privacy.dc.html") {
      assert.equal(html.includes('src="https://unpkg.com'), false, name);
      assert.match(html, /unpkg\.com/);
    } else {
      assert.equal(html.includes("unpkg.com"), false, name);
    }
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
  assert.match(gateJs, /document\.documentElement\.dataset\.bondAge = "ok"/);
  assert.match(view, /markBondAgePassed\(document\.documentElement\)/);
  assert.equal(HAUS_FONT_LATE_CSS.includes("Didot Fallback"), false);
  assert.match(HAUS_FONT_LATE_CSS, /font-family:"GFS Didot",Didot,serif/);
});

function marketingEnterSource(): string {
  const source = read("AgeGate.dc.html");
  const start = source.indexOf("enter: () => {");
  assert.ok(start > 0);
  const bodyStart = source.indexOf("{", start);
  let depth = 0;
  let end = bodyStart;
  for (; end < source.length; end++) {
    const ch = source[end];
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) {
        end += 1;
        break;
      }
    }
  }
  return source.slice(bodyStart + 1, end - 1);
}

function slotScript(html: string): string {
  const marker = "function loadSlots()";
  const at = html.indexOf(marker);
  assert.ok(at > 0);
  const start = html.lastIndexOf("<script>", at);
  const end = html.indexOf("</script>", at);
  return html.slice(start + "<script>".length, end);
}

function mainDisplayed(html: string, ageOk: boolean): boolean {
  const hidesBody = html.includes(
    'html:not([data-bond-age="ok"]) body>*:not(#bond-gate-cover){visibility:hidden}',
  );
  if (hidesBody && !ageOk) return false;
  return ageOk && html.includes('html[data-bond-age="ok"] #bond-gate-cover{display:none}');
}

function runGate(html: string, month: string, year: string, ofAge = true) {
  const dataset: { bondAge?: string } = {};
  const store = new Map<string, string>();
  const scripts: string[] = [];
  const listeners: Array<(ev: Event) => void> = [];
  let declined = false;
  const document = {
    documentElement: {
      dataset,
      getAttribute(name: string) {
        if (name === "data-bond-age") return dataset.bondAge ?? null;
        return null;
      },
    },
    createElement(tag: string) {
      assert.equal(tag, "script");
      return { src: "", async: false };
    },
    head: {
      appendChild(el: { src: string }) {
        scripts.push(el.src);
      },
    },
  };
  const window = {
    addEventListener(type: string, fn: (ev: Event) => void) {
      if (type === "bond-entered") listeners.push(fn);
    },
    dispatchEvent(ev: Event) {
      if (ev.type === "bond-entered") {
        for (const fn of listeners) fn(ev);
      }
      return true;
    },
  };
  const sessionStorage = {
    setItem(key: string, value: string) {
      store.set(key, value);
    },
    getItem(key: string) {
      return store.get(key) ?? null;
    },
  };
  const self = {
    setState(next: { declined?: boolean }) {
      if (next.declined) declined = true;
    },
  };
  const arm = new Function("document", "window", slotScript(html));
  arm(document, window);
  const enter = new Function(
    "month",
    "year",
    "ofAge",
    "document",
    "sessionStorage",
    "window",
    "CustomEvent",
    marketingEnterSource(),
  );
  enter.call(self, month, year, ofAge, document, sessionStorage, window, CustomEvent);
  return { dataset, store, scripts, declined };
}

test("a first pass stamps the age attribute and shows Home and the product pages", () => {
  const pages = ["Home.dc.html", "No1.dc.html", "No2.dc.html", "No3.dc.html"];
  for (const name of pages) {
    const html = read(name);
    const passed = runGate(html, "0", "1990");
    assert.equal(passed.dataset.bondAge, "ok", name);
    assert.equal(passed.store.get("bond_age_ok") != null, true, name);
    assert.equal(passed.declined, false, name);
    assert.equal(mainDisplayed(html, passed.dataset.bondAge === "ok"), true, name);
    assert.deepEqual(passed.scripts, ["./image-slot.js"], name);

    const refused = runGate(html, "0", "2010", true);
    assert.equal(refused.dataset.bondAge, undefined, name);
    assert.equal(refused.store.size, 0, name);
    assert.equal(refused.declined, true, name);
    const unchecked = runGate(html, "0", "1990", false);
    assert.equal(unchecked.dataset.bondAge, undefined, name);
    assert.equal(unchecked.store.size, 0, name);
    assert.equal(unchecked.declined, false, name);
    assert.deepEqual(refused.scripts, [], name);
    if (html.includes('body>*:not(#bond-gate-cover){visibility:hidden}')) {
      assert.equal(mainDisplayed(html, false), false, name);
    }
  }

  const root = { dataset: { bondAge: "" } };
  markBondAgePassed(root);
  assert.equal(root.dataset.bondAge, "ok");
});

test("entry needs a valid month, a year of 21 or older, and the affirmation box", () => {
  const now = new Date(2026, 8, 27);
  const samples = [
    ["", "1990", true, "wait"],
    ["0", "", true, "wait"],
    ["0", "1990", false, "wait"],
    ["8", "2005", false, "wait"],
    ["0", "2010", true, "decline"],
    ["0", "2006", true, "decline"],
    ["9", "2005", true, "decline"],
    ["0", "1990", true, "enter"],
    ["8", "2005", true, "enter"],
  ] as const;
  for (const [month, year, affirmed, expected] of samples) {
    assert.equal(bondAgeEntry(month, year, affirmed, now), expected, `${month}|${year}|${affirmed}`);
  }
  assert.equal(bondAgeDecision("0", "1990", now), "enter");
  assert.equal(bondAgeEntry("0", "1990", false, now), "wait");

  const gateJs = read("bond-age-gate.js");
  const affirmAt = gateJs.indexOf("if (affirmEl.checked !== true) return;");
  const decisionAt = gateJs.indexOf("var decision = bondAgeDecision");
  const setAt = gateJs.indexOf("sessionStorage.setItem");
  assert.ok(affirmAt > 0 && decisionAt > affirmAt && setAt > decisionAt);
  assert.match(gateJs, /getElementById\("bond-age-affirm"\)/);
  assert.match(gateJs, /affirmEl\.addEventListener\("change", syncReady\)/);
  assert.equal(gateJs.includes("document.cookie"), false);
  assert.equal(gateJs.includes("location.search"), false);
  assert.equal(gateJs.includes("URLSearchParams"), false);

  const view = read("src/components/bond-age-gate.tsx");
  assert.match(view, /const \[affirmed, setAffirmed\] = useState\(false\)/);
  assert.match(view, /bondAgeEntry\(month, year, affirmed, new Date\(\)\)/);
  assert.match(view, /<label htmlFor="bond-age-affirm">I am 21 years of age or older<\/label>/);
  assert.match(view, /type="checkbox"/);
  assert.match(view, /checked=\{affirmed\}/);
  assert.match(view, /I am 21 years of age or older/);
  assert.match(view, /aria-label="Birth month"/);
  assert.match(view, /aria-label="Birth year"/);
  assert.equal(view.includes("document.cookie"), false);
  assert.equal(view.includes("location.search"), false);
  assert.equal(view.includes("URLSearchParams"), false);
  assert.equal(view.includes('tabindex="-1"'), false);

  const gate = read("AgeGate.dc.html");
  const noscript = gate.slice(gate.indexOf("<noscript>"), gate.indexOf("</noscript>"));
  const scripted = gate.slice(gate.indexOf("<x-dc>"));
  assert.equal(noscript.includes("I am 21 years of age or older"), false);
  assert.match(noscript, /aria-label="Birth month"/);
  assert.match(noscript, /aria-label="Birth year"/);
  assert.match(scripted, /ofAge: false/);
  assert.match(scripted, /aria-label="Birth month"/);
  assert.match(scripted, /aria-label="Birth year"/);
  const row = scripted.match(/<div class="bond-age-affirm">[\s\S]*?<\/div>/);
  assert.ok(row);
  assert.match(row[0], /<label for="bond-age-affirm">I am 21 years of age or older<\/label>/);
  assert.match(row[0], /type="checkbox"/);
  assert.equal(row[0].includes("disabled"), false);
  assert.equal(row[0].includes("tabindex"), false);
  assert.match(row[0], /checked="\{\{ ofAge \}\}"/);
  assert.match(scripted, /month, year, ofAge/);
  const mount = scripted.slice(scripted.indexOf("componentDidMount"), scripted.indexOf("renderVals"));
  assert.equal(mount.includes("ofAge"), false);
  assert.equal(scripted.includes("document.cookie"), false);
  assert.equal(scripted.includes("location.search"), false);
  assert.equal(scripted.includes("URLSearchParams"), false);
  assert.match(scripted, /if \(month === '' \|\| year === '' \|\| ofAge !== true\) return;/);

  const css = read("bond-age-gate.css");
  assert.match(css, /\.bond-age-affirm-input:focus-visible/);
  assert.match(css, /font-size: 9px/);
  const boxRule = css.slice(css.indexOf(".bond-warn-box p {"), css.indexOf("}", css.indexOf(".bond-warn-box p {")));
  assert.equal(boxRule.includes("scale("), false);
  assert.equal(boxRule.includes("zoom"), false);
  assert.equal(boxRule.includes("overflow"), false);
  assert.match(boxRule, /font-family: Arial, Helvetica, sans-serif/);

  for (const name of ["FAQ.dc.html", "Privacy.dc.html", "Terms.dc.html", "Finder.dc.html"]) {
    const html = read(name);
    const fieldsStart = html.indexOf('class="bond-age-fields"');
    const fields = html.slice(fieldsStart, html.indexOf("bond-age-enter", fieldsStart));
    const monthAt = fields.indexOf("Birth month");
    const yearAt = fields.indexOf("Birth year");
    const boxAt = fields.indexOf("I am 21 years of age or older");
    assert.ok(monthAt >= 0 && yearAt > monthAt && boxAt > yearAt, name);
    const row = fields.match(/<div class="bond-age-affirm">[\s\S]*?<\/div>/);
    assert.ok(row, name);
    assert.match(row[0], /<input type="checkbox" id="bond-age-affirm" class="bond-age-affirm-input">/, name);
    assert.match(row[0], /<label for="bond-age-affirm">I am 21 years of age or older<\/label>/, name);
    assert.equal(row[0].includes("checked"), false, name);
    assert.equal(row[0].includes("disabled"), false, name);
    assert.equal(row[0].includes("tabindex"), false, name);
    assert.equal(html.includes("document.cookie"), false, name);
    assert.equal(html.includes("URLSearchParams"), false, name);
  }

  for (const name of ["Home.dc.html", "No1.dc.html", "No2.dc.html", "No3.dc.html"]) {
    const html = read(name);
    assert.match(html, /dc-import name="AgeGate"/, name);
    const coverStart = html.indexOf('<div id="bond-gate-cover">');
    const cover = html.slice(coverStart, html.indexOf("</div></div></div>", coverStart));
    assert.equal(cover.includes("I am 21 years of age or older"), false, name);
    assert.match(cover, /class="bond-warn-box"/, name);
  }
});
