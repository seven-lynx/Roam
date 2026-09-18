'use client';

import { useState } from 'react';

interface CopyProfileLinkProps {
  username: string;
}

export function CopyProfileLink({ username }: CopyProfileLinkProps) {
  const [copied, setCopied] = useState(false);

  function copy() {
    void navigator.clipboard.writeText(`https://roamtheweb.app/u/${username}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      onClick={copy}
      className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
      title="Copy profile link"
    >
      {copied ? '✓ Copied' : '🔗 Copy link'}
    </button>
  );
}