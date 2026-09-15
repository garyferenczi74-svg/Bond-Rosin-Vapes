import type { Metadata } from "next";
import { GFS_Didot } from "next/font/google";
import "./globals.css";
import { aptosStack } from "@/lib/tokens";

const didot = GFS_Didot({
  weight: "400",
  subsets: ["greek", "latin"],
  display: "swap",
  variable: "--font-didot",
});

export const metadata: Metadata = {
  title: "Bond",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={didot.variable} style={{ fontFamily: aptosStack }}>
        {children}
      </body>
    </html>
  );
}
