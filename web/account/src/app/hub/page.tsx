import { redirect } from "next/navigation";
import { getOrCreateUser, getSessionEmail } from "@/lib/session";
import { SiteHeader } from "@/components/SiteHeader";
import styles from "./hub.module.css";

export default async function HubPage() {
  const email = await getSessionEmail();
  if (!email) redirect("/sign-in?next=/hub");
  const user = getOrCreateUser(email);

  return (
    <div>
      <SiteHeader email={email} />
      <main className={styles.main}>
        <h1>Signed in as {user.email}</h1>
        <p className={styles.lede}>Pick where you are going.</p>
        <div className={styles.grid}>
          <article className={styles.card}>
            <h2>For a team</h2>
            <p>
              Create an organisation, invite people, buy seats per organisation. The console is
              where that happens.
            </p>
            <a className={styles.primary} href="/console/welcome">
              Open the console
            </a>
          </article>
          <article className={styles.card}>
            <h2>For yourself</h2>
            <p>
              The desktop app on your own machine, on the Pro plan. No organisation, no seats to
              count.
            </p>
            <a className={styles.secondary} href="/pro">
              Open your Pro dashboard
            </a>
          </article>
        </div>
        <p className={styles.signOut}>
          <a href="/api/auth/sign-out">Sign out</a>
        </p>
      </main>
    </div>
  );
}
