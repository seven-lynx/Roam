'use client';

import { useState } from 'react';
import { useWorkstation } from '@/components/WorkstationContext';
import { fetchRandomPageUrl } from '@/lib/random-page';

export function RandomPageButton() {
  const { openUrl, openAppView } = useWorkstation();
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      const url = await fetchRandomPageUrl();
      if (url) openUrl({ url });
      else openAppView('/collections', 'Collections');
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="btn btn-secondary disabled:opacity-50"
    >
      {loading ? 'Loading…' : 'Try a random page 🎲'}
    </button>
  );
}