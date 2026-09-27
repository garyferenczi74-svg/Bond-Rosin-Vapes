import { AgeGateShell } from "@/components/age-gate-shell";

export default function OrderLayout({ children }: { children: React.ReactNode }) {
  return <AgeGateShell>{children}</AgeGateShell>;
}
