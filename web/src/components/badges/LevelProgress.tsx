'use client';

interface LevelProgressProps {
  level: number;
  xpTotal: number;
  streakDays: number;
  maxStreak: number;
  badgeCount: number;
}

function xpForLevel(level: number): number {
  return (level - 1) * (level - 1) * 100;
}

const RANK_TITLES: Record<number, string> = {
  1: 'Novice',
  5: 'Apprentice',
  10: 'Explorer',
  15: 'Adventurer',
  20: 'Voyager',
  25: 'Pathfinder',
  30: 'Trailblazer',
  35: 'Discoverer',
  40: 'Pioneer',
  50: 'Master',
  60: 'Grand Master',
  75: 'Legend',
  100: 'Grandmaster',
};

function getRankTitle(level: number): string {
  const titles = Object.entries(RANK_TITLES).sort(([a], [b]) => Number(b) - Number(a));
  for (const [threshold, title] of titles) {
    if (level >= Number(threshold)) return title;
  }
  return 'Novice';
}

export function LevelProgress({ level, xpTotal, streakDays, maxStreak, badgeCount }: LevelProgressProps) {
  const currentLevelXp = xpForLevel(level);
  const nextLevelXp = xpForLevel(level + 1);
  const xpIntoLevel = xpTotal - currentLevelXp;
  const xpNeeded = nextLevelXp - currentLevelXp;
  const progressPercent = Math.min(100, Math.round((xpIntoLevel / xpNeeded) * 100));
  const rankTitle = getRankTitle(level);

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 sm:p-6">
      {/* Level badge */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-blue-600 text-white font-bold text-lg shadow-lg">
            {level}
          </div>
          <div>
            <p className="font-bold text-lg text-gray-900 dark:text-white">Level {level}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">{rankTitle}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-500 dark:text-gray-400">XP</p>
          <p className="font-mono font-bold text-gray-900 dark:text-white">{xpTotal.toLocaleString()}</p>
        </div>
      </div>

      {/* XP progress bar */}
      <div className="mb-3">
        <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
          <span>{xpIntoLevel.toLocaleString()} XP</span>
          <span>{xpNeeded.toLocaleString()} XP to Level {level + 1}</span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden">
          <div
            className="bg-gradient-to-r from-purple-500 to-blue-600 h-2.5 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Stats row */}
      <div className="flex gap-4 text-center border-t border-gray-100 dark:border-gray-800 pt-3">
        <div className="flex-1">
          <p className="text-lg font-bold text-gray-900 dark:text-white">{badgeCount}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Badges</p>
        </div>
        <div className="flex-1 border-l border-gray-100 dark:border-gray-800">
          <p className="text-lg font-bold text-gray-900 dark:text-white">🔥 {streakDays}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Day Streak</p>
        </div>
        <div className="flex-1 border-l border-gray-100 dark:border-gray-800">
          <p className="text-lg font-bold text-gray-900 dark:text-white">{maxStreak}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Best Streak</p>
        </div>
      </div>
    </div>
  );
}