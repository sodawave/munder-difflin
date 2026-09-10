import { NextResponse } from "next/server";
import { bindInstallId, findUserByLicenceKey } from "@/lib/session";

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

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { key?: string; installId?: string };
  const key = String(body.key || "").trim();
  const installId = String(body.installId || "").trim();
  if (!key || !installId) {
    return NextResponse.json(
      { error: "key and installId required" },
      { status: 400, headers: corsHeaders() },
    );
  }

  const user = findUserByLicenceKey(key);
  if (!user || user.licence.status !== "active") {
    return NextResponse.json(
      { error: "unknown or inactive key" },
      { status: 404, headers: corsHeaders() },
    );
  }

  const result = bindInstallId(user, installId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 409, headers: corsHeaders() });
  }

  return NextResponse.json(
    {
      ok: true,
      plan: user.licence.plan,
      entitlement: {
        plan: user.licence.plan === "teams" ? "teams" : "pro",
        trialEndsAt: null,
        orgId: user.licence.orgId,
        seatId: user.licence.seatId,
        seatLabel: user.licence.seatLabel,
        networkEnabled: !!user.licence.networkEnabled && user.licence.plan === "teams",
      },
    },
    { headers: corsHeaders() },
  );
}
