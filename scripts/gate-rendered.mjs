// Rendered age-gate coverage. Loads every gated route with empty storage
// and checks the dialog, heading, both buttons, and warning box are painted.
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import { chromium, webkit } from "playwright";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
let nextChild = null;

function killNextGroup(signal) {
  const proc = nextChild;
  if (!proc || !proc.pid) return;
  try {
    process.kill(-proc.pid, signal);
  } catch {
    try {
      proc.kill(signal);
    } catch {
      /* already gone */
    }
  }
}

async function stopNext() {
  const proc = nextChild;
  if (!proc || !proc.pid) return;
  const pid = proc.pid;
  killNextGroup("SIGTERM");
  const started = Date.now();
  while (Date.now() - started < 4000) {
    try {
      process.kill(-pid, 0);
    } catch {
      nextChild = null;
      return;
    }
    await delay(100);
  }
  killNextGroup("SIGKILL");
  await delay(200);
  nextChild = null;
}

function onStopSignal(code) {
  const proc = nextChild;
  if (proc && proc.pid) {
    try {
      process.kill(-proc.pid, "SIGKILL");
    } catch {
      try {
        proc.kill("SIGKILL");
      } catch {
        /* already gone */
      }
    }
  }
  process.exit(code);
}

process.on("SIGINT", () => onStopSignal(130));
process.on("SIGTERM", () => onStopSignal(143));
process.on("exit", () => {
  const proc = nextChild;
  if (!proc || !proc.pid) return;
  try {
    process.kill(-proc.pid, "SIGKILL");
  } catch {
    try {
      proc.kill("SIGKILL");
    } catch {
      /* already gone */
    }
  }
});

const ROUTES = [
  ["Home", "/"],
  ["No1", "/no1"],
  ["No2", "/no2"],
  ["No3", "/no3"],
  ["FAQ", "/faq"],
  ["Finder", "/finder"],
  ["Terms", "/terms"],
  ["Privacy", "/privacy"],
  ["order", "/order"],
  ["haus", "/haus"],
];

const VIEWPORTS = [
  { width: 1366, height: 768, label: "1366" },
  { width: 390, height: 844, label: "390" },
];

function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = address && typeof address === "object" ? address.port : 0;
      server.close(() => resolve(port));
    });
    server.on("error", reject);
  });
}

async function waitForServer(base, child) {
  const started = Date.now();
  let last = "";
  while (Date.now() - started < 120000) {
    if (child.exitCode != null) {
      throw new Error("next dev exited " + child.exitCode + " " + last);
    }
    try {
      const res = await fetch(base + "/", { redirect: "manual" });
      if (res.status < 500) return;
      last = String(res.status);
    } catch (err) {
      last = err instanceof Error ? err.message : String(err);
    }
    await delay(400);
  }
  throw new Error("next dev did not answer: " + last);
}

function startNext(port) {
  const child = spawn("npx", ["next", "dev", "--port", String(port)], {
    cwd: root,
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, BROWSER: "none" },
  });
  let log = "";
  const take = (chunk) => {
    log += chunk.toString();
    if (log.length > 8000) log = log.slice(-8000);
  };
  child.stdout.on("data", take);
  child.stderr.on("data", take);
  child.logTail = () => log;
  return child;
}

async function launchEngine(name) {
  if (name === "chromium") {
    try {
      return await chromium.launch({ headless: true });
    } catch {
      return await chromium.launch({ channel: "chrome", headless: true });
    }
  }
  return webkit.launch({ headless: true });
}

async function inspect(page) {
  await page.waitForFunction(
    () => {
      const heading = document.getElementById("bond-gate-h");
      if (!heading) return false;
      const style = getComputedStyle(heading);
      const box = heading.getBoundingClientRect();
      return style.visibility !== "hidden" && style.display !== "none" && box.width > 0 && box.height > 0;
    },
    { timeout: 25000 },
  );
  return page.evaluate(() => {
    function paint(el) {
      if (!el) return { ok: false, reason: "missing" };
      const style = getComputedStyle(el);
      const box = el.getBoundingClientRect();
      const ok =
        style.visibility !== "hidden" &&
        style.display !== "none" &&
        Number(style.opacity) > 0 &&
        box.width > 0 &&
        box.height > 0;
      return {
        ok,
        visibility: style.visibility,
        display: style.display,
        opacity: style.opacity,
        w: Math.round(box.width),
        h: Math.round(box.height),
      };
    }
    const dialog = document.querySelector('[role="dialog"][aria-modal="true"]');
    const heading = document.getElementById("bond-gate-h");
    const yes = document.getElementById("bond-age-yes");
    const no = document.getElementById("bond-age-no");
    const warn = dialog ? dialog.querySelector(".bond-warn-box") : null;
    const text = (el) => (el ? (el.textContent || "").replace(/\s+/g, " ").trim() : "");
    let hit = { inDialog: false, id: "" };
    if (yes) {
      const box = yes.getBoundingClientRect();
      const top = document.elementFromPoint(box.left + box.width / 2, box.top + Math.min(box.height / 2, 12));
      hit = {
        inDialog: !!(dialog && top && (top === dialog || dialog.contains(top))),
        id: top && top.id ? top.id : "",
      };
    }
    return {
      dialog: paint(dialog),
      heading: paint(heading),
      yes: paint(yes),
      no: paint(no),
      warn: paint(warn),
      headingText: text(heading),
      yesText: text(yes),
      noText: text(no),
      warnLegal: text(warn).includes("For use only by persons 21 years of age and older."),
      hit,
      local: localStorage.getItem("bond_age_ok"),
      session: sessionStorage.getItem("bond_age_ok"),
    };
  });
}

