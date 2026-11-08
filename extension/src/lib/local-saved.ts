// local-saved.ts — helpers for the signed-out saved-page buffer.
//
// Pages saved while signed out live in chrome.storage.local under `saved_urls`.
// Older builds stored a bare string[]; both shapes are supported on read.

import type { LocalSavedUrl } from './messages';

export const LOCAL_SAVED_LIMIT = 200;

/** Coerces whatever is in storage into LocalSavedUrl[]. Never throws. */
export function normaliseLocalSaved(raw: unknown): LocalSavedUrl[] {
  if (!Array.isArray(raw)) return [];
  const out: LocalSavedUrl[] = [];
  for (const entry of raw) {
    if (typeof entry === 'string') {
      if (entry.length > 0) out.push({ url: entry, title: '', savedAt: 0 });
      continue;
    }
    if (entry && typeof entry === 'object') {
      const candidate = entry as Partial<LocalSavedUrl>;
      if (typeof candidate.url !== 'string' || candidate.url.length === 0) continue;
      out.push({
        url: candidate.url,
        title: typeof candidate.title === 'string' ? candidate.title : '',
        savedAt: typeof candidate.savedAt === 'number' ? candidate.savedAt : 0,
      });
    }
  }
  return out;
}

/** Prepends (or replaces by url) and caps the buffer. */
export function addLocalSaved(entries: LocalSavedUrl[], next: LocalSavedUrl): LocalSavedUrl[] {
  const without = entries.filter((e) => e.url !== next.url);
  return [next, ...without].slice(0, LOCAL_SAVED_LIMIT);
}

export function removeLocalSaved(entries: LocalSavedUrl[], url: string): LocalSavedUrl[] {
  return entries.filter((e) => e.url !== url);
}
