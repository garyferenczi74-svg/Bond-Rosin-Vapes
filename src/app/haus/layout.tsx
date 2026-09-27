import { HausAgeGate } from "@/app/haus/age-gate-client";
import { HAUS_AGE_BOOT, HAUS_AGE_CSS } from "@/lib/haus/age-gate";

export default function HausLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: HAUS_AGE_BOOT }} />
      <style dangerouslySetInnerHTML={{ __html: HAUS_AGE_CSS }} />
      <HausAgeGate>{children}</HausAgeGate>
    </>
  );
}
