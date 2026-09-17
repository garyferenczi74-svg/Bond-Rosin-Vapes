import { OrderClient } from "@/app/order/order-client";
import { readPartnerSession } from "@/lib/order/session";
import { getVauxhallStore } from "@/lib/vauxhall/store";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Bond Order",
  robots: { index: false, follow: false },
};

export default async function OrderPage() {
  const session = await readPartnerSession();
  if (!session) {
    return <OrderClient />;
  }

  const store = getVauxhallStore();
  const account = store.accountById(session.accountId);
  const gate = store.orderGate(session.accountId);
  return (
    <OrderClient
      session={{
        email: session.email,
        accountId: session.accountId,
        license: session.license,
        accountName: account?.name ?? session.accountId,
      }}
      gate={gate.ok ? { ok: true } : { ok: false, reason: gate.reason }}
    />
  );
}
