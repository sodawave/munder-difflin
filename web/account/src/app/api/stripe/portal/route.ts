import { NextResponse } from "next/server";
import { getOrCreateUser, getSessionEmail } from "@/lib/session";
import { appBaseUrl, getStripe } from "@/lib/stripe";

export async function POST(req: Request) {
  const email = await getSessionEmail();
  if (!email) return NextResponse.redirect(new URL("/sign-in", req.url));
  const user = getOrCreateUser(email);
  const stripe = getStripe();

  if (!stripe || !user.licence.stripeCustomerId) {
    return NextResponse.redirect(new URL("/pro/licence/manage?portal=unavailable", req.url));
  }

  const portal = await stripe.billingPortal.sessions.create({
    customer: user.licence.stripeCustomerId,
    return_url: `${appBaseUrl()}/pro/licence/manage`,
  });
  return NextResponse.redirect(portal.url);
}
