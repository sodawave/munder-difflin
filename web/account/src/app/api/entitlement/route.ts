import { NextResponse } from "next/server";
import { entitlementForInstall } from "@/lib/session";

function corsHeaders() {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "content-type",
  };
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const installId = (url.searchParams.get("installId") || "").trim();
  if (!installId) {
    return NextResponse.json({ error: "missing installId" }, { status: 400, headers: corsHeaders() });
  }
  return NextResponse.json(entitlementForInstall(installId), { headers: corsHeaders() });
}
