import { BondAgeGate } from "@/components/bond-age-gate";
import { AGE_GATE_CRITICAL, HAUS_AGE_BOOT } from "@/lib/haus/age-gate";

export function AgeGateShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: HAUS_AGE_BOOT }} />
      <style dangerouslySetInnerHTML={{ __html: AGE_GATE_CRITICAL }} />
      <BondAgeGate>{children}</BondAgeGate>
    </>
  );
}
