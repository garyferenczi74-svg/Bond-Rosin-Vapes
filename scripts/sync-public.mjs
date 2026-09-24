import { cpSync, existsSync, lstatSync, mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const publicDir = join(root, "public");

const files = [
  "Home.dc.html",
  "No1.dc.html",
  "No2.dc.html",
  "No3.dc.html",
  "AgeGate.dc.html",
  "haus-age-host.dc.html",
  "FAQ.dc.html",
  "Terms.dc.html",
  "Privacy.dc.html",
  "Finder.dc.html",
  "404.html",
  "support.js",
  "video-policy.js",
  "image-slot.js",
  "image-slots.state.json",
];

const dirs = ["media"];

const blocked = new Set([
  "Admin.dc.html",
  "Vauxhall.dc.html",
  "Haus.dc.html",
  "HausAdmin.dc.html",
  "Product.dc.html",
  "Security.dc.html",
  "Social.dc.html",
]);

mkdirSync(publicDir, { recursive: true });

function assertRealFile(path, name) {
  const stat = lstatSync(path);
  if (stat.isSymbolicLink()) {
    throw new Error("copy stayed a symlink: " + name);
  }
  if (stat.isFile() && stat.size === 0) {
    throw new Error("copy is empty: " + name);
  }
}

function copy(name) {
  if (blocked.has(name)) {
    throw new Error("refusing to publish admin html: " + name);
  }
  const from = join(root, name);
  const to = join(publicDir, name);
  if (!existsSync(from)) {
    throw new Error("missing marketing file: " + name);
  }
  if (existsSync(to)) {
    rmSync(to, { recursive: true, force: true });
  }
  cpSync(from, to, { recursive: true, dereference: true });
  assertRealFile(to, name);
}

for (const name of files) copy(name);
for (const name of dirs) copy(name);

for (const name of blocked) {
  const leaked = join(publicDir, name);
  if (existsSync(leaked)) {
    rmSync(leaked, { force: true });
  }
}

const indexTo = join(publicDir, "index.html");
if (existsSync(indexTo)) {
  rmSync(indexTo, { force: true });
}
cpSync(join(root, "Home.dc.html"), indexTo, { dereference: true });
assertRealFile(indexTo, "index.html");

for (const name of readdirSync(publicDir)) {
  if (blocked.has(name)) {
    throw new Error("admin html leaked into public/: " + name);
  }
  const path = join(publicDir, name);
  if (lstatSync(path).isSymbolicLink()) {
    throw new Error("public still has a symlink: " + name);
  }
}

const homeBytes = statSync(join(publicDir, "Home.dc.html")).size;
if (homeBytes < 1000) {
  throw new Error("Home.dc.html copy looks too small");
}

console.log("copied marketing assets into public/ as real files");
