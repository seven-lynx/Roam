import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Roam Privacy Policy — how we collect, use, and protect your data.",
};

const EFFECTIVE = "23 April 2026";
const CONTACT = "privacy@roamtheweb.app";

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-white dark:bg-zinc-950 px-6 py-16">
      <article className="max-w-2xl mx-auto prose prose-zinc dark:prose-invert prose-headings:font-bold prose-a:text-zinc-900 dark:prose-a:text-white">
        <h1>Privacy Policy</h1>
        <p className="text-zinc-500 text-sm">Effective date: {EFFECTIVE}</p>

        <h2>1. Who we are</h2>
        <p>
          Roam (&ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo;) is a hobby project operated by an individual developer.
          Roam is a web-discovery service available as a browser extension (Chrome and Firefox),
          an Android app, and a website at <strong>roamtheweb.app</strong>.
        </p>

        <h2>2. Data we collect</h2>
        <h3>Account data</h3>
        <p>
          When you create an account we collect your email address and, if you sign in
          with Google, your Google profile name and avatar URL. You may optionally set
          a username, display name, and bio.
        </p>
        <h3>Usage data</h3>
        <p>
          We record which URLs you have been served (&ldquo;seen URLs&rdquo;) so we can avoid
          showing you the same page twice. This data is deleted automatically after 30 days.
          We also record ratings (thumbs up / thumbs down) that you submit.
        </p>
        <h3>Submitted URLs</h3>
        <p>
          If you submit a URL for inclusion in Roam, we store that URL along with your
          user ID so we can enforce rate limits and contact you if needed.
        </p>
        <h3>Collections</h3>
        <p>
          If you create collections, the collection name, description, and its URLs are
          stored. Public collections are visible to anyone.
        </p>
        <h3>Technical data</h3>
        <p>
          Our hosting providers (Supabase and Vercel) may collect standard server logs
          including IP addresses, browser type, and request timestamps. We do not have
          direct access to this data beyond what those providers expose.
        </p>

        <h2>3. How we use your data</h2>
        <ul>
          <li>To serve personalised URL recommendations filtered by your category preferences.</li>
          <li>To avoid serving you URLs you have already seen.</li>
          <li>To display your public profile and collections to other users.</li>
          <li>To moderate submitted URLs before they are approved.</li>
          <li>To send transactional emails (e.g., email confirmation, password reset) via Supabase Auth.</li>
        </ul>
        <p>We do not sell your data. We do not use your data for advertising.</p>

        <h2>4. Data sharing</h2>
        <p>
          We use the following third-party sub-processors:
        </p>
        <ul>
          <li><strong>Supabase Inc.</strong> — database, authentication, and serverless functions (USA).</li>
          <li><strong>Vercel Inc.</strong> — web hosting (USA).</li>
          <li><strong>Google LLC</strong> — optional &ldquo;Sign in with Google&rdquo; OAuth; Safe Browsing API for URL vetting.</li>
        </ul>

        <h2>5. Data retention</h2>
        <ul>
          <li>Seen-URL records are deleted after 30 days.</li>
          <li>Account data is retained until you delete your account.</li>
          <li>Moderation-queue records are retained indefinitely for audit purposes.</li>
        </ul>

        <h2>6. Your rights</h2>
        <p>
          Depending on where you live you may have rights including access, correction,
          deletion, restriction, portability, and objection under the GDPR, UK GDPR, or
          CCPA. To exercise any right, email us at{" "}
          <a href={`mailto:${CONTACT}`}>{CONTACT}</a>. We will respond within 30 days.
        </p>
        <p>
          To delete your account and all associated personal data, email us from the
          address linked to your account. We will complete deletion within 7 days.
        </p>

        <h2>7. Cookies</h2>
        <p>
          Roam uses a single session cookie set by Supabase Auth to keep you signed in.
          We do not use tracking or advertising cookies.
        </p>

        <h2>8. Children</h2>
        <p>
          Roam is not directed at children under 13 (or under 16 in the EEA). If you
          believe a child has provided us with personal data, please contact us and we
          will delete it.
        </p>

        <h2>9. Changes</h2>
        <p>
          We may update this policy. Material changes will be announced via a notice on
          the website. The effective date at the top will always reflect the latest version.
        </p>

        <h2>10. Contact</h2>
        <p>
          Questions? Email <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.
        </p>

        <hr />
        <Link href="/" className="text-sm text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors no-underline">
          ← Back to Roam
        </Link>
      </article>
    </main>
  );
}
