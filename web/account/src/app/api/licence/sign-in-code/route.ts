import { NextResponse } from "next/server";
import { getSessionEmail } from "@/lib/session";
import { randomBytes } from "node:crypto";

export async function POST() {
  const email = await getSessionEmail();
  if (!email) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const code = randomBytes(3).toString("hex").toUpperCase();
  return NextResponse.json({ code: `MD-${code}` });
}
