'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';

interface Recipient {
  user_id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  relationship: 'follower' | 'following' | 'friend';
}

interface Props {
  onSelectRecipient: (recipient: Recipient | null) => void;
  selectedRecipient: Recipient | null;
}

export function ShareRecipientSearch({ onSelectRecipient, selectedRecipient }: Props) {
  const supabase = createClient();
  const [searchText, setSearchText] = useState('');
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch recipients on mount and when search text changes
  useEffect(() => {
    const fetchRecipients = async () => {
      if (!searchText.trim()) {
        // Show default recipients (followers + following) if no search
        setIsLoading(true);
        setError(null);
        try {
          const response = await supabase.functions.invoke('share-url', {
            body: { action: 'recipients', limit: 50 },
          });

          if (response.error) {
            setError('Failed to load recipients');
            setRecipients([]);
            return;
          }

          setRecipients(response.data?.recipients || []);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to load recipients');
          setRecipients([]);
        } finally {
          setIsLoading(false);
        }
        return;
      }

      // Search for specific recipients
      setIsLoading(true);
      setError(null);
      try {
        const response = await supabase.functions.invoke('share-url', {
          body: { action: 'recipients', search: searchText, limit: 20 },
        });

        if (response.error) {
          setError('Failed to search recipients');
          setRecipients([]);
          return;
        }

        setRecipients(response.data?.recipients || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to search recipients');
        setRecipients([]);
      } finally {
        setIsLoading(false);
      }
    };

    const debounceTimer = setTimeout(fetchRecipients, 300);
    return () => clearTimeout(debounceTimer);
  }, [searchText, supabase]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        searchInputRef.current &&
        !searchInputRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleSelectRecipient = (recipient: Recipient) => {
    onSelectRecipient(recipient);
    setIsOpen(false);
    setSearchText('');
  };

  const handleClearSelection = () => {
    onSelectRecipient(null);
    setSearchText('');
    setIsOpen(false);
  };

  // Sort recipients: followers first, then following
  const sortedRecipients = [...recipients].sort((a, b) => {
    const relationshipOrder = { follower: 0, friend: 1, following: 2 };
    const aOrder = relationshipOrder[a.relationship];
    const bOrder = relationshipOrder[b.relationship];
    if (aOrder !== bOrder) return aOrder - bOrder;
    return a.username.localeCompare(b.username);
  });

  return (
    <div className="relative">
      {/* Selected Recipient Display */}
      {selectedRecipient && (
        <div className="mb-3 p-3 rounded-md bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {selectedRecipient.avatar_url && (
              <Image
                src={selectedRecipient.avatar_url}
                alt={selectedRecipient.username}
                width={24}
                height={24}
                className="rounded-full"
              />
            )}
            <div>
              <p className="text-sm font-medium text-zinc-900 dark:text-white">
                {selectedRecipient.display_name || selectedRecipient.username}
              </p>
              <p className="text-xs text-zinc-600 dark:text-zinc-400">
                @{selectedRecipient.username}
              </p>
            </div>
          </div>
          <button
            onClick={handleClearSelection}
            className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
          >
            Change
          </button>
        </div>
      )}

      {/* Search Input */}
      {!selectedRecipient && (
        <div className="relative">
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search by username or name..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            onFocus={() => setIsOpen(true)}
            className="w-full px-3 py-2 rounded-md border border-zinc-300 dark:border-zinc-600
              bg-white dark:bg-zinc-800
              text-zinc-900 dark:text-white
              placeholder-zinc-400 dark:placeholder-zinc-500
              focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          {/* Recipients Dropdown */}
          {isOpen && (
            <div
              ref={dropdownRef}
              className="absolute top-full left-0 right-0 mt-2 rounded-md border border-zinc-300 dark:border-zinc-600
                bg-white dark:bg-zinc-800 shadow-lg z-40 max-h-64 overflow-y-auto"
            >
              {isLoading && (
                <div className="px-4 py-3 text-center text-sm text-zinc-500 dark:text-zinc-400">
                  Loading recipients...
                </div>
              )}

              {error && (
                <div className="px-4 py-3 text-sm text-red-600 dark:text-red-400">
                  {error}
                </div>
              )}

              {!isLoading && !error && sortedRecipients.length === 0 && (
                <div className="px-4 py-3 text-center text-sm text-zinc-500 dark:text-zinc-400">
                  {searchText ? 'No recipients found' : 'Follow users to share with them'}
                </div>
              )}

              {sortedRecipients.map((recipient) => (
                <button
                  key={recipient.user_id}
                  onClick={() => handleSelectRecipient(recipient)}
                  className="w-full px-4 py-3 text-left hover:bg-zinc-100 dark:hover:bg-zinc-700
                    border-b border-zinc-200 dark:border-zinc-700 last:border-b-0
                    transition-colors flex items-center gap-3"
                >
                  {recipient.avatar_url && (
                    <Image
                      src={recipient.avatar_url}
                      alt={recipient.username}
                      width={32}
                      height={32}
                      className="rounded-full flex-shrink-0"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-900 dark:text-white truncate">
                      {recipient.display_name || recipient.username}
                    </p>
                    <p className="text-xs text-zinc-600 dark:text-zinc-400">
                      @{recipient.username}
                    </p>
                  </div>
                  <span className="text-xs px-2 py-1 rounded-full bg-zinc-100 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 flex-shrink-0">
                    {recipient.relationship === 'follower' ? 'Follower' : 'Following'}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
