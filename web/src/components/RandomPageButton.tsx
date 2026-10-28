'use client';

import { useState } from 'react';
import { openRandomPage } from '@/lib/random-page';

export function RandomPageButton() {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      await openRandomPage();
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