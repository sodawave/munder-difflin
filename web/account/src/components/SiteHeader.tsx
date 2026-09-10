import styles from "./SiteHeader.module.css";

export function SiteHeader({ email }: { email?: string | null }) {
  return (
    <header className={styles.header}>
      <a className={styles.brand} href="/">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className={styles.mark} src="/logo-mark.svg" alt="" width={28} height={28} />
        Munder Difflin
      </a>
      <nav className={styles.nav}>
        <a href="https://munderdiffl.in/#pricing">Pricing</a>
        <a href="https://munderdiffl.in/#download">Download</a>
        <a href="https://munderdiffl.in/">Docs</a>
        {email ? (
          <form action="/api/auth/sign-out" method="post">
            <button type="submit" className={styles.linkBtn}>
              Sign out
            </button>
          </form>
        ) : (
          <>
            <a href="/sign-in">Sign in</a>
            <a className={styles.cta} href="/sign-in">
              Start a trial
            </a>
          </>
        )}
      </nav>
    </header>
  );
}
