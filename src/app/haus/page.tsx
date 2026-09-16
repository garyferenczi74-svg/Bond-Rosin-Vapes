import { redirect } from "next/navigation";
import { HausClient } from "@/app/haus/haus-client";
import { adminPortalAllowed } from "@/lib/access";
import { floorPathForMember, readDoorContext } from "@/lib/haus-gate";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Bond Haus",
  robots: { index: false, follow: false },
};

export default async function HausPage() {
  const { user, admin, member, ack } = await readDoorContext();
  if (user && adminPortalAllowed({ admin })) {
    redirect("/vauxhall");
  }
  if (member) {
    redirect(floorPathForMember(ack, member.email));
  }

  return <HausClient />;
}
