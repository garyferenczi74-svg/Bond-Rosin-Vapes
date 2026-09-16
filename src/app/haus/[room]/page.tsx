import { notFound, redirect } from "next/navigation";
import { requireMemberSession } from "@/lib/haus-gate";
import { isMemberRoom, memberNeedsWelcome } from "@/lib/member";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Bond Haus",
  robots: { index: false, follow: false },
};

export default async function HausRoomStub({
  params,
}: {
  params: Promise<{ room: string }>;
}) {
  const { room } = await params;
  if (room === "salon" || room === "welcome") {
    redirect(room === "salon" ? "/haus/salon" : "/haus/welcome");
  }
  if (!isMemberRoom(room)) {
    notFound();
  }

  const { member, ack } = await requireMemberSession();
  if (memberNeedsWelcome(ack, member.email)) {
    redirect("/haus/welcome");
  }
  redirect("/haus/salon");
}
