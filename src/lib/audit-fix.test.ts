import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

function read(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

function videoById(html: string, id: string) {
  const match = html.match(new RegExp(`<video[^>]*id="${id}"[^>]*>`));
  assert.ok(match, id);
  return match[0];
}

const publicMarketing = [
  "Home.dc.html",
  "No1.dc.html",
  "No2.dc.html",
  "No3.dc.html",
  "AgeGate.dc.html",
  "FAQ.dc.html",
  "Terms.dc.html",
  "Privacy.dc.html",
  "Finder.dc.html",
  "404.html",
];

test("SKU inset posters use Moneypenny ACTIVE wide and narrow paths", () => {
  const no1 = videoById(read("No1.dc.html"), "no1-video");
  assert.match(no1, /poster="media\/posters\/dialed_w\.webp"/);
  assert.match(no1, /data-desktop-poster="media\/posters\/dialed_w\.webp"/);
  assert.match(no1, /data-mobile-poster="media\/posters\/dialed_n\.webp"/);
  assert.equal(no1.includes("Dialed_poster.webp"), false);

  const no2 = videoById(read("No2.dc.html"), "no2-video");
  assert.match(no2, /poster="media\/posters\/unwind_w\.webp"/);
  assert.match(no2, /data-desktop-poster="media\/posters\/unwind_w\.webp"/);
  assert.match(no2, /data-mobile-poster="media\/posters\/unwind_n\.webp"/);
  assert.equal(no2.includes("Unwind_poster.webp"), false);

  const no3 = videoById(read("No3.dc.html"), "no3-video");
  assert.match(no3, /poster="media\/posters\/peak_w\.webp"/);
  assert.match(no3, /data-desktop-poster="media\/posters\/peak_w\.webp"/);
  assert.match(no3, /data-mobile-poster="media\/posters\/peak_n\.webp"/);
  assert.equal(no3.includes("Peak_poster.webp"), false);
});

test("hero ladder, endplate, and bond_hero attrs stay on the tip lock", () => {
  const home = read("Home.dc.html");
  const hero = videoById(home, "hero-video");
  assert.match(hero, /data-desktop-webm="media\/ladder\/bond_hero_d\.1080\.vp9\.v6\.webm"/);
  assert.match(hero, /data-desktop-mp4="media\/ladder\/bond_hero_d\.1080\.h264\.v6\.mp4"/);
  assert.match(hero, /data-mobile-webm="media\/ladder\/bond_hero_m\.1080\.vp9\.v1\.webm"/);
  assert.match(hero, /data-mobile-mp4="media\/ladder\/bond_hero_m\.1080\.h264\.v1\.mp4"/);
  assert.match(hero, /data-desktop-poster="media\/posters\/bond_hero_d\.v6\.webp"/);
  assert.match(hero, /data-mobile-poster="media\/posters\/bond_hero_m\.webp"/);
  assert.match(hero, /poster="media\/posters\/bond_hero_d\.v6\.webp"/);
  assert.match(home, /media\/posters\/bond_hero_d\.v6\.webp/);
  assert.match(home, /media\/posters\/bond_hero_m\.webp/);

  const no1Hero = videoById(read("No1.dc.html"), "no1-hero-video");
  assert.match(no1Hero, /data-desktop-webm="media\/ladder\/dialed_w\.720\.vp9\.v1\.webm"/);
  assert.match(no1Hero, /data-desktop-mp4="media\/ladder\/dialed_w\.720\.h264\.v1\.mp4"/);
  assert.match(no1Hero, /data-mobile-webm="media\/ladder\/dialed_n\.720\.vp9\.v1\.webm"/);
  assert.match(no1Hero, /data-mobile-mp4="media\/ladder\/dialed_n\.720\.h264\.v1\.mp4"/);
  assert.match(no1Hero, /data-desktop-poster="media\/posters\/dialed_w\.webp"/);
  assert.match(no1Hero, /data-mobile-poster="media\/posters\/dialed_n\.webp"/);

  const no2Hero = videoById(read("No2.dc.html"), "no2-hero-video");
  assert.match(no2Hero, /data-desktop-webm="media\/ladder\/unwind_w\.720\.vp9\.v1\.webm"/);
  assert.match(no2Hero, /data-desktop-mp4="media\/ladder\/unwind_w\.720\.h264\.v1\.mp4"/);
  assert.match(no2Hero, /data-mobile-webm="media\/ladder\/unwind_n\.720\.vp9\.v1\.webm"/);
  assert.match(no2Hero, /data-mobile-mp4="media\/ladder\/unwind_n\.720\.h264\.v1\.mp4"/);
  assert.match(no2Hero, /data-desktop-poster="media\/posters\/unwind_w\.webp"/);
  assert.match(no2Hero, /data-mobile-poster="media\/posters\/unwind_n\.webp"/);

  const no3Hero = videoById(read("No3.dc.html"), "no3-hero-video");
  assert.match(no3Hero, /data-desktop-webm="media\/ladder\/peak_w\.720\.vp9\.v1\.webm"/);
  assert.match(no3Hero, /data-desktop-mp4="media\/ladder\/peak_w\.720\.h264\.v1\.mp4"/);
  assert.match(no3Hero, /data-mobile-webm="media\/ladder\/peak_n\.720\.vp9\.v1\.webm"/);
  assert.match(no3Hero, /data-mobile-mp4="media\/ladder\/peak_n\.720\.h264\.v1\.mp4"/);
  assert.match(no3Hero, /data-desktop-poster="media\/posters\/peak_w\.webp"/);
  assert.match(no3Hero, /data-mobile-poster="media\/posters\/peak_n\.webp"/);
});

test("Privacy and Terms drop the review banner and ship the locked date", () => {
  for (const name of ["Privacy.dc.html", "Terms.dc.html"]) {
    const html = read(name);
    assert.equal(html.includes("REVIEW BANNER"), false, name);
    assert.equal(html.includes("attorney review"), false, name);
    assert.equal(html.includes("[DATE]"), false, name);
    assert.equal(html.includes(".review {"), false, name);
  }
  assert.match(read("Terms.dc.html"), /Effective date: September 16, 2026\./);
  assert.match(read("Privacy.dc.html"), /Effective date: September 24, 2026\./);
});

test("kebab SKU aliases rewrite to the existing SKU pages", () => {
  const vercel = read("vercel.json");
  const next = read("next.config.ts");
  for (const pair of [
    ['"/no-1"', '"/No1.dc.html"'],
    ['"/no-2"', '"/No2.dc.html"'],
    ['"/no-3"', '"/No3.dc.html"'],
  ]) {
    assert.match(vercel, new RegExp(`"source": ${pair[0]}, "destination": ${pair[1]}`));
    assert.match(next, new RegExp(`source: ${pair[0]}, destination: ${pair[1]}`));
  }
});

test("public marketing pages drop the bare fonts.googleapis.com preconnect", () => {
  const stylesheet =
    'href="https://fonts.googleapis.com/css2?family=GFS+Didot&family=Inter:wght@400;500&display=swap"';
  for (const name of publicMarketing) {
    const html = read(name);
    assert.equal(html.includes('rel="preconnect" href="https://fonts.googleapis.com"'), false, name);
    assert.match(html, new RegExp(stylesheet.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), name);
  }
});
