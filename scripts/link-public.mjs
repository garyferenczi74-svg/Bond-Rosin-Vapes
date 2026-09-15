import { mkdirSync, symlinkSync, existsSync, lstatSync, rmSync } from "node:fs";
import { join, relative } from "node:path";

const root = join(import.meta.dirname, "..");
const publicDir = join(root, "public");

const files = [
  "Home.dc.html",
  "No1.dc.html",
  "No2.dc.html",
  "No3.dc.html",
  "AgeGate.dc.html",
  "FAQ.dc.html",
  "Terms.dc.html",
  "Privacy.dc.html",
  "Finder.dc.html",
  "Haus.dc.html",
  "support.js",
  "video-policy.js",
  "image-slot.js",
  "image-slots.state.json",
];

const dirs = ["media"];

mkdirSync(publicDir, { recursive: true });

function link(name) {
  const from = join(root, name);
  const to = join(publicDir, name);
  if (!existsSync(from)) {
    throw new Error("missing marketing file: " + name);
  }
  if (existsSync(to)) {
    const stat = lstatSync(to);
    if (stat.isSymbolicLink()) {
      rmSync(to);
    } else {
      return;
    }
  }
  symlinkSync(relative(publicDir, from), to);
}

for (const name of files) link(name);
for (const name of dirs) link(name);

console.log("linked marketing assets into public/");
