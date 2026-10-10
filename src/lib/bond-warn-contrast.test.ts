import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { WARNING_ROUTES } from "./bond-warnings.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

function read(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

function channel(value: number) {
  const unit = value / 255;
  return unit <= 0.04045 ? unit / 12.92 : ((unit + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string) {
  const raw = hex.replace("#", "");
  const red = Number.parseInt(raw.slice(0, 2), 16);
  const green = Number.parseInt(raw.slice(2, 4), 16);
  const blue = Number.parseInt(raw.slice(4, 6), 16);
  return 0.2126 * channel(red) + 0.7152 * channel(green) + 0.0722 * channel(blue);
}

function contrast(ink: string, surface: string) {
  const lighter = Math.max(luminance(ink), luminance(surface));
  const darker = Math.min(luminance(ink), luminance(surface));
  return (lighter + 0.05) / (darker + 0.05);
}

function tokenMap(css: string) {
  const map = new Map<string, string>();
  for (const match of css.matchAll(/--([A-Za-z0-9-]+):\s*([^;}{]+)/g)) {
    map.set(match[1], match[2].trim());
  }
  return map;
}

function resolveColor(value: string, tokens: Map<string, string>, depth = 0): string {
  if (depth > 6) return "";
  const ref = value.match(/var\(--([A-Za-z0-9-]+)\)/);
  if (ref) {
    const next = tokens.get(ref[1]);
    if (!next) return "";
    return resolveColor(next, tokens, depth + 1);
  }
  const hex = value.match(/#[0-9A-Fa-f]{6}/);
  return hex ? hex[0].toUpperCase() : "";
}

function firstHex(pattern: RegExp, text: string) {
  const match = text.match(pattern);
  return match ? match[1].toUpperCase() : "";
}

test("HOPEline and licensee contrast stays at or above 4.5:1 on every route gate and footer", () => {
  const tokensCss = read("bond-tokens.css");
  const tokens = tokenMap(tokensCss + "\n" + read("bond-age-gate.css"));
  const css = read("bond-age-gate.css");
  const rule = css.match(/\.bond-warn-hope,\s*\.bond-warn-hope a,\s*\.bond-warn-license \{([^}]*)\}/);
  assert.ok(rule, "hope and license share one color rule");
  const block = rule[1];
  assert.match(block, /color:\s*var\(--bond-warn-meta\)/);
  assert.match(block, /background:\s*var\(--bond-warn-panel\)/);
  assert.equal(/#[0-9A-Fa-f]{3,8}/.test(block), false);
  assert.match(tokensCss, /--bond-warn-panel:\s*var\(--matte-black\)/);
  assert.match(tokensCss, /--bond-warn-meta:\s*var\(--bone\)/);
  assert.equal(/--bond-warn-panel:\s*#/.test(tokensCss), false);
  assert.equal(/--bond-warn-meta:\s*#/.test(tokensCss), false);

  const ink = resolveColor("var(--bond-warn-meta)", tokens);
  const panel = resolveColor("var(--bond-warn-panel)", tokens);
  const ageInk = resolveColor(tokens.get("age-ink") ?? "", tokens);
  assert.ok(ink && panel && ageInk, "warn tokens resolve to hex");
  const painted = contrast(ink, panel);
  assert.equal(painted.toFixed(2), "12.22");

  const tokenFile = read("src/lib/tokens.ts");
  const matte = firstHex(/matteBlack:\s*"(#[0-9A-Fa-f]{6})"/, tokenFile);
  const bone = firstHex(/bone:\s*"(#[0-9A-Fa-f]{6})"/, tokenFile);
  assert.equal(matte, panel);
  assert.equal(bone, ink);

  const ageGate = read("AgeGate.dc.html");
  const importGate = firstHex(/background:(#[0-9A-Fa-f]{6})/i, ageGate);
  assert.equal(importGate, ageInk);

  const rows: string[] = [];
  for (const route of WARNING_ROUTES) {
    const html = route.file ? read(route.file) : "";
    const places = ["footer"];
    if (route.gate !== "none") places.unshift("gate");

    if (route.file) {
      assert.equal(html.includes('class="bond-warn-hope"'), true, route.file);
      assert.equal(html.includes('class="bond-warn-license"'), true, route.file);
      assert.equal(/<p class="bond-warn-hope"[^>]*style=/.test(html), false, route.file);
      assert.equal(/<p class="bond-warn-license"[^>]*style=/.test(html), false, route.file);
    }

    for (const place of places) {
      for (const line of ["hope", "license"]) {
        assert.ok(painted >= 4.5, `${route.route} ${place} ${line} ${painted.toFixed(2)}`);
        rows.push(`${route.route} ${place} ${line} ${ink} on ${panel} ${painted.toFixed(2)}`);
      }
    }
  }

  assert.match(read("src/components/bond-warn.tsx"), /className="bond-warn-hope"/);
  assert.match(read("src/components/bond-warn.tsx"), /className="bond-warn-license"/);
  assert.match(read("src/components/bond-age-gate.tsx"), /<BondWarn route=\{route\} holdLicense \/>/);
  assert.match(read("src/components/compliance-band.tsx"), /<BondWarn route=\{route\} holdLicense \/>/);
  console.log(rows.join("\n"));
});

test("finder uses the shared gate and writes the directory only after entry", () => {
  const finder = read("Finder.dc.html");
  const start = finder.indexOf("function publishFinderDirectory");
  const end = finder.indexOf("window.addEventListener('bond-entered', publishFinderDirectory)");
  assert.ok(start > 0 && end > start);
  const body = finder.slice(start, end);
  assert.match(body, /localStorage\.setItem\('bondDispensaryDir'/);
  assert.match(body, /localStorage\.setItem\('bondNyCities'/);
  const rest = finder.slice(0, start) + finder.slice(end);
  assert.equal(rest.includes("localStorage.setItem"), false);
  assert.match(
    finder,
    /You must be 21 or older to visit this site\. If you or someone you know needs support, the NYS HOPEline is confidential: call <span class="bond-age-tel">1-877-8-HOPENY<\/span> or text HOPENY \(467369\)\./,
  );
  assert.equal(
    finder.includes("Sold only at dispensaries licensed by New York State. This site does not sell cannabis."),
    true,
  );
  assert.equal(finder.includes("lawfully ship"), false);
  assert.match(finder, /src="\/bond-age-gate\.js"/);
  assert.equal(finder.includes('id="gate"'), false);
  assert.match(finder, /Cannabis can be addictive\./);
});
