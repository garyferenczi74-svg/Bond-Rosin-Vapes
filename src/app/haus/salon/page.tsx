import { redirect } from "next/navigation";
import { HausWritesStrip } from "@/components/haus-writes-strip";
import { HausFrame } from "@/components/haus-frame";
import { requireMemberSession } from "@/lib/haus-gate";
import { memberNeedsWelcome } from "@/lib/member";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Salon",
  robots: { index: false, follow: false },
};

export default async function HausSalonPage() {
  const { member, ack } = await requireMemberSession();
  if (memberNeedsWelcome(ack, member.email)) {
    redirect("/haus/welcome");
  }

  return (
    <HausFrame title="Salon">
      <HausWritesStrip />
    </HausFrame>
  );
}
