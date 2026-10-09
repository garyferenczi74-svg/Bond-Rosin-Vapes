import { getSignupStore } from "@/lib/signups";
import { confirmHausUpdate } from "@/lib/signups/haus-updates";

export const dynamic = "force-dynamic";

function page(text: string, status: number) {
  const body = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>Bond Haus</title></head><body><p>${text}</p></body></html>`;
  return new Response(body, {
    status,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  const result = await confirmHausUpdate(token, getSignupStore());
  if (!result.ok && result.reason === "off") {
    return page("Bond Haus update confirmation is off. No email is sent.", 200);
  }
  if (!result.ok) {
    return page("This confirmation link is not valid.", 400);
  }
  return page("Bond Haus updates are confirmed.", 200);
}
