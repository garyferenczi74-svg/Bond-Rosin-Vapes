import { OrderClient } from "@/app/order/order-client";
import { ORDER_COPY } from "@/lib/order/copy";
import { findPartnerAccount, isPartnerElevated } from "@/lib/order/door";
import { readPartnerAccountBook, readPartnerSession } from "@/lib/order/session";
import { getVauxhallStore } from "@/lib/vauxhall/store";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Dispensary Login",
  robots: { index: false, follow: false },
};

export default async function OrderPage() {
  const session = await readPartnerSession();
  if (!session) {
    return <OrderClient />;
  }

  const book = await readPartnerAccountBook();
  const account = findPartnerAccount({ email: session.email, license: session.license }, book);
  if (!account) {
    return <OrderClient />;
  }

  const elevated = isPartnerElevated({ email: session.email, license: session.license }, book);
  const store = getVauxhallStore();
  const wholesale = store.accountById(session.accountId);
  const storeGate = store.orderGate(session.accountId);
  const gate = !elevated
    ? { ok: false as const, reason: ORDER_COPY.pendingBlock }
    : storeGate.ok
      ? { ok: true as const }
      : { ok: false as const, reason: storeGate.reason };

  return (
    <OrderClient
      session={{
        email: session.email,
        accountId: session.accountId,
        license: session.license,
        accountName: wholesale?.name ?? account.license,
        elevated,
      }}
      gate={gate}
    />
  );
}
