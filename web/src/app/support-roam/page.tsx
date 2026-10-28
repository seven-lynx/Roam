import type { Metadata } from "next";
import { BuyMeACoffeeButton } from "@/components/BuyMeACoffeeButton";
import {
  DOMAIN_BILLING_PERIOD_YEARS,
  DOMAIN_COST_USD,
  getSupportTotals,
  MONTHLY_GOAL_USD,
  SUPABASE_PRO_MONTHLY_USD,
  supportProgressPercent,
} from "@/lib/support";

export const metadata: Metadata = {
  title: "Support Roam",
  description:
    "Help keep Roam online. See exactly what it costs to run Roam each month and chip in a tip if you'd like.",
};

const GITHUB_URL = "https://github.com/seven-lynx/Roam";

export default function SupportRoamPage() {
  const { goal, received } = getSupportTotals();
  const progress = supportProgressPercent(received, goal);
  const domainMonthly = DOMAIN_COST_USD / (DOMAIN_BILLING_PERIOD_YEARS * 12);

  return (
    <>
      <div className="flex flex-col items-center px-6 py-24 bg-screen">
        <div className="max-w-3xl mx-auto w-full flex flex-col gap-12 text-left">
          {/* Hero */}
          <section className="flex flex-col gap-5">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-ink">
              Support Roam
            </h1>
            <p className="text-lg text-muted leading-relaxed max-w-2xl">
              Roam is free, open source, and has no ads. We don&rsquo;t sell data
              or run a subscription — so we rely on people like you to keep the
              servers running. Here&rsquo;s exactly what it costs, in the open.
            </p>
          </section>

          {/* Costs */}
          <section className="rounded-2xl border border-line bg-panel-2 p-6">
            <h2 className="text-lg font-bold text-ink mb-4">
              What it costs to run
            </h2>
            <dl className="divide-y divide-line text-sm">
              <div className="flex items-start justify-between gap-4 py-3">
                <dt className="text-muted">
                  Supabase Pro
                  <span className="block text-muted text-xs mt-0.5">
                    Hosts the URL catalogue, ratings, and discovery data
                  </span>
                </dt>
                <dd className="font-semibold text-ink whitespace-nowrap">
                  ${SUPABASE_PRO_MONTHLY_USD}/month
                </dd>
              </div>
              <div className="flex items-start justify-between gap-4 py-3">
                <dt className="text-muted">
                  Domain (roamtheweb.app)
                  <span className="block text-muted text-xs mt-0.5">
                    ${DOMAIN_COST_USD} every {DOMAIN_BILLING_PERIOD_YEARS} years
                    (≈ ${domainMonthly.toFixed(2)}/month)
                  </span>
                </dt>
                <dd className="font-semibold text-ink whitespace-nowrap">
                  ${DOMAIN_COST_USD}/{DOMAIN_BILLING_PERIOD_YEARS}yrs
                </dd>
              </div>
            </dl>
            <p className="mt-4 text-sm text-muted leading-relaxed">
              That&rsquo;s roughly $25.58 a month. We round up to a{" "}
              <strong className="text-ink">
                ${MONTHLY_GOAL_USD}/month goal
              </strong>{" "}
              to cover payment-processing fees and leave a small buffer.
            </p>
          </section>

          {/* Monthly progress */}
          <section>
            <div className="flex items-end justify-between mb-2">
              <h2 className="text-lg font-bold text-ink">
                This month
              </h2>
              <p className="text-sm text-muted">
                <span className="font-semibold text-ink">
                  ${received.toFixed(2)}
                </span>{" "}
                of ${goal.toFixed(2)} raised
              </p>
            </div>
            <div
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={goal}
              aria-valuenow={received}
              aria-label="Monthly support goal progress"
              className="h-3 rounded-full bg-panel-3 overflow-hidden"
            >
              <div
                className="h-full rounded-full bg-accent transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-muted">
              Updated manually — we&rsquo;ll bump this when a tip comes in.
            </p>
          </section>

          {/* Looking ahead */}
          <section className="text-sm text-muted leading-relaxed space-y-3">
            <h2 className="text-base font-bold text-ink">
              Looking ahead
            </h2>
            <p>
              As the URL database grows we may need to raise our Supabase
              spending cap — a usage-based change, not a plan upgrade — so we can
              store more pages. If our costs ever change, we&rsquo;ll update this
              page.
            </p>
          </section>

          {/* CTA */}
          <section className="flex flex-col gap-4 border-t border-line pt-8">
            <p className="text-base text-muted leading-relaxed">
              If Roam has brought you something good, a one-time tip helps cover the running costs above.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <BuyMeACoffeeButton />
              <a
                href={GITHUB_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center rounded-full bg-panel-2 hover:bg-panel-3 text-ink px-8 py-3 font-semibold text-base transition-colors"
              >
                View the code on GitHub
              </a>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
