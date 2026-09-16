import { redirect } from "next/navigation";
import { WelcomeClient } from "@/app/haus/welcome-client";
import { requireMemberSession } from "@/lib/haus-gate";
import { readHausLedger } from "@/lib/haus-ledger";
import { memberNeedsWelcome } from "@/lib/member";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Bond Haus",
  robots: { index: false, follow: false },
};

export default async function HausWelcomePage() {
  const { member, ack } = await requireMemberSession();
  if (!memberNeedsWelcome(ack, member.email)) {
    redirect("/haus/salon");
  }

  const needsAge = !(ack?.email === member.email && ack.age21);
  const ledger = await readHausLedger();
  return <WelcomeClient needsAge={needsAge} welcomeText={ledger.settings.welcomeText} />;
}
