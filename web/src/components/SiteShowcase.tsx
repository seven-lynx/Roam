'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { extractDomain, getFaviconUrl } from '@/lib/url-utils';

interface ShowcaseSite {
  id: string;
  title: string;
  original_url: string;
  og_image_url: string | null;
  upvotes: number;
  wilson_score: number;
}

export function SiteShowcase() {
  const [sites, setSites] = useState<ShowcaseSite[]>([]);
  const [current, setCurrent] = useState(0);
  const [loading, setLoading] = useState(true);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from('urls')
        .select('id, title, original_url, og_image_url, upvotes, wilson_score')
        .eq('approved', true)
        .eq('inactive', false)
        .order('wilson_score', { ascending: false })
        .limit(10);
      if (data) setSites(data as ShowcaseSite[]);
      setLoading(false);
    })();
  }, []);

  // Auto-rotate every 6 seconds, pause on hover
  useEffect(() => {
    if (paused || sites.length <= 1) return;
    const timer = setInterval(() => {
      setCurrent(prev => (prev + 1) % sites.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [paused, sites.length]);

  const goTo = useCallback((index: number) => setCurrent(index), []);
  const goNext = useCallback(() => setCurrent(prev => (prev + 1) % sites.length), [sites.length]);
  const goPrev = useCallback(() => setCurrent(prev => (prev - 1 + sites.length) % sites.length), [sites.length]);

  if (loading) {
    return (
      <div className="animate-pulse rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6">
        <div className="aspect-video bg-zinc-200 dark:bg-zinc-800 rounded-xl mb-4" />
        <div className="h-5 w-3/4 bg-zinc-200 dark:bg-zinc-800 rounded mb-2" />
        <div className="h-4 w-1/3 bg-zinc-200 dark:bg-zinc-800 rounded" />
      </div>
    );
  }

  if (sites.length === 0) return null;

  const site = sites[current];

  return (
    <div
      className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Slide */}
      <a
        href={site.original_url}
        target="_blank"
        rel="noopener noreferrer"
        className="block"
      >
        {/* OG Image */}
        <div className="aspect-video bg-zinc-100 dark:bg-zinc-800 relative overflow-hidden">
          {site.og_image_url ? (
            <img
              src={site.og_image_url}
              alt=""
              className="w-full h-full object-cover"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <div className="text-4xl text-zinc-300 dark:text-zinc-600">🌐</div>
            </div>
          )}
          {/* Gradient overlay at bottom */}
          <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-black/50 to-transparent" />
        </div>

        {/* Info */}
        <div className="p-5">
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-white truncate">
            {site.title || site.original_url}
          </h3>
          <div className="flex items-center justify-between mt-2">
            <span className="text-sm text-zinc-500 dark:text-zinc-400">
              {extractDomain(site.original_url)}
            </span>
            <span className="text-sm text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
              <span className="text-green-600 dark:text-green-400">↑</span>
              {site.upvotes}
            </span>
          </div>
        </div>
      </a>

      {/* Controls */}
      {sites.length > 1 && (
        <div className="flex items-center justify-between px-5 pb-4">
          {/* Dot nav */}
          <div className="flex items-center gap-1.5">
            {sites.map((_, i) => (
              <button
                key={i}
                onClick={() => goTo(i)}
                className={`w-2 h-2 rounded-full transition-all ${
                  i === current
                    ? 'bg-amber-500 w-4'
                    : 'bg-zinc-300 dark:bg-zinc-600 hover:bg-zinc-400 dark:hover:bg-zinc-500'
                }`}
                aria-label={`Go to slide ${i + 1}`}
              />
            ))}
          </div>

          {/* Arrow buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={goPrev}
              className="w-8 h-8 rounded-full flex items-center justify-center text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              aria-label="Previous site"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                <path fillRule="evenodd" d="M11.78 5.22a.75.75 0 0 1 0 1.06L8.06 10l3.72 3.72a.75.75 0 1 1-1.06 1.06l-4.25-4.25a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 0Z" clipRule="evenodd" />
              </svg>
            </button>
            <button
              onClick={goNext}
              className="w-8 h-8 rounded-full flex items-center justify-center text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              aria-label="Next site"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                <path fillRule="evenodd" d="M8.22 5.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}