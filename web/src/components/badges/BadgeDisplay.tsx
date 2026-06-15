'use client';

import { Tooltip } from '@/components/ui/tooltip';

export type BadgeData = {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  tier: number;
  required_count: number | null;
  is_unlocked: boolean;
  unlocked_at: string | null;
  progress_current: number;
  is_hidden: boolean;
  is_gift_only: boolean;
  xp_reward: number;
  parent_badge_slug: string | null;
  granted_by: string | null;
};

const TIER_NAMES: Record<number, string> = {
  0: '',
  1: 'Bronze',
  2: 'Silver',
  3: 'Gold',
  4: 'Platinum',
  5: 'Legendary',
};

const TIER_COLORS: Record<number, string> = {
  0: 'bg-gray-100 dark:bg-gray-800',
  1: 'bg-amber-100 dark:bg-amber-900/30 border-amber-300 dark:border-amber-700',
  2: 'bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600',
  3: 'bg-yellow-100 dark:bg-yellow-900/30 border-yellow-400 dark:border-yellow-600',
  4: 'bg-cyan-100 dark:bg-cyan-900/30 border-cyan-300 dark:border-cyan-700',
  5: 'bg-purple-100 dark:bg-purple-900/30 border-purple-400 dark:border-purple-600',
};

const CATEGORY_LABELS: Record<string, string> = {
  exploration: 'Exploration',
  collecting: 'Collecting',
  curating: 'Curating',
  social: 'Social',
  streaks: 'Streaks',
  contributing: 'Contributing',
  engagement: 'Engagement',
  secret: 'Secret',
  milestone: 'Milestone',
  gift: 'Gift',
};

interface BadgeDisplayProps {
  badges: BadgeData[];
  showLocked?: boolean;
  showSecret?: boolean;
  compact?: boolean;
  maxDisplay?: number;
}

export function BadgeDisplay({ badges, showLocked = true, showSecret = false, compact = false, maxDisplay }: BadgeDisplayProps) {
  const unlocked = badges.filter(b => b.is_unlocked);
  const locked = badges.filter(b => !b.is_unlocked && (showSecret || !b.is_hidden));

  const displayBadges = [...unlocked, ...(showLocked ? locked : [])];
  const limited = maxDisplay ? displayBadges.slice(0, maxDisplay) : displayBadges;

  if (displayBadges.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        <span className="text-4xl block mb-2">🏅</span>
        <p className="text-sm">No badges yet. Start roaming to earn your first badge!</p>
      </div>
    );
  }

  return (
    <div className={`grid gap-2 ${compact ? 'grid-cols-4 sm:grid-cols-6' : 'grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6'}`}>
      {limited.map((badge) => (
        <BadgeItem key={badge.id} badge={badge} compact={compact} />
      ))}
      {maxDisplay && displayBadges.length > maxDisplay && (
        <div className={`flex items-center justify-center ${compact ? 'p-1' : 'p-3'} text-sm text-gray-500 dark:text-gray-400`}>
          +{displayBadges.length - maxDisplay} more
        </div>
      )}
    </div>
  );
}

function BadgeItem({ badge, compact }: { badge: BadgeData; compact: boolean }) {
  const unlocked = badge.is_unlocked;
  const tierColor = unlocked ? TIER_COLORS[badge.tier] || TIER_COLORS[0] : 'bg-gray-50 dark:bg-gray-800/50 opacity-60';

  const progressPercent = badge.required_count
    ? Math.min(100, Math.round((badge.progress_current / badge.required_count) * 100))
    : badge.progress_current > 0 ? 100 : 0;

  return (
    <Tooltip content={
      <div className="max-w-[200px] text-center">
        <p className="font-semibold text-sm">{badge.icon} {badge.name}</p>
        <p className="text-xs mt-0.5">{badge.description}</p>
        {!unlocked && badge.is_hidden ? (
          <p className="text-xs mt-1 italic">???</p>
        ) : null}
        {!unlocked && !badge.is_hidden && badge.required_count && (
          <div className="mt-1">
            <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-1.5">
              <div
                className="bg-blue-500 h-1.5 rounded-full transition-all"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <p className="text-[10px] mt-0.5">{badge.progress_current} / {badge.required_count}</p>
          </div>
        )}
        {badge.tier > 0 && TIER_NAMES[badge.tier] && (
          <p className="text-[10px] mt-0.5 font-medium">{TIER_NAMES[badge.tier]}</p>
        )}
        {badge.xp_reward > 0 && <p className="text-[10px]">+{badge.xp_reward} XP</p>}
        {unlocked && badge.unlocked_at && (
          <p className="text-[10px] mt-0.5 opacity-70">
            {new Date(badge.unlocked_at).toLocaleDateString()}
          </p>
        )}
        {badge.granted_by && (
          <p className="text-[10px] italic mt-0.5">Gifted by an admin</p>
        )}
      </div>
    }>
      <div
        className={`
          relative flex flex-col items-center justify-center rounded-lg border
          ${compact ? 'p-1.5' : 'p-3'}
          ${tierColor}
          transition-all duration-200 hover:scale-105 cursor-default
          ${unlocked ? '' : 'grayscale-[30%]'}
        `}
      >
        {badge.tier > 0 && unlocked && (
          <span className="absolute top-0.5 right-0.5 text-[8px] opacity-60">
            {TIER_NAMES[badge.tier]}
          </span>
        )}
        <span className={`${compact ? 'text-xl' : 'text-2xl'} leading-none`}>
          {badge.is_hidden && !unlocked ? '❓' : badge.icon}
        </span>
        {!compact && (
          <span className="text-[10px] mt-1 text-center leading-tight line-clamp-2 font-medium">
            {badge.is_hidden && !unlocked ? '???' : badge.name}
          </span>
        )}
        {!unlocked && !badge.is_hidden && badge.required_count && (
          <div className="mt-1 w-full px-1">
            <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-1">
              <div
                className="bg-blue-500 h-1 rounded-full transition-all"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </Tooltip>
  );
}

export { CATEGORY_LABELS, TIER_NAMES, TIER_COLORS };