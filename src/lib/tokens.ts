export const SKU_ACCENTS = {
  "no-1": "#79C84A",
  "no-2": "#86ACE3",
  "no-3": "#A53A28",
} as const;

export type SkuAccentId = keyof typeof SKU_ACCENTS;

export const tokens = {
  matteBlack: "#1B1D1C",
  deepCharcoal: "#2A2A2A",
  bone: "#E1DAD0",
  product: SKU_ACCENTS["no-1"],
  social: SKU_ACCENTS["no-2"],
  security: SKU_ACCENTS["no-3"],
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
    summary: "The room where the Section is visible.",
  },
  {
    id: "product",
    href: "/vauxhall/product",
    title: "Product",
    hairline: tokens.product,
    summary: "The Numbered Collection. Choose your moment.",
  },
  {
    id: "security",
    href: "/vauxhall/security",
    title: "Security",
    hairline: tokens.security,
    summary: "Cite. Remediate. Document.",
  },
  {
    id: "social",
    href: "/vauxhall/social",
    title: "Social",
    hairline: tokens.social,
    summary: "Carver desk. Placeholder until Prompt 2C.",
  },
];
