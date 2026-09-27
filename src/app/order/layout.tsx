import { AgeGateShell } from "@/components/age-gate-shell";

export default function OrderLayout({ children }: { children: React.ReactNode }) {
  return <AgeGateShell route="/order">{children}</AgeGateShell>;
}
