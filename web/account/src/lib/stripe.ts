import Stripe from "stripe";

export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) return null;
  return new Stripe(key, { apiVersion: "2026-08-26.dahlia" });
}

export function priceIdFor(interval: "month" | "year"): string | null {
  if (interval === "year") return process.env.STRIPE_PRICE_PRO_YEAR?.trim() || null;
  return process.env.STRIPE_PRICE_PRO_MONTH?.trim() || null;
}

export function appBaseUrl() {
  return (process.env.MD_ACCOUNT_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
}

export const PRO_PRICES = {
  month: { label: "$20.00 for one month", amount: 20 },
  year: { label: "$150.00 for one year", amount: 150, compareAt: 200 },
} as const;
