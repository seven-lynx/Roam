import type { Metadata } from "next";
import { BuyMeACoffeeWidget } from "@/components/BuyMeACoffeeWidget";
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
      <BuyMeACoffeeWidget />
      <div className="flex flex-col items-center px-6 py-24 bg-white dark:bg-zinc-950">
        <div className="max-w-3xl mx-auto w-full flex flex-col gap-12 text-left">
          {/* Hero */}
          <section className="flex flex-col gap-5">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-zinc-900 dark:text-white">
              Support Roam
            </h1>
            <p className="text-lg text-zinc-500 dark:text-zinc-400 leading-relaxed max-w-2xl">
              Roam is free, open source, and has no ads. We don&rsquo;t sell data
              or run a subscription — so we rely on people like you to keep the
              servers running. Here&rsquo;s exactly what it costs, in the open.
            </p>
          </section>

          {/* Costs */}
          <section className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 p-6">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white mb-4">
              What it costs to run
            </h2>
            <dl className="divide-y divide-zinc-200 dark:divide-zinc-800 text-sm">
              <div className="flex items-start justify-between gap-4 py-3">
                <dt className="text-zinc-600 dark:text-zinc-300">
                  Supabase Pro
                  <span className="block text-zinc-400 dark:text-zinc-500 text-xs mt-0.5">
                    Hosts the URL catalogue, ratings, and discovery data
                  </span>
                </dt>
                <dd className="font-semibold text-zinc-900 dark:text-white whitespace-nowrap">
                  ${SUPABASE_PRO_MONTHLY_USD}/month
                </dd>
              </div>
              <div className="flex items-start justify-between gap-4 py-3">
                <dt className="text-zinc-600 dark:text-zinc-300">
                  Domain (roamtheweb.app)
                  <span className="block text-zinc-400 dark:text-zinc-500 text-xs mt-0.5">
                    ${DOMAIN_COST_USD} every {DOMAIN_BILLING_PERIOD_YEARS} years
                    (≈ ${domainMonthly.toFixed(2)}/month)
                  </span>
                </dt>
                <dd className="font-semibold text-zinc-900 dark:text-white whitespace-nowrap">
                  ${DOMAIN_COST_USD}/{DOMAIN_BILLING_PERIOD_YEARS}yrs
                </dd>
              </div>
            </dl>
            <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
              That&rsquo;s roughly $25.58 a month. We round up to a{" "}
              <strong className="text-zinc-900 dark:text-white">
                ${MONTHLY_GOAL_USD}/month goal
              </strong>{" "}
              to cover payment-processing fees and leave a small buffer.
            </p>
          </section>

          {/* Monthly progress */}
          <section>
            <div className="flex items-end justify-between mb-2">
              <h2 className="text-lg font-bold text-zinc-900 dark:text-white">
                This month
              </h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                <span className="font-semibold text-zinc-900 dark:text-white">
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
              className="h-3 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden"
            >
              <div
                className="h-full rounded-full bg-amber-500 transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-zinc-400 dark:text-zinc-500">
              Updated manually — we&rsquo;ll bump this when a tip comes in.
            </p>
          </section>

          {/* Looking ahead */}
          <section className="text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed space-y-3">
            <h2 className="text-base font-bold text-zinc-900 dark:text-white">
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
          <section className="flex flex-col gap-3 border-t border-zinc-200 dark:border-zinc-800 pt-8">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Tip via the coffee button in the corner, or dig into the code:
            </p>
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-900 dark:text-white px-8 py-3 font-semibold text-base transition-colors"
            >
              View the code on GitHub
            </a>
          </section>
        </div>
      </div>
    </>
  );
}
