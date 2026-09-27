import { BondAgeGate } from "@/components/bond-age-gate";
import type { WarningRoute } from "@/lib/bond-warnings";
import { AGE_GATE_CRITICAL, HAUS_AGE_BOOT } from "@/lib/haus/age-gate";

export function AgeGateShell({ route, children }: { route: WarningRoute; children: React.ReactNode }) {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: HAUS_AGE_BOOT }} />
      <style dangerouslySetInnerHTML={{ __html: AGE_GATE_CRITICAL }} />
      <div id="bond-gate-cover" aria-hidden="true" />
      <BondAgeGate route={route}>{children}</BondAgeGate>
    </>
  );
}
