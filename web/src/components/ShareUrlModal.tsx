'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ShareRecipientSearch } from './ShareRecipientSearch';

interface Recipient {
  user_id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  relationship: 'follower' | 'following' | 'friend';
}

interface Props {
  urlId: string;
  urlTitle: string;
  onClose: () => void;
}

export function ShareUrlModal({ urlId, urlTitle, onClose }: Props) {
  const supabase = createClient();
  const [selectedRecipient, setSelectedRecipient] = useState<Recipient | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleShare = async () => {
    if (!selectedRecipient) return;

    setIsSharing(true);
    setError(null);

    try {
      const response = await supabase.functions.invoke('share-url', {
        body: {
          action: 'share',
          recipient_id: selectedRecipient.user_id,
          url_id: urlId,
        },
      });

      if (response.error) {
        setError(response.error.message || 'Failed to share URL');
        return;
      }

      if (response.data?.error) {
        setError(response.data.error);
        return;
      }

      setSuccess(true);
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to share URL');
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-xl max-w-md w-full p-6">
        {/* Header */}
        <div className="mb-6">
          <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-1">
            Share URL with a friend
          </h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 line-clamp-2">
            {urlTitle}
          </p>
        </div>

        {/* Recipient Picker */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">
            Send to
          </label>
          <ShareRecipientSearch
            onSelectRecipient={setSelectedRecipient}
            selectedRecipient={selectedRecipient}
          />
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          </div>
        )}

        {/* Success Message */}
        {success && (
          <div className="mb-4 p-3 rounded-md bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
            <p className="text-sm text-green-700 dark:text-green-300">
              ✓ URL shared with {selectedRecipient?.username}
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            disabled={isSharing}
            className="px-4 py-2 rounded-md text-sm font-medium 
              text-zinc-700 dark:text-zinc-300 
              bg-zinc-100 dark:bg-zinc-800 
              hover:bg-zinc-200 dark:hover:bg-zinc-700
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleShare}
            disabled={!selectedRecipient || isSharing}
            className="px-4 py-2 rounded-md text-sm font-medium 
              text-white 
              bg-blue-600 
              hover:bg-blue-700 
              disabled:bg-blue-400 disabled:cursor-not-allowed
              transition-colors"
          >
            {isSharing ? 'Sharing...' : 'Share'}
          </button>
        </div>
      </div>
    </div>
  );
}
