import { redirect } from "next/navigation";
import { bindInstallId, getOrCreateUser, getSessionEmail, saveUser } from "@/lib/session";
import { SiteHeader } from "@/components/SiteHeader";
import { PRO_PRICES } from "@/lib/stripe";
import styles from "./licence.module.css";
import { CheckoutButtons } from "./CheckoutButtons";

const FEATURES = [
  { title: "The orchestrator", body: "One desk that routes the floor." },
  { title: "Agents", body: "Hire clones that work in real terminals." },
  { title: "Tasks", body: "Break work into tickets the floor can hold." },
  { title: "Inbox", body: "Mail between clones stays on your machine." },
  { title: "Automations", body: "Recurring jobs without babysitting." },
  { title: "Memory", body: "Long-running context the office can reuse." },
  { title: "Capabilities", body: "Tools each clone is allowed to touch." },
  { title: "Temps", body: "Short-lived workers for burst work." },
];

export default async function LicenceBuyPage({
  searchParams,
}: {
  searchParams: Promise<{ installId?: string }>;
}) {
  const email = await getSessionEmail();
  if (!email) redirect("/sign-in?next=/pro/licence");
  const user = getOrCreateUser(email);
  const sp = await searchParams;

  if (sp.installId && user.licence.status !== "active") {
    user.licence.installId = sp.installId;
    saveUser(user);
  }
  if (user.licence.status === "active") {
    if (sp.installId) bindInstallId(user, sp.installId);
    redirect(`/pro/licence/manage${sp.installId ? `?installId=${encodeURIComponent(sp.installId)}` : ""}`);
  }

  return (
    <div>
      <SiteHeader email={email} />
      <main className={styles.main}>
        <h1>Your licence</h1>
        <p className={styles.offer}>
          Launch offer: 25% off. <s>${PRO_PRICES.year.compareAt.toFixed(2)}</s>{" "}
          <strong>${PRO_PRICES.year.amount.toFixed(2)}</strong> for a year.
        </p>
        <section className={styles.card}>
          <div className={styles.chips}>
            <span className={styles.chipPro}>PRO</span>
            <span className={styles.chipSoft}>One machine at a time</span>
          </div>
          <h2>What you get with a PRO licence</h2>
          <p className={styles.lede}>
            The professional workspace sits beside the classic office. Everything still runs on your
            machine — we only handle the licence and the bill.
          </p>
          <div className={styles.features}>
            {FEATURES.map((f) => (
              <div key={f.title} className={styles.feature}>
                <strong>{f.title}</strong>
                <span>{f.body}</span>
              </div>
            ))}
          </div>
          <CheckoutButtons installId={sp.installId || user.licence.installId || ""} />
        </section>
      </main>
    </div>
  );
}
