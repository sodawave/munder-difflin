"use client";

import { useState } from "react";
import styles from "./licence.module.css";

export function CheckoutButtons({ installId }: { installId: string }) {
  const [interval, setInterval] = useState<"month" | "year">("month");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function checkout() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ interval, installId: installId || undefined }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Checkout failed");
      if (body.url) {
        window.location.href = body.url;
        return;
      }
      if (body.devActivated) {
        window.location.href = "/pro/licence/manage?dev=1";
        return;
      }
      throw new Error("No checkout URL returned");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Checkout failed");
      setBusy(false);
    }
  }

  return (
    <div className={styles.checkout}>
      <div className={styles.tabs}>
        <button
          type="button"
          className={interval === "month" ? styles.tabOn : styles.tab}
          onClick={() => setInterval("month")}
        >
          <strong>Monthly</strong>
          <span>$20.00 for one month</span>
        </button>
        <button
          type="button"
          className={interval === "year" ? styles.tabOn : styles.tab}
          onClick={() => setInterval("year")}
        >
          <strong>Yearly</strong>
          <span>$150.00 for one year</span>
        </button>
      </div>
      <button type="button" className={styles.buy} disabled={busy} onClick={() => void checkout()}>
        {busy
          ? "Starting checkout…"
          : interval === "month"
            ? "Get one month of Pro for $20.00"
            : "Get one year of Pro for $150.00"}
      </button>
      {error ? <p className={styles.error}>{error}</p> : null}
    </div>
  );
}
