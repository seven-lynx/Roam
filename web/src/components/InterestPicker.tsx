'use client';

import type { InterestMode } from '@/lib/interests';

export interface Category {
  id: string;
  label: string;
  emoji: string;
}

export interface Subcategory {
  id: string;
  name: string;
  category_id: string;
}

interface InterestPickerProps {
  categories: Category[];
  subcategories: Subcategory[];
  mode: InterestMode;
  selectedPillars: Set<string>;
  selectedTopics: Set<string>;
  onPillarToggle: (id: string) => void;
  onTopicToggle: (id: string) => void;
  onModeChange: (mode: InterestMode) => void;
}

export function InterestPicker({
  categories,
  subcategories,
  mode,
  selectedPillars,
  selectedTopics,
  onPillarToggle,
  onTopicToggle,
  onModeChange,
}: InterestPickerProps) {
  // Group subcategories by parent category for the topics view
  const subcatsByCategory = new Map<string, Subcategory[]>();
  for (const sc of subcategories) {
    const group = subcatsByCategory.get(sc.category_id) ?? [];
    group.push(sc);
    subcatsByCategory.set(sc.category_id, group);
  }

  if (mode === 'pillars') {
    return (
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          {categories.map((cat) => {
            const active = selectedPillars.has(cat.id);
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => onPillarToggle(cat.id)}
                className={`flex flex-col items-center gap-1 rounded-xl border-2 px-4 py-3 text-sm font-medium transition-colors ${
                  active
                    ? 'border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-zinc-900'
                    : 'border-zinc-200 text-zinc-700 hover:border-zinc-400 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-zinc-500'
                }`}
              >
                <span>{cat.emoji}</span>
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>
        {subcategories.length > 0 && (
          <button
            type="button"
            onClick={() => onModeChange('topics')}
            className="self-start text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors underline underline-offset-2"
          >
            Choose specific topics instead →
          </button>
        )}
      </div>
    );
  }

  // Topics mode
  return (
    <div className="flex flex-col gap-5">
      <button
        type="button"
        onClick={() => onModeChange('pillars')}
        className="self-start text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors underline underline-offset-2"
      >
        ← Choose categories instead
      </button>

      <div className="flex flex-col gap-6">
        {categories.map((cat) => {
          const subcats = subcatsByCategory.get(cat.id) ?? [];
          if (subcats.length === 0) return null;
          return (
            <div key={cat.id}>
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 mb-2">
                {cat.emoji} {cat.label}
              </p>
              <div className="flex flex-wrap gap-2">
                {subcats.map((sc) => {
                  const active = selectedTopics.has(sc.id);
                  return (
                    <button
                      key={sc.id}
                      type="button"
                      onClick={() => onTopicToggle(sc.id)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                        active
                          ? 'border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-zinc-900'
                          : 'border-zinc-300 text-zinc-600 hover:border-zinc-500 dark:border-zinc-600 dark:text-zinc-400 dark:hover:border-zinc-400'
                      }`}
                    >
                      {sc.name}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
