import { AgeGateShell } from "@/components/age-gate-shell";

export default function HausLayout({ children }: { children: React.ReactNode }) {
  return <AgeGateShell>{children}</AgeGateShell>;
}
