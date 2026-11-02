'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useWorkstation } from '@/components/WorkstationContext';
import { fetchRandomPageUrl } from '@/lib/random-page';

export function RandomPageButton() {
  const { openUrl } = useWorkstation();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      const url = await fetchRandomPageUrl();
      if (url) openUrl({ url });
      else router.push('/collections');
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