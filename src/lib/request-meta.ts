import { headers } from "next/headers";

export type RequestMeta = {
  ip: string | null;
  userAgent: string | null;
  path: string | null;
};

export async function readRequestMeta(path?: string): Promise<RequestMeta> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || h.get("x-real-ip");
  return {
    ip: ip || null,
    userAgent: h.get("user-agent"),
    path: path ?? h.get("x-bond-path") ?? null,
  };
}
