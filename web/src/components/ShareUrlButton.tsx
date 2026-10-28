'use client';

import { useState } from 'react';
import { ShareUrlModal } from './ShareUrlModal';

interface Props {
  urlId: string;
  urlTitle: string;
  className?: string;
}

export function ShareUrlButton({ urlId, urlTitle, className = '' }: Props) {
  const [isOpen, setIsOpen] = useState(false);

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
        className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium 
          text-muted 
          bg-panel-2 
          hover:bg-panel-3 
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