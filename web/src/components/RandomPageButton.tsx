'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export function RandomPageButton() {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      const supabase = createClient();
      // Fetch a random URL from the curated urls table
      const { data } = await supabase
        .from('urls')
        .select('original_url')
        .limit(1)
        .order('RANDOM()' as never);
      
      if (data && data.length > 0 && data[0]?.original_url) {
        window.open(data[0].original_url, '_blank', 'noopener,noreferrer');
      } else {
        window.open('https://roamtheweb.app/collections', '_blank');
      }
    } catch {
      window.open('https://roamtheweb.app/collections', '_blank');
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="inline-flex items-center justify-center rounded-full border border-amber-300 dark:border-amber-700 px-8 py-3 text-amber-700 dark:text-amber-300 font-semibold text-base hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors disabled:opacity-50"
    >
      {loading ? 'Loading…' : 'Try a random page 🎲'}
    </button>
  );
}
