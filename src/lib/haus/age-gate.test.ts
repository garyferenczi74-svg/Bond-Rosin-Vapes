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
  BOND_AGE_MS,
  HAUS_AGE_BOOT,
  bondAgeStamp,
  bondAgeTimestamp,
  hausRouteShowsAgeGate,
  hausShowsAgeGate,
  markBondAgePassed,
  routeShowsAgeGate,
} from "./age-gate.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");

function read(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

function bootRun(local: string | null, session: string | null = null, blocked = false) {
  const attrs = new Map<string, string>();
  let sessionLeft = session;
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
      return sessionLeft;
    },
    removeItem(key: string) {
      if (blocked) throw new Error("blocked");
      assert.equal(key, BOND_AGE_KEY);
      sessionLeft = null;
    },
  };
  const localStorage = {
    getItem(key: string) {
      assert.equal(key, BOND_AGE_KEY);
      return local;
    },
    setItem() {
      throw new Error("boot wrote localStorage");
    },
  };
  const run = new Function("document", "sessionStorage", "localStorage", HAUS_AGE_BOOT);
  run(document, sessionStorage, localStorage);
  return { mark: attrs.get("data-bond-age") ?? null, session: sessionLeft };
}

function bootMark(local: string | null, session: string | null = null, blocked = false): string | null {
  return bootRun(local, session, blocked).mark;
}

