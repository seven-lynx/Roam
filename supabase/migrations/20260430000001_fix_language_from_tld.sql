-- Disable statement timeout for this migration — regex UPDATEs across 3M rows
-- will exceed the default timeout without this.
SET statement_timeout = 0;

-- ── Fix language tags on already-seeded URLs using URL TLD heuristics ─────────
--
-- The Curlie seeder imported language-specific dump files (Deutsch, Français,
-- Italiano, Japanese) without tagging language — all rows defaulted to 'en'.
-- We cannot recover which file each row came from, but the destination URL's
-- country-code TLD is a reasonable proxy for language.
--
-- This is a best-effort pass, not a guarantee. English sites on .fr domains
-- (and vice-versa) exist, but they are rare enough that ccTLD heuristics
-- significantly improve signal quality for the pool.
--
-- Only rows currently tagged 'en' (i.e. the default) are updated, so any
-- row that was already tagged correctly is never touched.

-- German (.de, .at)
UPDATE public.urls
SET language = 'de'
WHERE language = 'en'
  AND (
    url ~ '^https?://[^/]*\.de(/|$)'
    OR url ~ '^https?://[^/]*\.at(/|$)'
  );

-- French (.fr)
UPDATE public.urls
SET language = 'fr'
WHERE language = 'en'
  AND url ~ '^https?://[^/]*\.fr(/|$)';

-- Italian (.it)
UPDATE public.urls
SET language = 'it'
WHERE language = 'en'
  AND url ~ '^https?://[^/]*\.it(/|$)';

-- Japanese (.jp, .co.jp)
UPDATE public.urls
SET language = 'ja'
WHERE language = 'en'
  AND (
    url ~ '^https?://[^/]*\.jp(/|$)'
    OR url ~ '^https?://[^/]*\.co\.jp(/|$)'
  );

-- Spanish (.es, .com.ar, .com.mx, .cl, .co, .pe)
UPDATE public.urls
SET language = 'es'
WHERE language = 'en'
  AND (
    url ~ '^https?://[^/]*\.es(/|$)'
    OR url ~ '^https?://[^/]*\.com\.ar(/|$)'
    OR url ~ '^https?://[^/]*\.com\.mx(/|$)'
    OR url ~ '^https?://[^/]*\.cl(/|$)'
  );

-- Portuguese (.pt, .com.br)
UPDATE public.urls
SET language = 'pt'
WHERE language = 'en'
  AND (
    url ~ '^https?://[^/]*\.pt(/|$)'
    OR url ~ '^https?://[^/]*\.com\.br(/|$)'
  );

-- Dutch (.nl)
UPDATE public.urls
SET language = 'nl'
WHERE language = 'en'
  AND url ~ '^https?://[^/]*\.nl(/|$)';

-- Polish (.pl)
UPDATE public.urls
SET language = 'pl'
WHERE language = 'en'
  AND url ~ '^https?://[^/]*\.pl(/|$)';

-- Russian (.ru)
UPDATE public.urls
SET language = 'ru'
WHERE language = 'en'
  AND url ~ '^https?://[^/]*\.ru(/|$)';

-- Chinese (.cn, .com.cn, .com.hk, .com.tw)
UPDATE public.urls
SET language = 'zh'
WHERE language = 'en'
  AND (
    url ~ '^https?://[^/]*\.cn(/|$)'
    OR url ~ '^https?://[^/]*\.com\.cn(/|$)'
  );

-- Korean (.kr, .co.kr)
UPDATE public.urls
SET language = 'ko'
WHERE language = 'en'
  AND (
    url ~ '^https?://[^/]*\.kr(/|$)'
    OR url ~ '^https?://[^/]*\.co\.kr(/|$)'
  );
