import { PortalFrame } from "@/components/portal-frame";
import { WingStub } from "@/components/wing-stub";
import { writeAudit } from "@/lib/audit";
import { requirePortalSession } from "@/lib/gate";
import { readRequestMeta } from "@/lib/request-meta";
import { createSupabaseServer } from "@/lib/supabase/server";

export default async function CommandPage() {
  const session = await requirePortalSession();
  const supabase = await createSupabaseServer();
  await writeAudit(supabase, {
    actor: session.userId,
    action: "admin.view_wing",
    target: "command",
    before: null,
    after: { wing: "command" },
    meta: await readRequestMeta("/vauxhall"),
  });

  return (
    <PortalFrame role={session.role} active="command">
      <WingStub id="command" />
    </PortalFrame>
  );
}
