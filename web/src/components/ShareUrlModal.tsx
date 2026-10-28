'use client';

import { useState } from 'react';
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
    <div className="fixed inset-0 bg-screen/50 flex items-center justify-center z-50 p-4">
      <div className="bg-panel rounded-lg shadow-xl max-w-md w-full p-6">
        {/* Header */}
        <div className="mb-6">
          <h2 className="text-xl font-bold text-ink mb-1">
            Share URL with a friend
          </h2>
          <p className="text-sm text-muted line-clamp-2">
            {urlTitle}
          </p>
        </div>

        {/* Recipient Picker */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-muted mb-3">
            Send to
          </label>
          <ShareRecipientSearch
            onSelectRecipient={setSelectedRecipient}
            selectedRecipient={selectedRecipient}
          />
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 rounded-md bg-panel-2 bg-panel-2/20 border border-danger border-danger">
            <p className="text-sm text-danger text-danger">{error}</p>
          </div>
        )}

        {/* Success Message */}
        {success && (
          <div className="mb-4 p-3 rounded-md bg-panel-2 bg-panel-2/20 border border-ok border-ok">
            <p className="text-sm text-ok text-ok">
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
              text-muted 
              bg-panel-2 
              hover:bg-panel-3
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleShare}
            disabled={!selectedRecipient || isSharing}
            className="px-4 py-2 rounded-md text-sm font-medium 
              text-ink 
              bg-phosphor 
              hover:bg-info 
              disabled:bg-info disabled:cursor-not-allowed
              transition-colors"
          >
            {isSharing ? 'Sharing...' : 'Share'}
          </button>
        </div>
      </div>
    </div>
  );
}