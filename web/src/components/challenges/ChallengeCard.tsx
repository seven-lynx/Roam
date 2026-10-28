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
    daily: "bg-phosphor",
    weekly: "bg-brass",
    monthly: "bg-gold",
  };
  const typeLabels = {
    daily: "Daily",
    weekly: "Weekly",
    monthly: "Monthly",
  };

  return (
    <div className={`panel p-4 transition-colors ${isCompleted ? "border-l-4 toast-ok" : ""}`}>
      <div className="flex items-start justify-between mb-2">
        <div>
          <span className={`inline-block px-2 py-0.5 text-xs font-medium text-abyss ${typeColors[type]}`}>
            {typeLabels[type]}
          </span>
          <h3 className="mt-1 text-sm font-semibold text-ink">
            {title}
          </h3>
        </div>
        {isCompleted && (
          <span className="text-ok text-lg" title="Completed">&#10003;</span>
        )}
      </div>

      <p className="text-xs text-muted mb-3">
        {goalDescription}
      </p>

      <div className="mb-2">
        <div className="flex justify-between text-xs text-muted mb-1">
          <span>{progressCurrent} / {goalCount}</span>
          <span>+{xpReward} XP</span>
        </div>
        <div className="h-2 w-full bg-panel-3 overflow-hidden">
          <div
            className={`h-full transition-all duration-500 ${isCompleted ? "bg-ok" : typeColors[type]}`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}