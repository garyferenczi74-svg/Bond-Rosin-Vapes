import type { NextConfig } from "next";

// Do not rewrite /Haus to Haus.dc.html. Next.js treats rewrite sources as
// case-insensitive, so that rule would steal the /haus App Router sign-in.
const marketingRewrites = [
  { source: "/", destination: "/Home.dc.html" },
  { source: "/Home", destination: "/Home.dc.html" },
  { source: "/home", destination: "/Home.dc.html" },
  { source: "/No1", destination: "/No1.dc.html" },
  { source: "/no1", destination: "/No1.dc.html" },
  { source: "/No2", destination: "/No2.dc.html" },
  { source: "/no2", destination: "/No2.dc.html" },
  { source: "/No3", destination: "/No3.dc.html" },
  { source: "/no3", destination: "/No3.dc.html" },
  { source: "/No-1", destination: "/No1.dc.html" },
  { source: "/no-1", destination: "/No1.dc.html" },
  { source: "/No-2", destination: "/No2.dc.html" },
  { source: "/no-2", destination: "/No2.dc.html" },
  { source: "/No-3", destination: "/No3.dc.html" },
  { source: "/no-3", destination: "/No3.dc.html" },
  { source: "/FAQ", destination: "/FAQ.dc.html" },
  { source: "/faq", destination: "/FAQ.dc.html" },
  { source: "/Terms", destination: "/Terms.dc.html" },
  { source: "/terms", destination: "/Terms.dc.html" },
  { source: "/Privacy", destination: "/Privacy.dc.html" },
  { source: "/privacy", destination: "/Privacy.dc.html" },
  { source: "/Finder", destination: "/Finder.dc.html" },
  { source: "/finder", destination: "/Finder.dc.html" },
  { source: "/AgeGate", destination: "/AgeGate.dc.html" },
  { source: "/agegate", destination: "/AgeGate.dc.html" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async rewrites() {
    return {
      beforeFiles: marketingRewrites,
    };
  },
};

export default nextConfig;
