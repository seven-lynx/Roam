-- ─────────────────────────────────────────────────────────────────────────────
-- Fix non-English URLs that were incorrectly tagged language = 'en'
-- ─────────────────────────────────────────────────────────────────────────────
-- Root cause: the Curlie seeder tagged all URLs in rdf-World-c.tsv (and other
-- "English index" files) as language = 'en', but that file contains the entire
-- Top/World/ branch which includes content in every language.  Any other seeder
-- that didn't specify a language also fell back to 'en' via seed.js.
--
-- Fix strategy: regex-match the TLD of the hostname.  A URL like
--   https://example.de/page
-- whose TLD is .de almost certainly contains German content, so we correct it
-- to language = 'de'.  We are deliberately conservative (only clear-cut TLDs
-- with a single dominant language) so we don't mis-tag multilingual CCTLDs.
--
-- Skipped intentionally:
--   .ch  (Switzerland — de/fr/it split)
--   .be  (Belgium — fr/nl/de split)
--   .ca  (Canada — en/fr split)
--   .co  (generic gTLD also used as Colombia)
-- ─────────────────────────────────────────────────────────────────────────────

UPDATE public.urls
SET language = CASE
  -- German: .de  .at (Austria)
  WHEN url ~* '^https?://[^/?#]+\.(de|at)([/?#]|$)' THEN 'de'
  -- French: .fr
  WHEN url ~* '^https?://[^/?#]+\.fr([/?#]|$)' THEN 'fr'
  -- Spanish: .es  .mx (Mexico)  .ar (Argentina)
  WHEN url ~* '^https?://[^/?#]+\.(es|mx|ar)([/?#]|$)' THEN 'es'
  -- Italian: .it
  WHEN url ~* '^https?://[^/?#]+\.it([/?#]|$)' THEN 'it'
  -- Dutch: .nl
  WHEN url ~* '^https?://[^/?#]+\.nl([/?#]|$)' THEN 'nl'
  -- Polish: .pl
  WHEN url ~* '^https?://[^/?#]+\.pl([/?#]|$)' THEN 'pl'
  -- Russian: .ru
  WHEN url ~* '^https?://[^/?#]+\.ru([/?#]|$)' THEN 'ru'
  -- Japanese: .jp
  WHEN url ~* '^https?://[^/?#]+\.jp([/?#]|$)' THEN 'ja'
  -- Chinese: .cn  .tw (Taiwan)
  WHEN url ~* '^https?://[^/?#]+\.(cn|tw)([/?#]|$)' THEN 'zh'
  -- Korean: .kr
  WHEN url ~* '^https?://[^/?#]+\.kr([/?#]|$)' THEN 'ko'
  -- Portuguese: .pt  .br (Brazil)
  WHEN url ~* '^https?://[^/?#]+\.(pt|br)([/?#]|$)' THEN 'pt'
  -- Swedish: .se
  WHEN url ~* '^https?://[^/?#]+\.se([/?#]|$)' THEN 'sv'
  -- Norwegian: .no
  WHEN url ~* '^https?://[^/?#]+\.no([/?#]|$)' THEN 'no'
  -- Danish: .dk
  WHEN url ~* '^https?://[^/?#]+\.dk([/?#]|$)' THEN 'da'
  -- Finnish: .fi
  WHEN url ~* '^https?://[^/?#]+\.fi([/?#]|$)' THEN 'fi'
  -- Czech: .cz
  WHEN url ~* '^https?://[^/?#]+\.cz([/?#]|$)' THEN 'cs'
  -- Hungarian: .hu
  WHEN url ~* '^https?://[^/?#]+\.hu([/?#]|$)' THEN 'hu'
  -- Romanian: .ro
  WHEN url ~* '^https?://[^/?#]+\.ro([/?#]|$)' THEN 'ro'
  -- Greek: .gr
  WHEN url ~* '^https?://[^/?#]+\.gr([/?#]|$)' THEN 'el'
  -- Turkish: .tr
  WHEN url ~* '^https?://[^/?#]+\.tr([/?#]|$)' THEN 'tr'
  ELSE language  -- no-op for unmatched rows (safety)
END
WHERE language = 'en'
  AND (
    url ~* '^https?://[^/?#]+\.(de|at|fr|es|mx|ar|it|nl|pl|ru|jp|cn|tw|kr|pt|br|se|no|dk|fi|cz|hu|ro|gr|tr)([/?#]|$)'
  );

-- Log how many rows were corrected (visible in migration output)
DO $$
DECLARE
  v_count INT;
BEGIN
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'fix_curlie_language: corrected % rows', v_count;
END $$;
