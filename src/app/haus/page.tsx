import { HausClient } from "@/app/haus/haus-client";
import { readAdminRow } from "@/lib/gate";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Bond Haus",
  robots: { index: false, follow: false },
};

export default async function HausPage() {
  const { user, admin } = await readAdminRow();
  const signedMember = Boolean(user) && !admin;

  return <HausClient signedMember={signedMember} />;
}
