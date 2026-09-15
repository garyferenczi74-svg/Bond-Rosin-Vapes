import { CLOAK_HTML } from "@/lib/cloak-html";

export function GET() {
  return new Response(CLOAK_HTML, {
    status: 404,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "x-robots-tag": "noindex, nofollow",
    },
  });
}
