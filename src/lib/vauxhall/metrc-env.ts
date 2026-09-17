import { isMetrcConnectEnabled, pickEnvString, type MetrcEnvLookup, type MetrcFlagEnv } from "./metrc-flags.ts";

export const METRC_SANDBOX_INTEGRATOR_VENDOR_KEY = "METRC_SANDBOX_INTEGRATOR_VENDOR_KEY";
export const METRC_SANDBOX_LICENSEE_USER_KEY = "METRC_SANDBOX_LICENSEE_USER_KEY";
export const METRC_SANDBOX_FACILITY_LICENSE = "METRC_SANDBOX_FACILITY_LICENSE";
export const METRC_SANDBOX_BASE_URL = "METRC_SANDBOX_BASE_URL";

export const DEFAULT_METRC_SANDBOX_BASE_URL = "https://sandbox-api-ny.metrc.com";

const ALLOWED_SANDBOX_HOSTS = new Set(["sandbox-api-ny.metrc.com", "api-demo.metrc.com"]);

export type MetrcSandboxEnv = MetrcFlagEnv & {
  METRC_SANDBOX_INTEGRATOR_VENDOR_KEY?: string;
  METRC_SANDBOX_LICENSEE_USER_KEY?: string;
  METRC_SANDBOX_FACILITY_LICENSE?: string;
  METRC_SANDBOX_BASE_URL?: string;
};

export function metrcSandboxEnvFromLookup(source: MetrcEnvLookup = process.env): MetrcSandboxEnv {
  return {
    METRC_ADAPTER: pickEnvString(source, "METRC_ADAPTER"),
    METRC_ENV: pickEnvString(source, "METRC_ENV"),
    METRC_LIVE: pickEnvString(source, "METRC_LIVE"),
    VERCEL_ENV: pickEnvString(source, "VERCEL_ENV"),
    METRC_SANDBOX_INTEGRATOR_VENDOR_KEY: pickEnvString(source, "METRC_SANDBOX_INTEGRATOR_VENDOR_KEY"),
    METRC_SANDBOX_LICENSEE_USER_KEY: pickEnvString(source, "METRC_SANDBOX_LICENSEE_USER_KEY"),
    METRC_SANDBOX_FACILITY_LICENSE: pickEnvString(source, "METRC_SANDBOX_FACILITY_LICENSE"),
    METRC_SANDBOX_BASE_URL: pickEnvString(source, "METRC_SANDBOX_BASE_URL"),
  };
}

export type MetrcSandboxConfig =
  | {
      ok: true;
      vendorKey: string;
      userKey: string;
      facilityLicense: string;
      baseUrl: string;
    }
  | { ok: false; reason: string };

export function assertMetrcServerOnly(): void {
  if (typeof window !== "undefined") {
    throw new Error("Metrc sandbox keys are server-only.");
  }
}

export function resolveSandboxBaseUrl(raw?: string): { ok: true; baseUrl: string } | { ok: false; reason: string } {
  const value = (raw ?? DEFAULT_METRC_SANDBOX_BASE_URL).trim() || DEFAULT_METRC_SANDBOX_BASE_URL;
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return { ok: false, reason: "Sandbox base URL is not a valid URL." };
  }
  if (parsed.protocol !== "https:") {
    return { ok: false, reason: "Sandbox base URL must be https." };
  }
  if (!ALLOWED_SANDBOX_HOSTS.has(parsed.hostname.toLowerCase())) {
    return {
      ok: false,
      reason: "Production Metrc hosts are blocked in Phase B1. Use a sandbox host.",
    };
  }
  return { ok: true, baseUrl: `${parsed.origin}${parsed.pathname.replace(/\/$/, "")}` };
}

export function readMetrcSandboxConfig(env: MetrcEnvLookup = process.env): MetrcSandboxConfig {
  assertMetrcServerOnly();
  const sandbox = metrcSandboxEnvFromLookup(env);
  if (!isMetrcConnectEnabled(sandbox)) {
    return { ok: false, reason: "Connect adapter is off. METRC_ADAPTER=connect is preview only." };
  }
  const vendorKey = (sandbox.METRC_SANDBOX_INTEGRATOR_VENDOR_KEY ?? "").trim();
  const userKey = (sandbox.METRC_SANDBOX_LICENSEE_USER_KEY ?? "").trim();
  const facilityLicense = (sandbox.METRC_SANDBOX_FACILITY_LICENSE ?? "").trim();
  if (!vendorKey || !userKey || !facilityLicense) {
    return {
      ok: false,
      reason: "Sandbox integrator vendor key, licensee user key, and facility license are not configured.",
    };
  }
  const base = resolveSandboxBaseUrl(sandbox.METRC_SANDBOX_BASE_URL);
  if (!base.ok) return base;
  return {
    ok: true,
    vendorKey,
    userKey,
    facilityLicense,
    baseUrl: base.baseUrl,
  };
}

export function metrcBasicAuthHeader(vendorKey: string, userKey: string): string {
  const token = Buffer.from(`${vendorKey}:${userKey}`, "utf8").toString("base64");
  return `Basic ${token}`;
}
