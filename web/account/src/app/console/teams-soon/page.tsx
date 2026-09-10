import { SiteHeader } from "@/components/SiteHeader";
import { getSessionEmail } from "@/lib/session";

export default async function TeamsSoonPage() {
  const email = await getSessionEmail();
  return (
    <div>
      <SiteHeader email={email} />
      <main style={{ maxWidth: 640, margin: "0 auto", padding: "64px 24px" }}>
        <h1>Teams console — next</h1>
        <p style={{ color: "var(--muted)", lineHeight: 1.55 }}>
          Pro subscription management ships first. Organisation seats, invites and the Teams Stripe
          proxy land in the next cycle — same account, separate billing surface.
        </p>
        <p>
          <a href="/pro">Back to Pro dashboard</a>
        </p>
      </main>
    </div>
  );
}
