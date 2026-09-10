import { NextResponse } from "next/server";
import {
  getOrCreateUser,
  getSessionEmail,
  mintLicenceKey,
  saveUser,
} from "@/lib/session";
import { appBaseUrl, getStripe, priceIdFor } from "@/lib/stripe";

export async function POST(req: Request) {
  const email = await getSessionEmail();
  if (!email) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as {
    interval?: "month" | "year";
    installId?: string;
  };
  const interval = body.interval === "year" ? "year" : "month";
  const user = getOrCreateUser(email);
  if (body.installId) {
    user.licence.installId = body.installId;
    saveUser(user);
  }

  const stripe = getStripe();
  const priceId = priceIdFor(interval);

  if (!stripe || !priceId) {
    user.licence = {
      ...user.licence,
      plan: "pro",
      status: "active",
      interval,
      key: user.licence.key || mintLicenceKey("pro"),
      networkEnabled: false,
      updatedAt: new Date().toISOString(),
    };
    user.invoices = [
      {
        id: `dev_${Date.now()}`,
        amount: interval === "year" ? "$150.00" : "$20.00",
        date: new Date().toISOString().slice(0, 10),
      },
      ...user.invoices,
    ];
    saveUser(user);
    return NextResponse.json({ ok: true, devActivated: true });
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer_email: email,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${appBaseUrl()}/pro/licence/manage?checkout=success`,
    cancel_url: `${appBaseUrl()}/pro/licence?checkout=cancel`,
    metadata: {
      email,
      installId: user.licence.installId || "",
      plan: "pro",
      interval,
    },
  });

  return NextResponse.json({ url: session.url });
}
