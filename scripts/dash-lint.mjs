import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const roots = ["src", "scripts", "supabase/migrations", "README.md", ".env.example"];
const skip = new Set(["node_modules", ".next", "public", ".git"]);

const hits = [];

function walk(rel) {
  const full = join(root, rel);
  const stat = statSync(full);
  if (stat.isDirectory()) {
    for (const name of readdirSync(full)) {
      if (skip.has(name)) continue;
      walk(join(rel, name));
    }
    return;
  }
  if (!/\.(ts|tsx|js|mjs|css|md|sql|json|example)$/.test(rel) && !rel.endsWith("README.md")) {
    return;
  }
  const text = readFileSync(full, "utf8");
  for (const [i, line] of text.split(/\n/).entries()) {
    if (line.includes("\u2013") || line.includes("\u2014")) {
      hits.push(`${rel}:${i + 1}`);
    }
  }
}

for (const rel of roots) walk(rel);

if (hits.length) {
  console.error("em dash or en dash found:");
  for (const hit of hits) console.error("  " + hit);
  process.exit(1);
}

console.log("dash lint clean");
