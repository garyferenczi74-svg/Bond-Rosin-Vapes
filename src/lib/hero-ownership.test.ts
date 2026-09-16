import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

function read(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

function homeLayoutScript(home: string) {
  const marker = "// Home hero layout helper only (Prompt 6 unify).";
  const start = home.indexOf(marker);
  assert.ok(start > 0, "Home layout helper IIFE must exist");
  const end = home.indexOf("</script>", start);
  return home.slice(start, end);
}

test("Home source never calls BondVideo attach or release", () => {
  const home = read("Home.dc.html");
  assert.equal(home.includes("BondVideo.attach"), false);
  assert.equal(home.includes("BondVideo.release"), false);
  assert.equal(home.includes("window.BondVideo"), false);
});

test("Home IIFE is a thin Case A layout helper with no endplate writers", () => {
  const script = homeLayoutScript(read("Home.dc.html"));
  assert.match(script, /--hero-copy-top/);
  assert.match(script, /hero-copy-flow/);
  assert.match(script, /bond-entered/);
  assert.equal(script.includes("syncEndplate"), false);
  assert.equal(script.includes("hero-endplate-on"), false);
  assert.equal(script.includes("querySelector('.hero-endplate')"), false);
  assert.equal(script.includes("fillPlate("), false);
  assert.equal(script.includes("showPlate("), false);
  assert.equal(script.includes("\u2013"), false);
  assert.equal(script.includes("\u2014"), false);
});

test("video-policy.js remains the sole attach and endplate owner", () => {
  const policy = read("video-policy.js");
  assert.match(policy, /function attach\(/);
  assert.match(policy, /function fillPlate\(/);
  assert.match(policy, /function showPlate\(/);
  assert.match(policy, /pic\.classList\.add\('hero-endplate-on'\)/);
  assert.match(policy, /Home must not call attach or release/);
  assert.equal(policy.includes("\u2013"), false);
  assert.equal(policy.includes("\u2014"), false);
  const home = read("Home.dc.html");
  const writers = [...home.matchAll(/classList\.add\('hero-endplate-on'\)/g)];
  assert.equal(writers.length, 0);
});

test("SKU pages stay policy-only loop heroes with no Home attach calls", () => {
  for (const name of ["No1.dc.html", "No2.dc.html", "No3.dc.html"]) {
    const html = read(name);
    assert.match(html, /Video playback is owned by video-policy\.js/);
    assert.equal(html.includes("BondVideo.attach"), false, name);
    assert.equal(html.includes("BondVideo.release"), false, name);
    assert.equal(html.includes("hero-endplate"), false, name);
    assert.match(html, /data-bond-video/);
  }
});
