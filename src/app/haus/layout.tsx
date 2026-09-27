import { headers } from "next/headers";
import { AgeGateShell } from "@/components/age-gate-shell";
import { warningRouteForPath } from "@/lib/bond-warnings";

export default async function HausLayout({ children }: { children: React.ReactNode }) {
  const path = (await headers()).get("x-bond-path") ?? "/haus";
  return <AgeGateShell route={warningRouteForPath(path)}>{children}</AgeGateShell>;
}
