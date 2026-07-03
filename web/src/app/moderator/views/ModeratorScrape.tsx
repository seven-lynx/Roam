"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { addScrapeSuggestion, getScrapeSuggestions, scrapeUrl } from "../scrape-actions";
import type { ScrapeSuggestion } from "../scrape-actions";

/** Normalize a tag to lowercase hyphenated slug */
function normalizeTag(raw: string): string {
  return raw.trim().toLowerCase().replace(/[^a-z0-9\u00C0-\u024F]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 64);
}

type Category = { id: string; name: string };
type Subcategory = { id: string; name: string; category_id: string };

interface Props {
  categories: Category[];
  subcategories: Subcategory[];
}

export function ModeratorScrape({ categories, subcategories }: Props) {
  const [tab, setTab] = useState<"url" | "domain">("url");

  // — Scrape URL state —
  const [scrapeInput, setScrapeInput] = useState("");
  const [scrapeCategoryIds, setScrapeCategoryIds] = useState<string[]>([]);
  const [scrapeSubId, setScrapeSubId] = useState("");
  const [scrapeTags, setScrapeTags] = useState<string[]>([]);
  const [scrapeTagInput, setScrapeTagInput] = useState("");
  const [scrapeLoading, setScrapeLoading] = useState(false);
  const [scrapeResult, setScrapeResult] = useState<{ title: string | null; url: string; tags: string[] } | null>(null);
  const [scrapeError, setScrapeError] = useState<string | null>(null);
  const scrapeTagRef = useRef<HTMLInputElement>(null);

  // — Domain suggestion —
  const [domainInput, setDomainInput] = useState("");
  const [domainCatId, setDomainCatId] = useState("");
  const [domainSubId, setDomainSubId] = useState("");
  const [domainNotes, setDomainNotes] = useState("");
  const [domainLoading, setDomainLoading] = useState(false);
  const [domainSuccess, setDomainSuccess] = useState(false);
  const [domainError, setDomainError] = useState<string | null>(null);

  const [suggestions, setSuggestions] = useState<ScrapeSuggestion[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(true);

  const loadSuggestions = useCallback(async () => {
    setSuggestionsLoading(true);
    const { data } = await getScrapeSuggestions();
    if (data) setSuggestions(data);
    setSuggestionsLoading(false);
  }, []);

  useEffect(() => { loadSuggestions(); }, [loadSuggestions]);

  const scrapeCatSubs = subcategories.filter((s) => scrapeCategoryIds.includes(s.category_id));
  const domainCatSubs = subcategories.filter((s) => s.category_id === domainCatId);

  // ── Tag chip helpers ──
  function commitTag(raw: string) {
    const t = normalizeTag(raw);
    if (!t || scrapeTags.includes(t)) return;
    setScrapeTags((prev) => [...prev, t]);
    setScrapeTagInput("");
  }
  function handleTagKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === "," || e.key === "Tab") { e.preventDefault(); commitTag(scrapeTagInput); }
    else if (e.key === "Backspace" && scrapeTagInput === "" && scrapeTags.length > 0) setScrapeTags((p) => p.slice(0, -1));
  }

  // ── Pillar toggle (max 2) ──
  function togglePillar(id: string) {
    setScrapeCategoryIds((prev) => {
      if (prev.includes(id)) {
        const next = prev.filter((c) => c !== id);
        if (scrapeSubId) {
          const sub = subcategories.find((s) => s.id === scrapeSubId);
          if (sub && !next.includes(sub.category_id)) setScrapeSubId("");
        }
        return next;
      }
      return prev.length >= 2 ? prev : [...prev, id];
    });
  }

  async function handleScrape(e: React.FormEvent) {
    e.preventDefault();
    if (!scrapeInput.trim()) return;
    const allTags = scrapeTagInput.trim()
      ? [...new Set([...scrapeTags, normalizeTag(scrapeTagInput)].filter(Boolean))]
      : scrapeTags;
    setScrapeLoading(true); setScrapeError(null); setScrapeResult(null);
    const { data, error } = await scrapeUrl(scrapeInput.trim(), scrapeCategoryIds, scrapeSubId || null, allTags);
    if (error) { setScrapeError(error); }
    else if (data) {
      setScrapeResult({ title: data.title, url: data.url, tags: data.tags });
      setScrapeInput(""); setScrapeCategoryIds([]); setScrapeSubId(""); setScrapeTags([]); setScrapeTagInput("");
    }
    setScrapeLoading(false);
  }

  async function handleDomainSuggest(e: React.FormEvent) {
    e.preventDefault();
    if (!domainInput.trim()) return;
    setDomainLoading(true); setDomainError(null); setDomainSuccess(false);
    const { error } = await addScrapeSuggestion("domain", domainInput.trim(), domainCatId || null, domainSubId || null, domainNotes || null);
    if (error) { setDomainError(error); }
    else { setDomainSuccess(true); setDomainInput(""); setDomainCatId(""); setDomainSubId(""); setDomainNotes(""); loadSuggestions(); }
    setDomainLoading(false);
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Tab switcher */}
      <div className="flex gap-1 rounded-xl border border-zinc-200 dark:border-zinc-800 p-1 bg-zinc-50 dark:bg-zinc-900/50 w-fit">
        {(["url", "domain"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === t ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm" : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"}`}>
            {t === "url" ? "🔗 Scrape URL" : "🌐 Suggest Domain"}
          </button>
        ))}
      </div>

      {/* ── Scrape single URL ── */}
      {tab === "url" && (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 sm:p-6 flex flex-col gap-5">
          <div>
            <h2 className="text-base font-semibold text-zinc-900 dark:text-white">Scrape URL directly into pool</h2>
            <p className="text-xs text-zinc-400 mt-0.5">Fetches OG metadata, tags semantically, publishes immediately.</p>
          </div>
          <form onSubmit={handleScrape} className="flex flex-col gap-4">
            <input type="url" placeholder="https://example.com/article" value={scrapeInput}
              onChange={(e) => { setScrapeInput(e.target.value); setScrapeResult(null); setScrapeError(null); }} required
              className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 px-3 py-2.5 text-sm bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            {/* Pillar multi-select (max 2) */}
            <div>
              <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-2">
                Pillars <span className="text-zinc-400 font-normal">(select 1–2)</span>
              </p>
              <div className="flex flex-wrap gap-1.5">
                {categories.map((c) => {
                  const selected = scrapeCategoryIds.includes(c.id);
                  const capped = !selected && scrapeCategoryIds.length >= 2;
                  return (
                    <button key={c.id} type="button" onClick={() => togglePillar(c.id)} disabled={capped}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                        selected ? "bg-blue-600 border-blue-600 text-white"
                          : capped ? "border-zinc-200 dark:border-zinc-700 text-zinc-300 dark:text-zinc-600 cursor-not-allowed"
                          : "border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-400"
                      }`}>
                      {c.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Primary subcategory */}
            {scrapeCatSubs.length > 0 && (
              <div>
                <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">
                  Primary subcategory <span className="text-zinc-400 font-normal">(optional — used for discovery)</span>
                </p>
                <select value={scrapeSubId} onChange={(e) => setScrapeSubId(e.target.value)}
                  className="rounded-lg border border-zinc-200 dark:border-zinc-700 px-3 py-2 text-sm bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">None</option>
                  {scrapeCatSubs.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            )}

            {/* Semantic tag chip input */}
            <div>
              <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">
                Semantic tags <span className="text-zinc-400 font-normal">(Enter or comma to add — unlimited)</span>
              </p>
              <div onClick={() => scrapeTagRef.current?.focus()}
                className="min-h-[44px] flex flex-wrap gap-1.5 items-center rounded-lg border border-zinc-200 dark:border-zinc-700 px-3 py-2 bg-white dark:bg-zinc-900 cursor-text">
                {scrapeTags.map((tag) => (
                  <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-medium">
                    {tag}
                    <button type="button" onClick={(ev) => { ev.stopPropagation(); setScrapeTags((p) => p.filter((t) => t !== tag)); }}
                      className="text-blue-400 hover:text-blue-600 dark:hover:text-blue-200 leading-none">×</button>
                  </span>
                ))}
                <input ref={scrapeTagRef} type="text" value={scrapeTagInput}
                  onChange={(e) => setScrapeTagInput(e.target.value)}
                  onKeyDown={handleTagKeyDown}
                  onBlur={() => scrapeTagInput.trim() && commitTag(scrapeTagInput)}
                  placeholder={scrapeTags.length === 0 ? "knife-sharpening, japanese-culture, fermentation…" : ""}
                  className="flex-1 min-w-[120px] bg-transparent text-sm text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none"
                />
              </div>
              {scrapeTags.length > 0 && (
                <p className="mt-1 text-[10px] text-zinc-400">{scrapeTags.length} tag{scrapeTags.length !== 1 ? "s" : ""} · Backspace removes last</p>
              )}
            </div>

            <button type="submit" disabled={scrapeLoading || !scrapeInput.trim()}
              className="self-start rounded-lg bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
              {scrapeLoading ? "Scraping…" : "Scrape & Add"}
            </button>
          </form>

          {scrapeError && <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400">{scrapeError}</div>}
          {scrapeResult && (
            <div className="rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 px-4 py-3 flex flex-col gap-1.5">
              <p className="text-sm font-medium text-green-700 dark:text-green-400">✓ Added: {scrapeResult.title ?? scrapeResult.url}</p>
              {scrapeResult.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {scrapeResult.tags.map((t) => <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400">{t}</span>)}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Suggest domain ── */}
      {tab === "domain" && (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 sm:p-6 flex flex-col gap-4">
          <div>
            <h2 className="text-base font-semibold text-zinc-900 dark:text-white">Suggest a domain to scrape</h2>
            <p className="text-xs text-zinc-400 mt-0.5">Logs a domain for review. Admin runs a seeder against it.</p>
          </div>
          <form onSubmit={handleDomainSuggest} className="flex flex-col gap-3">
            <input type="text" placeholder="e.g. arstechnica.com" value={domainInput}
              onChange={(e) => { setDomainInput(e.target.value); setDomainSuccess(false); setDomainError(null); }} required
              className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 px-3 py-2.5 text-sm bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
            <div className="flex gap-2 flex-wrap">
              <select value={domainCatId} onChange={(e) => { setDomainCatId(e.target.value); setDomainSubId(""); }}
                className="flex-1 min-w-[140px] rounded-lg border border-zinc-200 dark:border-zinc-700 px-3 py-2 text-sm bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500">
                <option value="">Pillar (optional)</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              {domainCatSubs.length > 0 && (
                <select value={domainSubId} onChange={(e) => setDomainSubId(e.target.value)}
                  className="flex-1 min-w-[160px] rounded-lg border border-zinc-200 dark:border-zinc-700 px-3 py-2 text-sm bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500">
                  <option value="">Subcategory (optional)</option>
                  {domainCatSubs.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              )}
            </div>
            <textarea placeholder="Notes — e.g. long-form articles only, skip paywall sections"
              value={domainNotes} onChange={(e) => setDomainNotes(e.target.value)} rows={2}
              className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 px-3 py-2.5 text-sm bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
            />
            <button type="submit" disabled={domainLoading || !domainInput.trim()}
              className="self-start rounded-lg bg-violet-600 text-white px-4 py-2 text-sm font-medium hover:bg-violet-700 disabled:opacity-50 transition-colors">
              {domainLoading ? "Submitting…" : "Submit Suggestion"}
            </button>
          </form>
          {domainError && <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400">{domainError}</div>}
          {domainSuccess && <div className="rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 px-4 py-3 text-sm text-green-700 dark:text-green-400">✓ Suggestion logged.</div>}
        </div>
      )}

      {/* ── Suggestions log ── */}
      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Scraping suggestions</h3>
        {suggestionsLoading ? (
          <div className="text-center text-zinc-400 py-8 text-sm">Loading…</div>
        ) : suggestions.length === 0 ? (
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 text-center text-zinc-400 text-sm">No suggestions yet.</div>
        ) : (
          <div className="flex flex-col gap-2">
            {suggestions.map((s) => (
              <div key={s.id} className="rounded-xl border border-zinc-200 dark:border-zinc-800 px-4 py-3 flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">{s.suggestion_type}</span>
                    <span className="text-sm font-medium text-zinc-900 dark:text-white break-all">{s.value}</span>
                  </div>
                  {(s.category || s.subcategory) && <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{[s.category?.name, s.subcategory?.name].filter(Boolean).join(" › ")}</p>}
                  {s.notes && <p className="mt-1 text-xs text-zinc-400 italic">{s.notes}</p>}
                  <p className="mt-1 text-[10px] text-zinc-400">{new Date(s.created_at).toLocaleDateString("en-US", { timeZone: "America/New_York" })}</p>
                </div>
                <StatusPill status={s.status} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending:  "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400",
    approved: "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400",
    rejected: "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400",
    scraped:  "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400",
  };
  return <span className={`shrink-0 text-[10px] font-semibold px-2 py-1 rounded capitalize ${styles[status] ?? styles.pending}`}>{status}</span>;
}

  async function handleScrape(e: React.FormEvent) {
    e.preventDefault();
    if (!scrapeInput.trim()) return;
    setScrapeLoading(true);
    setScrapeError(null);
    setScrapeResult(null);
    const { data, error } = await scrapeUrl(
      scrapeInput.trim(),
      scrapeCatId || null,
      scrapeSubId || null,
    );
    if (error) { setScrapeError(error); }
    else if (data) {
      setScrapeResult({ title: data.title, url: data.url });
      setScrapeInput("");
      setScrapeCatId("");
      setScrapeSubId("");
    }
    setScrapeLoading(false);
  }

  async function handleDomainSuggest(e: React.FormEvent) {
    e.preventDefault();
    if (!domainInput.trim()) return;
    setDomainLoading(true);
    setDomainError(null);
    setDomainSuccess(false);
    const { error } = await addScrapeSuggestion(
      "domain",
      domainInput.trim(),
      domainCatId || null,
      domainSubId || null,
      domainNotes || null,
    );
    if (error) { setDomainError(error); }
    else {
      setDomainSuccess(true);
      setDomainInput("");
      setDomainCatId("");
      setDomainSubId("");
      setDomainNotes("");
      loadSuggestions();
    }
    setDomainLoading(false);
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Tab switcher */}
      <div className="flex gap-1 rounded-xl border border-zinc-200 dark:border-zinc-800 p-1 bg-zinc-50 dark:bg-zinc-900/50 w-fit">
        {(["url", "domain"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              tab === t
                ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm"
                : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"
            }`}
          >
            {t === "url" ? "🔗 Scrape URL" : "🌐 Suggest Domain"}
          </button>
        ))}
      </div>

      {/* — Scrape single URL — */}
      {tab === "url" && (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 sm:p-6 flex flex-col gap-4">
          <div>
            <h2 className="text-base font-semibold text-zinc-900 dark:text-white">Scrape URL directly into pool</h2>
            <p className="text-xs text-zinc-400 mt-0.5">Fetches OG metadata and adds the URL as approved. Bypasses the moderation queue.</p>
          </div>
          <form onSubmit={handleScrape} className="flex flex-col gap-3">
            <input
              type="url"
              placeholder="https://example.com/article"
              value={scrapeInput}
              onChange={(e) => { setScrapeInput(e.target.value); setScrapeResult(null); setScrapeError(null); }}
              required
              className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 px-3 py-2.5 text-sm bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <CategoryPicker
              categories={categories}
              subcategories={scrapeCatSubs}
              categoryId={scrapeCatId}
              subcategoryId={scrapeSubId}
              onCategoryChange={(id) => { setScrapeCatId(id); setScrapeSubId(""); }}
              onSubcategoryChange={setScrapeSubId}
            />
            <button
              type="submit"
              disabled={scrapeLoading || !scrapeInput.trim()}
              className="self-start rounded-lg bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {scrapeLoading ? "Scraping…" : "Scrape & Add"}
            </button>
          </form>
          {scrapeError && (
            <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400">
              {scrapeError}
            </div>
          )}
          {scrapeResult && (
            <div className="rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 px-4 py-3 text-sm text-green-700 dark:text-green-400">
              ✓ Added: <span className="font-medium">{scrapeResult.title ?? scrapeResult.url}</span>
            </div>
          )}
        </div>
      )}

      {/* — Suggest domain — */}
      {tab === "domain" && (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 sm:p-6 flex flex-col gap-4">
          <div>
            <h2 className="text-base font-semibold text-zinc-900 dark:text-white">Suggest a domain to scrape</h2>
            <p className="text-xs text-zinc-400 mt-0.5">Logs a domain suggestion for review. Admin can then run a seeder against it.</p>
          </div>
          <form onSubmit={handleDomainSuggest} className="flex flex-col gap-3">
            <input
              type="text"
              placeholder="e.g. arstechnica.com"
              value={domainInput}
              onChange={(e) => { setDomainInput(e.target.value); setDomainSuccess(false); setDomainError(null); }}
              required
              className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 px-3 py-2.5 text-sm bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <CategoryPicker
              categories={categories}
              subcategories={domainCatSubs}
              categoryId={domainCatId}
              subcategoryId={domainSubId}
              onCategoryChange={(id) => { setDomainCatId(id); setDomainSubId(""); }}
              onSubcategoryChange={setDomainSubId}
            />
            <textarea
              placeholder="Notes (optional) — e.g. focus on long-form articles, skip the podcast section"
              value={domainNotes}
              onChange={(e) => setDomainNotes(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 px-3 py-2.5 text-sm bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
            <button
              type="submit"
              disabled={domainLoading || !domainInput.trim()}
              className="self-start rounded-lg bg-violet-600 text-white px-4 py-2 text-sm font-medium hover:bg-violet-700 disabled:opacity-50 transition-colors"
            >
              {domainLoading ? "Submitting…" : "Submit Suggestion"}
            </button>
          </form>
          {domainError && (
            <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400">
              {domainError}
            </div>
          )}
          {domainSuccess && (
            <div className="rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 px-4 py-3 text-sm text-green-700 dark:text-green-400">
              ✓ Suggestion logged. Admin will review.
            </div>
          )}
        </div>
      )}

      {/* — Suggestions log — */}
      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Scraping suggestions</h3>
        {suggestionsLoading ? (
          <div className="text-center text-zinc-400 py-8 text-sm">Loading…</div>
        ) : suggestions.length === 0 ? (
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 text-center text-zinc-400 text-sm">
            No suggestions yet.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {suggestions.map((s) => (
              <div
                key={s.id}
                className="rounded-xl border border-zinc-200 dark:border-zinc-800 px-4 py-3 flex items-start justify-between gap-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
                      {s.suggestion_type}
                    </span>
                    <span className="text-sm font-medium text-zinc-900 dark:text-white break-all">{s.value}</span>
                  </div>
                  {(s.category || s.subcategory) && (
                    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                      {[s.category?.name, s.subcategory?.name].filter(Boolean).join(" › ")}
                    </p>
                  )}
                  {s.notes && <p className="mt-1 text-xs text-zinc-400 italic">{s.notes}</p>}
                  <p className="mt-1 text-[10px] text-zinc-400">
                    {new Date(s.created_at).toLocaleDateString("en-US", { timeZone: "America/New_York" })}
                  </p>
                </div>
                <StatusPill status={s.status} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CategoryPicker({
  categories, subcategories, categoryId, subcategoryId, onCategoryChange, onSubcategoryChange,
}: {
  categories: Category[];
  subcategories: Subcategory[];
  categoryId: string;
  subcategoryId: string;
  onCategoryChange: (id: string) => void;
  onSubcategoryChange: (id: string) => void;
}) {
  return (
    <div className="flex gap-2 flex-wrap">
      <select
        value={categoryId}
        onChange={(e) => onCategoryChange(e.target.value)}
        className="flex-1 min-w-[140px] rounded-lg border border-zinc-200 dark:border-zinc-700 px-3 py-2 text-sm bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="">Category (optional)</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>
      {subcategories.length > 0 && (
        <select
          value={subcategoryId}
          onChange={(e) => onSubcategoryChange(e.target.value)}
          className="flex-1 min-w-[160px] rounded-lg border border-zinc-200 dark:border-zinc-700 px-3 py-2 text-sm bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Subcategory (optional)</option>
          {subcategories.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending:  "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400",
    approved: "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400",
    rejected: "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400",
    scraped:  "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400",
  };
  return (
    <span className={`shrink-0 text-[10px] font-semibold px-2 py-1 rounded capitalize ${styles[status] ?? styles.pending}`}>
      {status}
    </span>
  );
}
