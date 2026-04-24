import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Roam Terms of Service — the rules for using Roam.",
};

const EFFECTIVE = "23 April 2026";
const CONTACT = "legal@roamtheweb.app";

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-white dark:bg-zinc-950 px-6 py-16">
      <article className="max-w-2xl mx-auto prose prose-zinc dark:prose-invert prose-headings:font-bold prose-a:text-zinc-900 dark:prose-a:text-white">
        <h1>Terms of Service</h1>
        <p className="text-zinc-500 text-sm">Effective date: {EFFECTIVE}</p>

        <h2>1. Acceptance</h2>
        <p>
          By using Roam (the website, browser extension, or Android app) you agree to
          these Terms. If you do not agree, do not use Roam.
        </p>

        <h2>2. Eligibility</h2>
        <p>
          You must be at least 13 years old (or 16 in the EEA) to create an account.
          By creating an account you confirm you meet this requirement.
        </p>

        <h2>3. Your account</h2>
        <p>
          You are responsible for keeping your login credentials secure. You are
          responsible for all activity that occurs under your account. Notify us
          immediately at <a href={`mailto:${CONTACT}`}>{CONTACT}</a> if you suspect
          unauthorised access.
        </p>

        <h2>4. Acceptable use</h2>
        <p>You agree <strong>not</strong> to:</p>
        <ul>
          <li>Submit URLs that are illegal, harmful, harassing, defamatory, or infringing.</li>
          <li>Submit malware, phishing pages, or sites designed to deceive users.</li>
          <li>Attempt to circumvent the moderation queue or rate limits.</li>
          <li>Scrape or systematically harvest data from Roam without permission.</li>
          <li>Use Roam to send spam or unsolicited messages to other users.</li>
          <li>Impersonate another person or misrepresent your affiliation.</li>
        </ul>

        <h2>5. Content submission</h2>
        <p>
          When you submit a URL, you confirm that you have a reasonable belief the
          content at that URL complies with these Terms. We reserve the right to reject
          or remove any submission at our discretion.
        </p>
        <p>
          Submitted URLs are reviewed by an automated Safe Browsing check and then by
          a human moderator before being made available in Roam.
        </p>

        <h2>6. User-generated content</h2>
        <p>
          You retain ownership of content you create (collections, bios, display names).
          By posting content on Roam, you grant us a non-exclusive, royalty-free,
          worldwide licence to store and display that content as part of the service.
        </p>

        <h2>7. Intellectual property</h2>
        <p>
          Roam&apos;s source code is released under the MIT licence. The Roam name and
          logo are not licensed for reuse without permission.
        </p>

        <h2>8. Account termination</h2>
        <p>
          We may suspend or terminate your account at any time if you violate these
          Terms. You may delete your account at any time by emailing{" "}
          <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.
        </p>

        <h2>9. Disclaimer of warranties</h2>
        <p>
          Roam is provided &ldquo;as is&rdquo; without warranty of any kind. We do not warrant
          that the service will be uninterrupted, error-free, or that any particular
          URL in the catalogue is safe or accurate. You access external URLs at your
          own risk.
        </p>

        <h2>10. Limitation of liability</h2>
        <p>
          To the maximum extent permitted by law, we are not liable for any indirect,
          incidental, special, consequential, or punitive damages arising from your use
          of Roam. Our total liability for any claim shall not exceed USD $0 (Roam is
          a free hobby project).
        </p>

        <h2>11. Governing law</h2>
        <p>
          These Terms are governed by the laws of the jurisdiction in which the
          operator resides, without regard to conflict-of-law principles.
        </p>

        <h2>12. Changes</h2>
        <p>
          We may update these Terms. Continued use of Roam after changes are posted
          constitutes acceptance of the updated Terms.
        </p>

        <h2>13. Contact</h2>
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
