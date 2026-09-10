import { NextResponse } from "next/server";
import { getOrCreateUser, mintLicenceKey, saveUser } from "@/lib/session";
import { getStripe } from "@/lib/stripe";
import type Stripe from "stripe";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const stripe = getStripe();
  if (!stripe) return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });

  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  const raw = await req.text();
  let event: Stripe.Event;
  try {
    if (secret) {
      const sig = req.headers.get("stripe-signature") || "";
      event = stripe.webhooks.constructEvent(raw, sig, secret);
    } else {
      event = JSON.parse(raw) as Stripe.Event;
    }
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Invalid webhook" },
      { status: 400 },
    );
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const email = (session.customer_email || session.metadata?.email || "").toLowerCase();
    if (email) {
      const user = getOrCreateUser(email);
      const interval = session.metadata?.interval === "year" ? "year" : "month";
      user.licence = {
        ...user.licence,
        plan: "pro",
        status: "active",
        interval,
        key: user.licence.key || mintLicenceKey("pro"),
        stripeCustomerId:
          typeof session.customer === "string" ? session.customer : user.licence.stripeCustomerId,
        stripeSubscriptionId:
          typeof session.subscription === "string"
            ? session.subscription
            : user.licence.stripeSubscriptionId,
        installId: session.metadata?.installId || user.licence.installId,
        networkEnabled: false,
        updatedAt: new Date().toISOString(),
      };
      user.invoices = [
        {
          id: session.id,
          amount: interval === "year" ? "$150.00" : "$20.00",
          date: new Date().toISOString().slice(0, 10),
        },
        ...user.invoices,
      ];
      saveUser(user);
    }
  }

  return NextResponse.json({ received: true });
}
