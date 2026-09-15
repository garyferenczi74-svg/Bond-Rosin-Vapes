import { PortalFrame } from "@/components/portal-frame";
import { WingStub } from "@/components/wing-stub";
import { writeAudit } from "@/lib/audit";
import { requirePortalSession } from "@/lib/gate";
import { readRequestMeta } from "@/lib/request-meta";
import { createSupabaseServer } from "@/lib/supabase/server";

export default async function ProductPage() {
  const session = await requirePortalSession();
  const supabase = await createSupabaseServer();
  await writeAudit(supabase, {
    actor: session.userId,
    action: "admin.view_wing",
    target: "product",
    before: null,
    after: { wing: "product" },
    meta: await readRequestMeta("/vauxhall/product"),
  });

  return (
    <PortalFrame role={session.role} active="product">
      <WingStub id="product" />
    </PortalFrame>
  );
}
