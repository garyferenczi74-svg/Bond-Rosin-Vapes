import { redirect } from "next/navigation";
import { HausUpdatesOptIn } from "@/app/haus/updates-opt-in";
import { HausWritesStrip } from "@/components/haus-writes-strip";
import { HausFrame } from "@/components/haus-frame";
import { requireMemberSession } from "@/lib/haus-gate";
import { memberNeedsWelcome } from "@/lib/member";
import { getSignupStore } from "@/lib/signups";

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

  const subscribed = await getSignupStore().hasHausUpdate(member.email);

  return (
    <HausFrame title="Salon">
      <HausUpdatesOptIn subscribed={subscribed} />
      <HausWritesStrip />
    </HausFrame>
  );
}
