"use client";

interface ChallengeCardProps {
  title: string;
  goalDescription: string;
  goalCount: number;
  progressCurrent: number;
  xpReward: number;
  isCompleted: boolean;
  type: "daily" | "weekly" | "monthly";
}

export function ChallengeCard({
  title,
  goalDescription,
  goalCount,
  progressCurrent,
  xpReward,
  isCompleted,
  type,
}: ChallengeCardProps) {
  const progress = Math.min((progressCurrent / goalCount) * 100, 100);
  const typeColors = {
    daily: "bg-blue-500",
    weekly: "bg-purple-500",
    monthly: "bg-amber-500",
  };
  const typeLabels = {
    daily: "Daily",
    weekly: "Weekly",
    monthly: "Monthly",
  };

  return (
    <div className={`rounded-lg border p-4 transition-colors ${isCompleted ? "border-green-500 bg-green-50 dark:bg-green-950" : "border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800"}`}>
      <div className="flex items-start justify-between mb-2">
        <div>
          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium text-white ${typeColors[type]}`}>
            {typeLabels[type]}
          </span>
          <h3 className="mt-1 text-sm font-semibold text-gray-900 dark:text-gray-100">
            {title}
          </h3>
        </div>
        {isCompleted && (
          <span className="text-green-500 text-lg" title="Completed">&#10003;</span>
        )}
      </div>

      <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
        {goalDescription}
      </p>

      <div className="mb-2">
        <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400 mb-1">
          <span>{progressCurrent} / {goalCount}</span>
          <span>+{xpReward} XP</span>
        </div>
        <div className="h-2 w-full rounded-full bg-gray-200 dark:bg-gray-600 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${isCompleted ? "bg-green-500" : typeColors[type]}`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}