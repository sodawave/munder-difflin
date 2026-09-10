import { SiteHeader } from "@/components/SiteHeader";
import styles from "./sign-in.module.css";

export default function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  return (
    <SignInInner searchParams={searchParams} />
  );
}

async function SignInInner({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const sp = await searchParams;
  return (
    <div>
      <SiteHeader />
      <main className={styles.main}>
        <h1>Sign in</h1>
        <p className={styles.lede}>
          Use the email on your receipt. In local/dev we skip the magic link and open a session
          directly — production will send a one-time code.
        </p>
        {sp.error ? <p className={styles.error}>{sp.error}</p> : null}
        <form className={styles.form} action="/api/auth/sign-in" method="post">
          <input type="hidden" name="next" value={sp.next || "/hub"} />
          <label htmlFor="email">Email</label>
          <input
            id="email"
            name="email"
            type="email"
            required
            placeholder="you@company.com"
            autoComplete="email"
          />
          <button type="submit">Continue</button>
        </form>
      </main>
    </div>
  );
}
