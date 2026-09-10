import { redirect } from "next/navigation";
import { bindInstallId, getOrCreateUser, getSessionEmail } from "@/lib/session";
import { SiteHeader } from "@/components/SiteHeader";
import styles from "./manage.module.css";
import { SignInCodeButton } from "./SignInCodeButton";

export default async function LicenceManagePage({
  searchParams,
}: {
  searchParams: Promise<{ installId?: string; portal?: string; dev?: string }>;
}) {
  const email = await getSessionEmail();
  if (!email) redirect("/sign-in?next=/pro/licence/manage");
  const user = getOrCreateUser(email);
  const sp = await searchParams;

  if (sp.installId && user.licence.status === "active") {
    bindInstallId(user, sp.installId);
  }

  const hasPro = user.licence.status === "active";
  const refreshed = getOrCreateUser(email);

  return (
    <div>
      <SiteHeader email={email} />
      <main className={styles.main}>
        <h1>Your licence</h1>
        <p className={styles.sub}>
          Key, payments and machine for <strong>{refreshed.email}</strong>
        </p>
        {sp.portal === "unavailable" ? (
          <p className={styles.notice}>
            Stripe Customer Portal needs a live customer id. Local/dev activations manage billing
            here instead.
          </p>
        ) : null}

        <section className={styles.card}>
          <div className={styles.head}>
            <h2>Billing</h2>
            <span className={styles.badge}>
              <span className={styles.dot} aria-hidden />
              {hasPro ? "Pro" : "No plan"}
            </span>
          </div>
          {hasPro ? (
            <>
              <p className={styles.big}>Pro active</p>
              <p className={styles.muted}>
                {refreshed.licence.interval === "year"
                  ? "$150.00 a year."
                  : refreshed.licence.interval === "month"
                    ? "$20.00 a month."
                    : "Subscription on file."}
              </p>
              <p className={styles.key}>
                Licence key: <code>{refreshed.licence.key || "—"}</code>
              </p>
              <form action="/api/stripe/portal" method="post">
                <button type="submit" className={styles.secondaryBtn}>
                  Manage billing in Stripe
                </button>
              </form>
            </>
          ) : (
            <>
              <p className={styles.big}>No plan yet</p>
              <p className={styles.muted}>Get PRO and your card and invoices appear here.</p>
              <p className={styles.muted}>$20.00 a month.</p>
              <a className={styles.goldBtn} href="/pro/licence">
                Get Pro
              </a>
            </>
          )}
        </section>

        <section className={styles.card}>
          <h2>Sign in to the app</h2>
          <p className={styles.muted}>
            When Munder Difflin asks you to sign in, make a code here and paste it into the app.
          </p>
          <SignInCodeButton />
        </section>

        <section className={styles.card}>
          <h2>Your machine</h2>
          {refreshed.licence.installId ? (
            <>
              <p className={styles.muted}>
                Bound install: <code>{refreshed.licence.installId}</code>
              </p>
              <form action="/api/licence/unbind" method="post">
                <button type="submit" className={styles.secondaryBtn}>
                  Move to another machine
                </button>
              </form>
            </>
          ) : (
            <>
              <p className={styles.muted}>No machine is using this licence yet.</p>
              <p className={styles.muted}>
                {hasPro
                  ? "Open Upgrade from the desktop app so installId is appended, or redeem your key against this machine."
                  : "Get a licence and its key goes into the app on the machine you want to use it on."}
              </p>
              <button type="button" className={styles.disabledBtn} disabled>
                Move to another machine
              </button>
            </>
          )}
        </section>

        <section className={styles.card}>
          <h2>Invoices</h2>
          {refreshed.invoices.length === 0 ? (
            <p className={styles.muted}>No invoices yet.</p>
          ) : (
            <ul className={styles.invoices}>
              {refreshed.invoices.map((inv) => (
                <li key={inv.id}>
                  <span>{inv.date}</span>
                  <span>{inv.amount}</span>
                  {inv.url ? (
                    <a href={inv.url} target="_blank" rel="noreferrer">
                      PDF
                    </a>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={styles.card}>
          <h2>Download</h2>
          <p className={styles.muted}>Latest desktop build.</p>
          <a className={styles.goldBtn} href="https://munderdiffl.in/#download">
            Download for macOS
          </a>
        </section>
      </main>
    </div>
  );
}