function passed(row) {
  return (
    row.dialog.ok &&
    row.heading.ok &&
    row.yes.ok &&
    row.no.ok &&
    row.warn.ok &&
    row.headingText === "Are you 21 or older?" &&
    row.yesText === "Yes, I am 21 or older" &&
    row.noText === "No" &&
    row.warnLegal &&
    row.hit.inDialog &&
    row.local == null &&
    row.session == null
  );
}

async function main() {
  const sync = spawn("node", ["scripts/sync-public.mjs"], { cwd: root, stdio: "inherit" });
  const syncCode = await new Promise((resolve) => sync.on("exit", resolve));
  if (syncCode !== 0) throw new Error("sync-public failed");

  let base = process.env.GATE_BASE || "";
  if (!base) {
    const port = await freePort();
    base = "http://127.0.0.1:" + port;
    nextChild = startNext(port);
    const child = nextChild;
    try {
      await waitForServer(base, child);
    } catch (err) {
      console.error(child.logTail());
      killNextGroup("SIGTERM");
      throw err;
    }
  }

  const engines = [
    ["chromium", chromium],
    ["webkit", webkit],
  ];
  const results = [];
  const shotDir = process.env.GATE_SHOTS || "";
  if (shotDir) mkdirSync(shotDir, { recursive: true });

  try {
    for (const [engineName] of engines) {
      const browser = await launchEngine(engineName);
      try {
        for (const viewport of VIEWPORTS) {
          for (const [route, path] of ROUTES) {
            const context = await browser.newContext({ viewport });
            await context.addInitScript(() => {
              try {
                localStorage.removeItem("bond_age_ok");
              } catch (e) {
                /* empty visit */
              }
              try {
                sessionStorage.removeItem("bond_age_ok");
              } catch (e) {
                /* empty visit */
              }
            });
            const page = await context.newPage();
            let row;
            try {
              await page.goto(base + path, { waitUntil: "domcontentloaded", timeout: 60000 });
              const detail = await inspect(page);
              row = { engine: engineName, viewport: viewport.label, route, path, ok: passed(detail), ...detail };
              if (shotDir && viewport.label === "1366" && engineName === "chromium") {
                await page.screenshot({ path: join(shotDir, route.replace("/", "") + "-1366.png") });
              }
            } catch (err) {
              row = {
                engine: engineName,
                viewport: viewport.label,
                route,
                path,
                ok: false,
                error: err instanceof Error ? err.message : String(err),
              };
            }
            results.push(row);
            const mark = row.ok ? "pass" : "FAIL";
            console.log(mark + " " + engineName + " " + viewport.label + " " + route);
            if (!row.ok) console.log(JSON.stringify(row));
            await context.close();
          }
        }
      } finally {
        await browser.close();
      }
    }
  } finally {
    await stopNext();
  }

  const byEngine = {};
  for (const row of results) {
    const key = row.engine + ":" + row.route;
    if (!byEngine[key]) byEngine[key] = { engine: row.engine, route: row.route, checks: 0, passed: 0 };
    byEngine[key].checks += 1;
    if (row.ok) byEngine[key].passed += 1;
  }
  const coverage = Object.values(byEngine).map((item) => ({
    ...item,
    pct: item.checks ? Math.round((item.passed / item.checks) * 100) : 0,
  }));
  const total = results.length;
  const wins = results.filter((row) => row.ok).length;
  const report = {
    base,
    total,
    passed: wins,
    pct: total ? Math.round((wins / total) * 100) : 0,
    coverage,
    results,
  };
  const out = process.env.GATE_REPORT || "/tmp/gate-rendered-report.json";
  try {
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, JSON.stringify(report, null, 2));
  } catch {
    /* report is also on stdout */
  }
  console.log("coverage " + wins + "/" + total + " (" + report.pct + "%)");
  for (const item of coverage) {
    console.log(item.engine + " " + item.route + " " + item.passed + "/" + item.checks);
  }
  process.exit(wins === total ? 0 : 1);
}

main().catch(async (err) => {
  console.error(err);
  await stopNext();
  process.exit(1);
});
