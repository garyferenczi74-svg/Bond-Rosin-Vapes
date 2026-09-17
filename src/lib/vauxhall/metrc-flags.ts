export const METRC_ADAPTER_CONNECT = "connect";
export const METRC_ADAPTER_MOCK = "mock";

export type MetrcAdapterMode = "mock" | "connect";

export type MetrcFlagEnv = {
  METRC_ADAPTER?: string;
  METRC_ENV?: string;
  METRC_LIVE?: string;
  VERCEL_ENV?: string;
};

function norm(value: string | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

export function readMetrcAdapterMode(env: MetrcFlagEnv = process.env): MetrcAdapterMode {
  if (norm(env.METRC_ADAPTER) !== METRC_ADAPTER_CONNECT) return METRC_ADAPTER_MOCK;
  if (norm(env.VERCEL_ENV) === "production") return METRC_ADAPTER_MOCK;
  if (norm(env.METRC_LIVE) === "on") return METRC_ADAPTER_MOCK;
  if (norm(env.METRC_ENV) === "production") return METRC_ADAPTER_MOCK;
  return METRC_ADAPTER_CONNECT;
}

export function isMetrcConnectEnabled(env: MetrcFlagEnv = process.env): boolean {
  return readMetrcAdapterMode(env) === METRC_ADAPTER_CONNECT;
}
