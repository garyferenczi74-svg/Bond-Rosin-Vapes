import type { AdminRole, WingId } from "@/lib/tokens";
import { HausWing } from "./haus-views";
import { ProductWing } from "./product-views";
import { SecurityWing } from "./security-views";
import { SocialWing } from "./social-views";

export function WingMosaic({
  id,
  consoleId,
  role,
  onToast,
}: {
  id: Exclude<WingId, "command">;
  consoleId?: string;
  role: AdminRole;
  onToast: (msg: string) => void;
}) {
  if (id === "product") return <ProductWing consoleId={consoleId} role={role} onToast={onToast} />;
  if (id === "security") return <SecurityWing consoleId={consoleId} role={role} onToast={onToast} />;
  if (id === "haus") return <HausWing consoleId={consoleId} role={role} onToast={onToast} />;
  return <SocialWing consoleId={consoleId} onToast={onToast} />;
}
