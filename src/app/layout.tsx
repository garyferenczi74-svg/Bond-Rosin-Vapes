import type { Metadata } from "next";
import "./globals.css";
import { aptosStack } from "@/lib/tokens";
import { AGE_GATE_CRITICAL, HAUS_AGE_BOOT } from "@/lib/haus/age-gate";

export const metadata: Metadata = {
  title: "Bond",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link
          rel="preload"
          as="font"
          type="font/woff2"
          href="/fonts/inter-latin.woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          as="font"
          type="font/woff2"
          href="/fonts/gfs-didot-latin-400.woff2"
          crossOrigin="anonymous"
        />
        <style dangerouslySetInnerHTML={{ __html: AGE_GATE_CRITICAL }} />
        <script dangerouslySetInnerHTML={{ __html: HAUS_AGE_BOOT }} />
      </head>
      <body style={{ fontFamily: aptosStack }}>
        {children}
      </body>
    </html>
  );
}
