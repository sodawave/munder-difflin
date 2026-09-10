import { NextResponse } from "next/server";
import { getOrCreateUser, getSessionEmail, saveUser } from "@/lib/session";

export async function POST(req: Request) {
  const email = await getSessionEmail();
  if (!email) return NextResponse.redirect(new URL("/sign-in", req.url));
  const user = getOrCreateUser(email);
  user.licence.installId = null;
  user.licence.updatedAt = new Date().toISOString();
  saveUser(user);
  return NextResponse.redirect(new URL("/pro/licence/manage", req.url));
}
