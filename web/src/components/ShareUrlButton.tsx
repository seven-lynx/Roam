'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ShareUrlModal } from './ShareUrlModal';

interface Props {
  urlId: string;
  urlTitle: string;
  className?: string;
}

export function ShareUrlButton({ urlId, urlTitle, className = '' }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleOpenModal = () => {
    setIsOpen(true);
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  return (
    <>
      <button
        onClick={handleOpenModal}
        disabled={isLoading}
        className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium 
          text-zinc-700 dark:text-zinc-300 
          bg-zinc-100 dark:bg-zinc-800 
          hover:bg-zinc-200 dark:hover:bg-zinc-700 
          disabled:opacity-50 disabled:cursor-not-allowed
          transition-colors ${className}`}
        title="Share this URL with a friend"
      >
        <span>📤</span>
        <span>Share</span>
      </button>

      {isOpen && (
        <ShareUrlModal
          urlId={urlId}
          urlTitle={urlTitle}
          onClose={handleClose}
        />
      )}
    </>
  );
}
