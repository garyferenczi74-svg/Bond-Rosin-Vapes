import type { Metadata } from "next";
import "./globals.css";
import { aptosStack } from "@/lib/tokens";
import { AGE_GATE_CRITICAL, HAUS_AGE_BOOT, HAUS_FONT_LATE } from "@/lib/haus/age-gate";

export const metadata: Metadata = {
  title: "Bond",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <style dangerouslySetInnerHTML={{ __html: AGE_GATE_CRITICAL }} />
        <script dangerouslySetInnerHTML={{ __html: HAUS_AGE_BOOT }} />
        <script dangerouslySetInnerHTML={{ __html: HAUS_FONT_LATE }} />
      </head>
      <body style={{ fontFamily: aptosStack }}>
        {children}
      </body>
    </html>
  );
}
