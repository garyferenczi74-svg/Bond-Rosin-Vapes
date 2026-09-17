export const METRC_ADAPTER_CONNECT = "connect";
export const METRC_ADAPTER_MOCK = "mock";

export type MetrcAdapterMode = "mock" | "connect";

export type MetrcEnvLookup = {
  readonly [key: string]: string | undefined;
};

export type MetrcFlagEnv = {
  METRC_ADAPTER?: string;
  METRC_ENV?: string;
  METRC_LIVE?: string;
  VERCEL_ENV?: string;
};

function norm(value: string | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

export function pickEnvString(source: MetrcEnvLookup, key: string): string | undefined {
  const value = source[key];
  return typeof value === "string" ? value : undefined;
}

export function metrcFlagEnvFromLookup(source: MetrcEnvLookup = process.env): MetrcFlagEnv {
  return {
    METRC_ADAPTER: pickEnvString(source, "METRC_ADAPTER"),
    METRC_ENV: pickEnvString(source, "METRC_ENV"),
    METRC_LIVE: pickEnvString(source, "METRC_LIVE"),
    VERCEL_ENV: pickEnvString(source, "VERCEL_ENV"),
  };
}

export function readMetrcAdapterMode(env: MetrcEnvLookup = process.env): MetrcAdapterMode {
  const flags = metrcFlagEnvFromLookup(env);
  if (norm(flags.METRC_ADAPTER) !== METRC_ADAPTER_CONNECT) return METRC_ADAPTER_MOCK;
  if (norm(flags.VERCEL_ENV) === "production") return METRC_ADAPTER_MOCK;
  if (norm(flags.METRC_LIVE) === "on") return METRC_ADAPTER_MOCK;
  if (norm(flags.METRC_ENV) === "production") return METRC_ADAPTER_MOCK;
  return METRC_ADAPTER_CONNECT;
}

export function isMetrcConnectEnabled(env: MetrcEnvLookup = process.env): boolean {
  return readMetrcAdapterMode(env) === METRC_ADAPTER_CONNECT;
}
