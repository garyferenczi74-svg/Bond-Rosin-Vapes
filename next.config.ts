import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async rewrites() {
    return [
      { source: "/Home", destination: "/Home.dc.html" },
      { source: "/home", destination: "/Home.dc.html" },
      { source: "/No1", destination: "/No1.dc.html" },
      { source: "/no1", destination: "/No1.dc.html" },
      { source: "/No2", destination: "/No2.dc.html" },
      { source: "/no2", destination: "/No2.dc.html" },
      { source: "/No3", destination: "/No3.dc.html" },
      { source: "/no3", destination: "/No3.dc.html" },
      { source: "/FAQ", destination: "/FAQ.dc.html" },
      { source: "/faq", destination: "/FAQ.dc.html" },
      { source: "/Terms", destination: "/Terms.dc.html" },
      { source: "/terms", destination: "/Terms.dc.html" },
      { source: "/Privacy", destination: "/Privacy.dc.html" },
      { source: "/privacy", destination: "/Privacy.dc.html" },
      { source: "/Haus", destination: "/Haus.dc.html" },
      { source: "/Finder", destination: "/Finder.dc.html" },
      { source: "/finder", destination: "/Finder.dc.html" },
      { source: "/AgeGate", destination: "/AgeGate.dc.html" },
      { source: "/agegate", destination: "/AgeGate.dc.html" },
    ];
  },
};

export default nextConfig;
