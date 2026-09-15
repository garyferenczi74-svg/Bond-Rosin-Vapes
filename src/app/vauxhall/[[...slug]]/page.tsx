import { notFound } from "next/navigation";
import { CommandApp } from "@/components/vauxhall/command-app";
import { writeAudit } from "@/lib/audit";
import { requirePortalSession } from "@/lib/gate";
import { readRequestMeta } from "@/lib/request-meta";
import { createSupabaseServer } from "@/lib/supabase/server";
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
    after: { wing: route.wing, view: route.view },
    meta: await readRequestMeta(route.path),
  });

  return <CommandApp role={session.role} email={session.email} route={route} />;
}
