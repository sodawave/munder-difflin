import { redirect } from "next/navigation";
import { getSessionEmail } from "@/lib/session";
import styles from "./welcome.module.css";

export default async function ConsoleWelcomePage() {
  const email = await getSessionEmail();
  if (!email) redirect("/sign-in?next=/console/welcome");

  return (
    <div className={styles.shell}>
      <aside className={styles.aside}>
        <div className={styles.brand}>
          <span className={styles.mark} />
          <div>
            <strong>Munder Difflin</strong>
            <div className={styles.meta}>No organisation yet</div>
          </div>
        </div>
        <div className={styles.navLabel}>Account</div>
        <a className={styles.navItem} href="/pro">
          Profile
        </a>
        <div className={styles.asideFoot}>
          <span className={styles.avatar}>Y</span>
          <div>
            <div>You</div>
            <div className={styles.meta}>Admin</div>
          </div>
        </div>
      </aside>
      <div className={styles.main}>
        <header className={styles.top}>
          <div>Console › Welcome</div>
          <a href="/api/auth/sign-out">Sign out</a>
        </header>
        <section className={styles.panel}>
          <span className={styles.markLg} />
          <h1>How will you use Munder Difflin?</h1>
          <p>
            Both run every agent on your own machine. This only decides how it is paid for and who
            else can reach it.
          </p>
          <div className={styles.choices}>
            <a className={styles.choice} href="/console/teams-soon">
              <strong>Set up a team</strong>
              <span>
                An organisation with seats and a shared floor. Fourteen days free once a card is on
                file.
              </span>
            </a>
            <a className={styles.choice} href="/pro">
              <strong>Work on your own</strong>
              <span>
                One machine and a key of its own. No organisation, no seats, and the team surfaces
                are simply not there.
              </span>
            </a>
          </div>
        </section>
      </div>
    </div>
  );
}
