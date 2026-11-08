import { describe, it, expect } from 'vitest';
import { addLocalSaved, normaliseLocalSaved, removeLocalSaved, LOCAL_SAVED_LIMIT } from '../lib/local-saved';
import type { LocalSavedUrl } from '../lib/messages';

function entry(url: string, savedAt = 1): LocalSavedUrl {
  return { url, title: `title for ${url}`, savedAt };
}

describe('normaliseLocalSaved', () => {
  it('reads the legacy string[] shape', () => {
    expect(normaliseLocalSaved(['https://a.test', 'https://b.test'])).toEqual([
      { url: 'https://a.test', title: '', savedAt: 0 },
      { url: 'https://b.test', title: '', savedAt: 0 },
    ]);
  });

  it('reads the object shape', () => {
    expect(normaliseLocalSaved([{ url: 'https://a.test', title: 'A', savedAt: 99 }])).toEqual([
      { url: 'https://a.test', title: 'A', savedAt: 99 },
    ]);
  });

  it('fills missing fields on partial objects', () => {
    expect(normaliseLocalSaved([{ url: 'https://a.test' }])).toEqual([
      { url: 'https://a.test', title: '', savedAt: 0 },
    ]);
  });

  it('drops malformed entries', () => {
    expect(normaliseLocalSaved([null, 42, { title: 'no url' }, '', { url: 'https://ok.test' }])).toEqual([
      { url: 'https://ok.test', title: '', savedAt: 0 },
    ]);
  });

  it('returns an empty list for a non-array value', () => {
    expect(normaliseLocalSaved(undefined)).toEqual([]);
    expect(normaliseLocalSaved({ url: 'https://a.test' })).toEqual([]);
  });
});

describe('addLocalSaved', () => {
  it('prepends the new entry', () => {
    expect(addLocalSaved([entry('https://a.test')], entry('https://b.test')).map((e) => e.url)).toEqual([
      'https://b.test',
      'https://a.test',
    ]);
  });

  it('replaces an existing entry with the same url', () => {
    const result = addLocalSaved([entry('https://a.test', 1)], entry('https://a.test', 2));
    expect(result).toHaveLength(1);
    expect(result[0].savedAt).toBe(2);
  });

  it('caps the buffer', () => {
    const full = Array.from({ length: LOCAL_SAVED_LIMIT }, (_, i) => entry(`https://a.test/${i}`));
    const result = addLocalSaved(full, entry('https://new.test'));
    expect(result).toHaveLength(LOCAL_SAVED_LIMIT);
    expect(result[0].url).toBe('https://new.test');
  });
});

describe('removeLocalSaved', () => {
  it('removes by url', () => {
    const result = removeLocalSaved([entry('https://a.test'), entry('https://b.test')], 'https://a.test');
    expect(result.map((e) => e.url)).toEqual(['https://b.test']);
  });

  it('is a no-op for an unknown url', () => {
    const list = [entry('https://a.test')];
    expect(removeLocalSaved(list, 'https://zzz.test')).toEqual(list);
  });
});
