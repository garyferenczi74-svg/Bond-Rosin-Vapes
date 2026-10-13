import { spawnSync, type SpawnSyncReturns } from "node:child_process";
import { closeSync, openSync, readFileSync, unlinkSync, writeSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const lockPath = join(tmpdir(), "bond-pg-role-tests.lock");

function commandParts(): string[] {
  const raw = process.env.BOND_TEST_PSQL?.trim();
  if (raw) return raw.split(/\s+/).filter((part) => part.length > 0);
  return ["sudo", "-n", "-u", "postgres", "psql"];
}

// psql treats -d as the whole connection and drops a URI host. When a URL is
// set, fold -d into that URL and keep the host, port, and user.
function connectionArgs(extra: string[]): string[] {
  const url = process.env.BOND_TEST_PGURL?.trim();
  if (!url) return extra;
  const dbFlag = extra.indexOf("-d");
  const database = dbFlag >= 0 ? extra[dbFlag + 1] : "";
  if (dbFlag >= 0 && database && !database.startsWith("-")) {
    const rewritten = new URL(url);
    rewritten.pathname = `/${database}`;
    return [rewritten.toString(), ...extra.slice(0, dbFlag), ...extra.slice(dbFlag + 2)];
  }
  return [url, ...extra];
}

export function runPsql(extra: string[]): SpawnSyncReturns<string> {
  const parts = commandParts();
  return spawnSync(parts[0], [...parts.slice(1), "-v", "ON_ERROR_STOP=1", ...connectionArgs(extra)], {
    encoding: "utf8",
  });
}

export function postgresTestReady(): boolean {
  const probe = runPsql(["-tAc", "SELECT 1"]);
  return probe.status === 0 && probe.stdout.trim() === "1";
}

function sleep(ms: number) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

// anon, authenticated, service_role, and bond_retention are cluster-wide.
// The DB tests share one server, so they take this lock for the whole body.
export function acquirePgLock(): () => void {
  const started = Date.now();
  for (;;) {
    try {
      const fd = openSync(lockPath, "wx");
      writeSync(fd, `${process.pid}\n`);
      closeSync(fd);
      return () => {
        try {
          if (readFileSync(lockPath, "utf8").trim() === String(process.pid)) unlinkSync(lockPath);
        } catch {
          /* already released */
        }
      };
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "EEXIST") throw error;
      try {
        const pid = Number(readFileSync(lockPath, "utf8").trim());
        if (!Number.isInteger(pid) || pid <= 0) {
          unlinkSync(lockPath);
          continue;
        }
        try {
          process.kill(pid, 0);
        } catch {
          unlinkSync(lockPath);
          continue;
        }
      } catch {
        /* another worker took or removed the lock */
      }
      if (Date.now() - started > 180000) {
        throw new Error("timed out waiting for the Postgres test lock");
      }
      sleep(200);
    }
  }
}
