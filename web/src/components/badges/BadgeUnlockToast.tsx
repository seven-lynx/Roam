'use client';

import { useState, useEffect, useCallback, createContext, useContext, type ReactNode } from 'react';
import type { BadgeData } from './BadgeDisplay';

interface UnlockEvent {
  badge: BadgeData;
  id: string;
}

interface BadgeUnlockContextType {
  queue: UnlockEvent[];
  enqueue: (badge: BadgeData) => void;
  dequeue: () => void;
}

const BadgeUnlockContext = createContext<BadgeUnlockContextType>({
  queue: [],
  enqueue: () => {},
  dequeue: () => {},
});

export function useBadgeUnlock() {
  return useContext(BadgeUnlockContext);
}

export function BadgeUnlockProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<UnlockEvent[]>([]);

  const enqueue = useCallback((badge: BadgeData) => {
    const id = Math.random().toString(36).slice(2);
    setQueue((prev) => [...prev, { badge, id }]);
  }, []);

  const dequeue = useCallback(() => {
    setQueue((prev) => prev.slice(1));
  }, []);

  return (
    <BadgeUnlockContext.Provider value={{ queue, enqueue, dequeue }}>
      {children}
      <BadgeUnlockToast queue={queue} dequeue={dequeue} />
    </BadgeUnlockContext.Provider>
  );
}

function BadgeUnlockToast({ queue, dequeue }: { queue: UnlockEvent[]; dequeue: () => void }) {
  const [current, setCurrent] = useState<UnlockEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    if (queue.length > 0 && !current) {
      setCurrent(queue[0]);
      setVisible(true);
      setExiting(false);
    }
  }, [queue, current]);

  useEffect(() => {
    if (!current || !visible) return;
    const timer = setTimeout(() => {
      setExiting(true);
      setTimeout(() => {
        setVisible(false);
        setCurrent(null);
        dequeue();
      }, 300);
    }, 4000);
    return () => clearTimeout(timer);
  }, [current, visible, dequeue]);

  if (!current || !visible) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] max-w-sm">
      <div
        className={`
          rounded-xl shadow-2xl border overflow-hidden
          bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700
          transition-all duration-300
          ${exiting ? 'opacity-0 translate-y-4 scale-95' : 'opacity-100 translate-y-0 scale-100 animate-slide-up'}
        `}
      >
        <div className="bg-gradient-to-r from-yellow-400 via-orange-500 to-pink-500 h-1" />
        <div className="p-4">
          <div className="flex items-start gap-3">
            <span className="text-4xl">{current.badge.icon}</span>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-gray-900 dark:text-white">Badge Unlocked! 🎉</p>
              <p className="text-lg font-semibold text-gray-800 dark:text-gray-200 mt-0.5">
                {current.badge.name}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                {current.badge.description}
              </p>
              {current.badge.xp_reward > 0 && (
                <p className="text-xs mt-2 font-medium text-purple-600 dark:text-purple-400">
                  +{current.badge.xp_reward} XP
                </p>
              )}
            </div>
            <button
              onClick={() => {
                setExiting(true);
                setTimeout(() => {
                  setVisible(false);
                  setCurrent(null);
                  dequeue();
                }, 300);
              }}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              aria-label="Dismiss"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}