import { NextResponse } from "next/server";
import { getOrCreateUser, setSessionEmail } from "@/lib/session";

export async function POST(req: Request) {
  const form = await req.formData();
  const email = String(form.get("email") || "").trim().toLowerCase();
  const next = String(form.get("next") || "/hub");
  if (!email || !email.includes("@")) {
    return NextResponse.redirect(new URL("/sign-in?error=Enter%20a%20valid%20email", req.url));
  }
  getOrCreateUser(email);
  await setSessionEmail(email);
  const dest = next.startsWith("/") ? next : "/hub";
  return NextResponse.redirect(new URL(dest, req.url));
}
