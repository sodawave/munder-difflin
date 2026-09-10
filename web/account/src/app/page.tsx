import { redirect } from "next/navigation";
import { getSessionEmail } from "@/lib/session";
import { SiteHeader } from "@/components/SiteHeader";
import styles from "./home.module.css";

export default async function HomePage() {
  const email = await getSessionEmail();
  if (email) redirect("/hub");

  return (
    <div className={styles.page}>
      <SiteHeader />
      <main className={styles.main}>
        <p className={styles.kicker}>Munder Difflin account</p>
        <h1>Licence, billing and download — outside the desktop app.</h1>
        <p className={styles.lede}>
          The app never sees your card. Sign in here to start Pro, refresh your key, or open the
          team console later.
        </p>
        <div className={styles.actions}>
          <a className={styles.primary} href="/sign-in">
            Sign in
          </a>
          <a className={styles.secondary} href="https://munderdiffl.in/" target="_blank" rel="noreferrer">
            Product site
          </a>
        </div>
      </main>
    </div>
  );
}
