import { requirePortalSession } from "@/lib/gate";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Bond",
  robots: { index: false, follow: false },
};

export default async function VauxhallLayout({ children }: { children: React.ReactNode }) {
  await requirePortalSession();
  return children;
}