test("AgeGate shows on an unverified Haus door or floor and skips when the session is already verified", () => {
  const now = Date.now();
  const fresh = String(now);
  const freshJson = bondAgeStamp(now);
  const expired = "1710000000000";

  assert.equal(hausShowsAgeGate(null, now), true);
  assert.equal(hausShowsAgeGate("", now), true);
  assert.equal(hausShowsAgeGate(expired, now), true);
  assert.equal(hausShowsAgeGate("nope", now), true);
  assert.equal(hausShowsAgeGate(fresh, now), false);
  assert.equal(hausShowsAgeGate(freshJson, now), false);
  assert.equal(bondAgeTimestamp(fresh, now), now);
  assert.equal(bondAgeTimestamp(expired, now), null);
  assert.equal(bondAgeTimestamp('{"ok":false,"t":1}', now), null);
  assert.equal(bondAgeTimestamp(String(now + 60_000), now), null);

  assert.equal(hausRouteShowsAgeGate("/haus", null), true);
  assert.equal(hausRouteShowsAgeGate("/haus", fresh), false);
  assert.equal(hausRouteShowsAgeGate("/haus", expired), true);
  assert.equal(hausRouteShowsAgeGate("/haus/welcome", null), true);
  assert.equal(hausRouteShowsAgeGate("/haus/welcome", fresh), false);
  assert.equal(hausRouteShowsAgeGate("/haus/salon", null), true);
  assert.equal(hausRouteShowsAgeGate("/haus/salon", fresh), false);
  assert.equal(hausRouteShowsAgeGate("/vauxhall/haus", null), false);

  for (const path of ["/faq", "/privacy", "/terms", "/order", "/haus", "/haus/welcome"]) {
    assert.equal(routeShowsAgeGate(path, null), true, path);
    assert.equal(routeShowsAgeGate(path, ""), true, path);
    assert.equal(routeShowsAgeGate(path, fresh), false, path);
    assert.equal(routeShowsAgeGate(path, expired), true, path);
  }
  assert.equal(routeShowsAgeGate("/faq/", null), true);
  assert.equal(routeShowsAgeGate("/", null), false);
  assert.equal(routeShowsAgeGate("/vauxhall/haus", null), false);

  assert.equal(bootMark(null), null);
  assert.equal(bootMark(""), null);
  assert.equal(bootMark(expired), null);
  assert.equal(bootMark("nope"), null);
  assert.equal(bootMark(fresh), "ok");
  assert.equal(bootMark(freshJson), "ok");
  assert.equal(bootMark(null, null, true), null);
  const legacyBoot = bootRun(null, fresh);
  assert.equal(legacyBoot.mark, null);
  assert.equal(legacyBoot.session, null);
  assert.equal(BOND_AGE_MS, 30 * 24 * 60 * 60 * 1000);
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
  assert.match(gate, /role="dialog"/);
  assert.match(gate, /aria-modal="true"/);
  assert.match(gate, /aria-labelledby="\{\{ headingId \}\}"/);
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
  assert.match(gate, /localStorage\.setItem\('bond_age_ok'/);
  assert.match(gate, /sessionStorage\.setItem\('bond_age_ok', String\(t\)\)/);
  assert.match(gate, /Yes, I am 21 or older/);
  assert.equal(gate.includes("Yes, enter"), false);
  assert.equal(gate.includes("Birth month"), false);
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
    assert.match(html, /Are you 21 or older\?/, name);
    assert.match(html, /Yes, I am 21 or older/, name);
    assert.match(html, />No</, name);
    assert.equal(html.includes("Birth month"), false, name);
    assert.equal(html.includes("Not yet"), false, name);
    assert.equal(html.includes("Please confirm your age."), false, name);
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

  assert.match(gateJs, /localStorage\.setItem\(KEY, stamp\(t\)\)/);
  assert.match(gateJs, /sessionStorage\.setItem\(KEY, String\(t\)\)/);
  assert.match(gateJs, /removeItem\(KEY\)/);
  assert.match(gateJs, /data-declined", "true"/);
  assert.match(gateView, /localStorage\.setItem\(BOND_AGE_KEY, bondAgeStamp\(t\)\)/);
  assert.match(gateView, /sessionStorage\.setItem\(BOND_AGE_KEY, String\(t\)\)/);
  assert.match(gateView, /Are you 21 or older\?/);
  assert.match(gateView, /Come back when you&apos;re 21\./);
  assert.equal(gateView.includes("Not yet"), false);
  assert.equal(gateView.includes("Birth month"), false);
  assert.match(gateCss, /transition-property: opacity/);
  const reduced = gateCss.slice(gateCss.indexOf("@media (prefers-reduced-motion: reduce)"));
  assert.equal(reduced.includes("translate"), false);
  assert.equal(reduced.includes("scale"), false);
  assert.match(reduced, /transform: none/);

  assert.equal(gateJs.includes("bondAgeDecision"), false);
  assert.equal(gateJs.includes("document.cookie"), false);
  assert.match(gateJs, /getElementById\("bond-age-yes"\)/);
  assert.match(gateJs, /getElementById\("bond-age-no"\)/);

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
  const now = Date.now();
  const stored = bondAgeStamp(now);
  const expired = "1710000000000";

  assert.match(marketing, /localStorage\.setItem\('bond_age_ok'/);
  assert.match(marketing, /sessionStorage\.setItem\('bond_age_ok', String\(t\)\)/);
  assert.match(marketing, /sessionStorage\.getItem\('bond_age_ok'\)/);
  assert.match(marketing, /if \(localRaw\)/);
  assert.equal(BOND_AGE_KEY, "bond_age_ok");

  for (const path of ["/haus", "/faq", "/privacy", "/terms", "/order"]) {
    assert.equal(routeShowsAgeGate(path, stored), false, path);
    assert.equal(routeShowsAgeGate(path, expired), true, path);
    assert.equal(routeShowsAgeGate(path, null), true, path);
  }
  assert.equal(hausShowsAgeGate(stored, now), false);
  assert.equal(hausShowsAgeGate(expired, now), true);
  assert.equal(bootMark(String(now)), "ok");
  assert.equal(bootMark(expired), null);
  assert.equal(bootMark(null), null);

  const yesAt = gateJs.indexOf('yesEl.addEventListener("click"');
  const setAt = gateJs.indexOf("localStorage.setItem(KEY, stamp(t))");
  const declineAt = gateJs.indexOf('root.setAttribute("data-declined", "true")');
  assert.ok(yesAt > 0 && setAt > yesAt && declineAt > setAt);
  const noHandler = gateJs.slice(declineAt, declineAt + 220);
  assert.equal(noHandler.includes("setItem"), false);
  assert.equal(noHandler.includes("cookie"), false);

  const viewNo = view.indexOf("setDeclined(true)");
  const viewSet = view.indexOf("localStorage.setItem(BOND_AGE_KEY, bondAgeStamp(t))");
  assert.ok(viewNo > 0 && viewSet > 0);
  assert.match(view, /onClick=\{\(\) => setDeclined\(true\)\}/);
  assert.match(gateJs, /document\.documentElement\.dataset\.bondAge = "ok"/);
  assert.match(view, /markBondAgePassed\(document\.documentElement\)/);
  assert.equal(HAUS_FONT_LATE_CSS.includes("Didot Fallback"), false);
  assert.match(HAUS_FONT_LATE_CSS, /font-family:"GFS Didot",Didot,serif/);
});

function methodSource(marker: string): string {
  const source = read("AgeGate.dc.html");
  const start = source.indexOf(marker);
  assert.ok(start > 0, marker);
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

function runGate(html: string, choice: "yes" | "no") {
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
    getElementById() {
      return null;
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
  const localStorage = {
    setItem(key: string, value: string) {
      store.set(key, value);
    },
    getItem(key: string) {
      return store.get(key) ?? null;
    },
  };
  const self = {
    setState(next: { declined?: boolean; verified?: boolean }) {
      if (next.declined) declined = true;
    },
  };
  const arm = new Function("document", "window", slotScript(html));
  arm(document, window);
  const body = choice === "yes" ? methodSource("enter: () => {") : methodSource("decline: () => {");
  const fn = new Function("document", "localStorage", "window", "CustomEvent", "setTimeout", body);
  fn.call(self, document, localStorage, window, CustomEvent, () => 0);
  return { dataset, store, scripts, declined };
}

type GateEl = {
  id: string;
  disabled: boolean;
  tabIndex: number;
  focus: () => void;
  getClientRects: () => number[];
};

function loadStaticGate(localSeed: Map<string, string>, sessionSeed: Map<string, string>) {
  const localMap = new Map(localSeed);
  const sessionMap = new Map(sessionSeed);
  const clicks = new Map<string, () => void>();
  const keydowns: Array<(ev: { key: string; shiftKey: boolean; preventDefault: () => void }) => void> = [];
  const focusins: Array<(ev: { target: unknown }) => void> = [];
  const timers: Array<() => void> = [];
  let active: GateEl | null = null;
  const dataset: { bondAge?: string } = {};
  const attrs: Record<string, string> = {};
  function make(id: string, tabIndex = 0): GateEl {
    const el: GateEl = {
      id,
      disabled: false,
      tabIndex,
      focus() {
        active = el;
      },
      getClientRects() {
        return [1];
      },
    };
    return el;
  }
  const yes = make("bond-age-yes");
  const no = make("bond-age-no");
  const denied = make("bond-gate-denied-h", -1);
  const hope = make("hope");
  const root = {
    setAttribute(name: string, value: string) {
      attrs[name] = value;
    },
    contains(node: unknown) {
      return node === yes || node === no || node === denied || node === hope;
    },
    querySelectorAll() {
      return [yes, no, denied, hope];
    },
  };
  const document = {
    getElementById(id: string) {
      if (id === "bond-age-gate") return root;
      if (id === "bond-age-yes") return yes;
      if (id === "bond-age-no") return no;
      if (id === "bond-gate-denied-h") return denied;
      return null;
    },
    querySelector(sel: string) {
      if (sel === ".bond-floor") return { removeAttribute() {} };
      return null;
    },
    documentElement: {
      dataset,
      getAttribute(name: string) {
        if (name === "data-bond-age") return dataset.bondAge ?? null;
        return null;
      },
    },
    get activeElement() {
      return active;
    },
    body: { tag: "body" },
    addEventListener(type: string, fn: (ev: never) => void) {
      if (type === "keydown") keydowns.push(fn);
      if (type === "focusin") focusins.push(fn);
    },
  };
  const yesClick = {
    addEventListener(type: string, fn: () => void) {
      if (type === "click") clicks.set("yes", fn);
    },
    focus: yes.focus,
  };
  const noClick = {
    addEventListener(type: string, fn: () => void) {
      if (type === "click") clicks.set("no", fn);
    },
  };
  const realGet = document.getElementById.bind(document);
  document.getElementById = (id: string) => {
    if (id === "bond-age-yes") return Object.assign(yes, yesClick);
    if (id === "bond-age-no") return Object.assign(no, noClick);
    return realGet(id);
  };
  const localStorage = {
    getItem(key: string) {
      return localMap.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      localMap.set(key, value);
    },
    removeItem(key: string) {
      localMap.delete(key);
    },
  };
  const sessionStorage = {
    getItem(key: string) {
      return sessionMap.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      sessionMap.set(key, value);
    },
    removeItem(key: string) {
      sessionMap.delete(key);
    },
  };
  const windowObj = {
    getComputedStyle() {
      return { display: "block", visibility: "visible" };
    },
    dispatchEvent() {
      return true;
    },
  };
  const run = new Function(
    "document",
    "window",
    "localStorage",
    "sessionStorage",
    "CustomEvent",
    "setTimeout",
    read("bond-age-gate.js"),
  );
  run(document, windowObj, localStorage, sessionStorage, CustomEvent, (fn: () => void) => {
    timers.push(fn);
    return 0;
  });
  for (const fn of timers) fn();
  return { localMap, sessionMap, dataset, attrs, active: () => active, clicks, keydowns, focusins, yes, no, denied, hope };
}

test("a first pass stamps the age attribute and shows Home and the product pages", () => {
  const pages = ["Home.dc.html", "No1.dc.html", "No2.dc.html", "No3.dc.html"];
  for (const name of pages) {
    const html = read(name);
    const before = runGate(html, "no");
    assert.equal(before.store.size, 0, name);
    assert.equal(before.dataset.bondAge, undefined, name);
    assert.equal(before.declined, true, name);
    assert.deepEqual(before.scripts, [], name);

    const passed = runGate(html, "yes");
    const raw = passed.store.get("bond_age_ok");
    assert.ok(raw, name);
    const parsed = JSON.parse(raw) as { ok: boolean; t: number };
    assert.equal(parsed.ok, true, name);
    assert.equal(typeof parsed.t, "number", name);
    assert.ok(Date.now() - parsed.t < 5000, name);
    assert.equal(passed.dataset.bondAge, "ok", name);
    assert.equal(passed.declined, false, name);
    assert.equal(mainDisplayed(html, passed.dataset.bondAge === "ok"), true, name);
    assert.deepEqual(passed.scripts, ["./image-slot.js"], name);
    if (html.includes('body>*:not(#bond-gate-cover){visibility:hidden}')) {
      assert.equal(mainDisplayed(html, false), false, name);
    }
  }

  const root = { dataset: { bondAge: "" } };
  markBondAgePassed(root);
  assert.equal(root.dataset.bondAge, "ok");
});

test("yes stores a flag and timestamp, no stores nothing, and a bad flag re-gates", () => {
  const blank = loadStaticGate(new Map(), new Map());
  assert.equal(blank.localMap.size, 0);
  assert.equal(blank.sessionMap.size, 0);
  assert.equal(blank.dataset.bondAge, undefined);
  assert.equal(blank.active(), blank.yes);

  const outside = { tag: "outside" };
  blank.focusins[0]({ target: outside });
  assert.equal(blank.active(), blank.yes);
  blank.no.focus();
  blank.focusins[0]({ target: blank.no });
  assert.equal(blank.active(), blank.no);

  const tab = { key: "Tab", shiftKey: false, prevented: false, preventDefault() { this.prevented = true; } };
  blank.yes.focus();
  blank.keydowns[0](tab);
  assert.equal(tab.prevented, true);
  assert.equal(blank.active(), blank.no);
  const back = { key: "Tab", shiftKey: true, prevented: false, preventDefault() { this.prevented = true; } };
  blank.keydowns[0](back);
  assert.equal(blank.active(), blank.yes);
  const wrap = { key: "Tab", shiftKey: true, prevented: false, preventDefault() { this.prevented = true; } };
  blank.keydowns[0](wrap);
  assert.equal(blank.active(), blank.hope);

  blank.clicks.get("no")?.();
  assert.equal(blank.localMap.size, 0);
  assert.equal(blank.sessionMap.size, 0);
  assert.equal(blank.dataset.bondAge, undefined);
  assert.equal(blank.attrs["data-declined"], "true");
  assert.equal(blank.active(), blank.denied);

  const yesGate = loadStaticGate(new Map(), new Map());
  yesGate.clicks.get("yes")?.();
  const saved = JSON.parse(yesGate.localMap.get("bond_age_ok") ?? "") as { ok: boolean; t: number };
  assert.equal(saved.ok, true);
  assert.equal(typeof saved.t, "number");
  assert.equal(yesGate.sessionMap.get("bond_age_ok"), String(saved.t));
  assert.equal(yesGate.dataset.bondAge, "ok");

  const expired = loadStaticGate(new Map([["bond_age_ok", "1710000000000"]]), new Map());
  assert.equal(expired.localMap.has("bond_age_ok"), false);
  assert.equal(expired.dataset.bondAge, undefined);
  assert.equal(expired.active(), expired.yes);

  const junk = loadStaticGate(new Map([["bond_age_ok", "nope"]]), new Map([["bond_age_ok", '{"ok":false}']]));
  assert.equal(junk.localMap.has("bond_age_ok"), false);
  assert.equal(junk.sessionMap.has("bond_age_ok"), false);
  assert.equal(junk.dataset.bondAge, undefined);

  const legacy = loadStaticGate(new Map(), new Map([["bond_age_ok", String(Date.now())]]));
  assert.equal(legacy.sessionMap.has("bond_age_ok"), false);
  assert.equal(legacy.localMap.size, 0);
  assert.equal(legacy.dataset.bondAge, undefined);
  assert.equal(legacy.active(), legacy.yes);
  legacy.clicks.get("yes")?.();
  const afterYes = JSON.parse(legacy.localMap.get("bond_age_ok") ?? "") as { ok: boolean; t: number };
  assert.equal(afterYes.ok, true);
  assert.equal(legacy.sessionMap.get("bond_age_ok"), String(afterYes.t));
  assert.equal(legacy.dataset.bondAge, "ok");

  const homeLocal = new Map<string, string>();
  const homeSession = new Map<string, string>([["bond_age_ok", String(Date.now())]]);
  let homeVerified = false;
  const homeDoc = {
    documentElement: { dataset: {} as { bondAge?: string }, getAttribute() { return null; } },
    getElementById() { return null; },
    querySelector() { return null; },
    addEventListener() {},
    activeElement: null,
  };
  const mount = new Function(
    "document",
    "localStorage",
    "sessionStorage",
    "window",
    "setTimeout",
    "getComputedStyle",
    "CustomEvent",
    methodSource("componentDidMount() {"),
  );
  mount.call(
    { setState(next: { verified?: boolean }) { if (next.verified) homeVerified = true; } },
    homeDoc,
    {
      getItem(key: string) { return homeLocal.get(key) ?? null; },
      setItem() { throw new Error("localStorage written before Yes"); },
      removeItem(key: string) { homeLocal.delete(key); },
    },
    {
      getItem(key: string) { return homeSession.get(key) ?? null; },
      setItem() { throw new Error("sessionStorage written before Yes"); },
      removeItem(key: string) { homeSession.delete(key); },
    },
    { dispatchEvent() { return true; } },
    () => 0,
    () => ({ display: "block", visibility: "visible" }),
    CustomEvent,
  );
  assert.equal(homeVerified, false);
  assert.equal(homeSession.has("bond_age_ok"), false);
  assert.equal(homeLocal.size, 0);
});

test("one click replaces the birth date form and keeps the warning box", () => {
  const consent = "By entering you confirm you are 21 or older and consent to view cannabis-related material.";
  const remember = "We remember your answer on this device for 30 days.";
  const full =
    "For use only by persons 21 years of age and older. Keep out of reach of children and pets. If someone accidentally consumes cannabis, contact the Poison Center. Consume responsibly.";
  const denied =
    "You must be 21 or older to visit this site. If you or someone you know needs support, the NYS HOPEline is confidential: call 1-877-8-HOPENY or text HOPENY (467369).";
  const noJs = "This site is intended for adults 21 and older. Please enable JavaScript to verify your age.";

  const gateJs = read("bond-age-gate.js");
  assert.match(gateJs, /yesEl\.focus\(\{ preventScroll: true \}\)/);
  assert.match(gateJs, /ev\.key !== "Tab"/);
  assert.match(gateJs, /controls\[next\]\.focus\(\)/);
  assert.equal(gateJs.includes("document.cookie"), false);
  assert.equal(gateJs.includes("location.search"), false);
  assert.equal(gateJs.includes("URLSearchParams"), false);
  assert.equal(gateJs.includes("fetch("), false);

  const view = read("src/components/bond-age-gate.tsx");
  assert.match(view, /role="dialog"/);
  assert.match(view, /aria-modal="true"/);
  assert.match(view, /aria-labelledby=/);
  assert.match(view, /yesRef\.current\?\.focus\(\{ preventScroll: true \}\)/);
  assert.match(view, /ev\.key !== "Tab"/);
  assert.equal(view.includes("type=\"checkbox\""), false);
  assert.equal(view.includes("Birth month"), false);
  assert.equal(view.includes("document.cookie"), false);
  assert.equal(view.includes("fetch("), false);
  assert.match(view, /Come back when you&apos;re 21\./);
  assert.ok(view.includes(consent));
  assert.ok(view.includes(remember));
  assert.ok(view.includes(full));
  assert.ok(view.includes(denied));

  const gate = read("AgeGate.dc.html");
  const noscript = gate.slice(gate.indexOf("<noscript>"), gate.indexOf("</noscript>"));
  const scripted = gate.slice(gate.indexOf("<x-dc>"));
  assert.match(noscript, /This site is intended for adults 21 and older\. Please enable JavaScript to verify your age\./);
  assert.equal(noscript.includes("Birth month"), false);
  assert.equal(noscript.includes("type=\"checkbox\""), false);
  assert.match(scripted, /role="dialog"/);
  assert.match(scripted, /getElementById\('bond-age-yes'\)/);
  assert.match(scripted, /document\.addEventListener\('keydown', trap, true\)/);
  assert.equal(scripted.includes("Birth month"), false);
  assert.equal(scripted.includes("type=\"checkbox\""), false);
  assert.equal(scripted.includes("document.cookie"), false);
  assert.ok(scripted.includes(consent));
  assert.ok(scripted.includes(remember));
  assert.ok(scripted.includes(full));

  const css = read("bond-age-gate.css");
  assert.match(css, /font-size: 9px/);
  const boxRule = css.slice(css.indexOf(".bond-warn-box p {"), css.indexOf("}", css.indexOf(".bond-warn-box p {")));
  assert.equal(boxRule.includes("scale("), false);
  assert.equal(boxRule.includes("zoom"), false);
  assert.equal(boxRule.includes("overflow"), false);
  assert.match(boxRule, /font-family: Arial, Helvetica, sans-serif/);

  for (const name of ["FAQ.dc.html", "Privacy.dc.html", "Terms.dc.html", "Finder.dc.html"]) {
    const html = read(name);
    assert.match(html, /id="bond-age-yes"/, name);
    assert.match(html, /id="bond-age-no"/, name);
    assert.match(html, /role="dialog"/, name);
    assert.match(html, /aria-modal="true"/, name);
    assert.ok(html.includes(consent), name);
    assert.ok(html.includes(remember), name);
    assert.ok(html.includes(full), name);
    assert.ok(html.includes(denied), name);
    const gateBlock = html.slice(html.indexOf('id="bond-age-gate"'), html.indexOf('class="bond-floor"'));
    assert.equal(gateBlock.includes("Birth month"), false, name);
    assert.equal(gateBlock.includes("type=\"checkbox\""), false, name);
    assert.equal(html.includes("document.cookie"), false, name);
    assert.equal(html.includes("URLSearchParams"), false, name);
  }

  for (const name of ["Home.dc.html", "No1.dc.html", "No2.dc.html", "No3.dc.html"]) {
    const html = read(name);
    assert.match(html, /dc-import name="AgeGate"/, name);
    assert.ok(html.includes(noJs), name);
    const coverStart = html.indexOf('<div id="bond-gate-cover">');
    const cover = html.slice(coverStart, html.indexOf("</div></div></div>", coverStart));
    assert.equal(cover.includes("I am 21 years of age or older"), false, name);
    assert.match(cover, /class="bond-warn-box"/, name);
    assert.match(html, /attributeFilter: \["inert", "aria-hidden"\]/, name);
    assert.match(html, /new MutationObserver/, name);
    if (html.includes('body>*:not(#bond-gate-cover){visibility:hidden}')) {
      assert.match(html, /html:not\(\[data-bond-age="ok"\]\) \.bond-age-dc,/, name);
      assert.match(html, /html:not\(\[data-bond-age="ok"\]\) \.bond-age-dc \*,/, name);
    }
  }
});
