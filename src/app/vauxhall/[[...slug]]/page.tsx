import { notFound } from "next/navigation";
import { CommandApp } from "@/components/vauxhall/command-app";
import { SignupLedger } from "@/components/vauxhall/signup-ledger";
import { writeAudit } from "@/lib/audit";
import { requirePortalSession } from "@/lib/gate";
import { readPartnerDraftPersist } from "@/lib/order/session";
import { readRequestMeta } from "@/lib/request-meta";
import { readOwnerSignupLedger } from "@/lib/signups/ledger";
import { createSupabaseServer } from "@/lib/supabase/server";
import { readMetrcAdapterMode } from "@/lib/vauxhall/metrc-flags";
import { parseVauxhallRoute } from "@/lib/vauxhall/routes";

export default async function VauxhallPage({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}) {
  const session = await requirePortalSession();
  const { slug } = await params;
  const route = parseVauxhallRoute(slug);
  if (!route) notFound();

  const supabase = await createSupabaseServer();
  await writeAudit(supabase, {
    actor: session.userId,
    action: "admin.view_wing",
    target: route.wing,
    before: null,
    after: { wing: route.wing, view: route.view, role: session.role },
    meta: await readRequestMeta(route.path),
  });

  const partnerRequests = await readPartnerDraftPersist();
  const signups = await readOwnerSignupLedger(session.role);
  return (
    <>
    {signups ? <SignupLedger ledger={signups} /> : null}
    <CommandApp
      role={session.role}
      email={session.email}
      route={route}
      partnerRequests={partnerRequests}
      metrcAdapterMode={readMetrcAdapterMode()}
    />
    </>
  );
}
