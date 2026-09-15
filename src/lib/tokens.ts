export const tokens = {
  matteBlack: "#1B1D1C",
  deepCharcoal: "#2A2A2A",
  bone: "#E1DAD0",
  product: "#79C84A",
  social: "#86ACE3",
  security: "#A53A28",
  muted: "#8E887C",
  line: "#3A3C3B",
} as const;

export const aptosStack =
  "Aptos, 'Segoe UI Variable', 'Segoe UI', system-ui, sans-serif";

export type AdminRole = "owner" | "operator";

export type WingId = "command" | "product" | "security" | "social";

export const wings: {
  id: WingId;
  href: string;
  title: string;
  hairline: string;
  summary: string;
}[] = [
  {
    id: "command",
    href: "/vauxhall",
    title: "Command Center",
    hairline: tokens.bone,
    summary: "Live feed, agents, review, and steering.",
  },
  {
    id: "product",
    href: "/vauxhall/product",
    title: "Product",
    hairline: tokens.product,
    summary: "This wing is framed. Consoles arrive with the portal build.",
  },
  {
    id: "security",
    href: "/vauxhall/security",
    title: "Security",
    hairline: tokens.security,
    summary: "This wing is framed. Consoles arrive with the portal build.",
  },
  {
    id: "social",
    href: "/vauxhall/social",
    title: "Social",
    hairline: tokens.social,
    summary: "This wing is framed. Consoles arrive with the portal build.",
  },
];
