import { BondAgeGate } from "@/components/bond-age-gate";
import { HAUS_AGE_BOOT } from "@/lib/haus/age-gate";

const ORDER_AGE_CRITICAL = `html:not([data-bond-age="ok"]) .bond-floor { visibility: hidden; }
html[data-bond-age="ok"] .bond-age-gate { display: none; }`;

export default function OrderLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <link rel="stylesheet" href="/bond-age-gate.css" />
      <script dangerouslySetInnerHTML={{ __html: HAUS_AGE_BOOT }} />
      <style dangerouslySetInnerHTML={{ __html: ORDER_AGE_CRITICAL }} />
      <BondAgeGate>{children}</BondAgeGate>
    </>
  );
}
