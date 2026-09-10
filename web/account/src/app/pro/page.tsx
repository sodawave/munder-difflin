import { redirect } from "next/navigation";
import { getOrCreateUser, getSessionEmail } from "@/lib/session";
import { SiteHeader } from "@/components/SiteHeader";
import { PRO_PRICES } from "@/lib/stripe";
import styles from "./pro.module.css";

export default async function ProDashboardPage() {
  const email = await getSessionEmail();
  if (!email) redirect("/sign-in?next=/pro");
  const user = getOrCreateUser(email);
  const hasPro = user.licence.status === "active" && (user.licence.plan === "pro" || user.licence.plan === "teams");

  return (
    <div>
      <SiteHeader email={email} />
      <main className={styles.main}>
        <h1>Your Pro dashboard</h1>
        <div className={styles.top}>
          <div>
            <div className={styles.name}>{user.name}</div>
            <div className={styles.email}>{user.email}</div>
          </div>
          <a className={styles.signOut} href="/api/auth/sign-out">
            Sign out
          </a>
        </div>

        <section className={styles.card}>
          <div className={styles.cardHead}>
            <h2>Munder Difflin Pro</h2>
            <span className={styles.badge}>{hasPro ? "Pro" : "Free"}</span>
          </div>
          <p className={styles.status}>
            {hasPro
              ? `Licence active${user.licence.interval ? ` · billed ${user.licence.interval}ly` : ""}.`
              : "No Pro licence on this account yet."}
          </p>
          <div className={styles.row}>
            {hasPro ? (
              <a className={styles.primary} href="/pro/licence">
                Open your licence
              </a>
            ) : (
              <a className={styles.primary} href="/pro/licence">
                Get Pro from ${PRO_PRICES.month.amount.toFixed(2)}
              </a>
            )}
            <a className={styles.secondary} href="https://munderdiffl.in/#download">
              Download for macOS
            </a>
          </div>
          {!hasPro ? (
            <p className={styles.offer}>
              Launch offer: <s>${PRO_PRICES.year.compareAt.toFixed(2)}</s>{" "}
              <strong>${PRO_PRICES.year.amount.toFixed(2)}</strong> for a year, saving $
              {(PRO_PRICES.year.compareAt - PRO_PRICES.year.amount).toFixed(2)}.
            </p>
          ) : null}
          <p className={styles.hint}>
            Your key, your payments and your machine live on{" "}
            <a href="/pro/licence">your licence page</a>.
          </p>
          <hr />
          <p className={styles.teamHint}>
            Running a team? <a href="/console/welcome">Open the team console.</a>
          </p>
        </section>
      </main>
    </div>
  );
}
