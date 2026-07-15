-- Fix subcategory names that were auto-generated as SCREAMING_UPPERCASE
-- rather than human-readable title-case names.
--
-- These 19 subcategories had placeholder names from the taxonomy import.
-- This migration normalizes them to match the style of other subcategories.

UPDATE public.subcategories SET name = 'Astrobiology & Exoplanets'          WHERE id = 'c2000001-0000-0000-0000-000000000010';
UPDATE public.subcategories SET name = 'Botany & Plant Science'             WHERE id = 'c2000001-0000-0000-0000-000000000011';
UPDATE public.subcategories SET name = 'Climate & Atmospheric Science'      WHERE id = 'c2000001-0000-0000-0000-000000000012';
UPDATE public.subcategories SET name = 'Neuroscience & Cognition'           WHERE id = 'c2000001-0000-0000-0000-000000000013';
UPDATE public.subcategories SET name = 'Databases & Data Engineering'       WHERE id = 'c2000002-0000-0000-0000-000000000010';
UPDATE public.subcategories SET name = 'Cryptography & Security'            WHERE id = 'c2000002-0000-0000-0000-000000000011';
UPDATE public.subcategories SET name = 'DevOps & Infrastructure'            WHERE id = 'c2000002-0000-0000-0000-000000000012';
UPDATE public.subcategories SET name = 'Legal & Constitutional History'     WHERE id = 'c2000004-0000-0000-0000-000000000010';
UPDATE public.subcategories SET name = 'History of Science & Technology'    WHERE id = 'c2000004-0000-0000-0000-000000000011';
UPDATE public.subcategories SET name = 'Exploration & Discovery'             WHERE id = 'c2000004-0000-0000-0000-000000000012';
UPDATE public.subcategories SET name = 'Cultural & Intellectual History'    WHERE id = 'c2000004-0000-0000-0000-000000000013';
UPDATE public.subcategories SET name = 'Cryptozoology & Mythical Creatures' WHERE id = 'c2000006-0000-0000-0000-000000000010';
UPDATE public.subcategories SET name = 'Forteana & Anomalies'               WHERE id = 'c2000006-0000-0000-0000-000000000011';
UPDATE public.subcategories SET name = 'Underground & Subterranean'         WHERE id = 'c2000006-0000-0000-0000-000000000012';
UPDATE public.subcategories SET name = 'Oceans & Maritime'                  WHERE id = 'c2000007-0000-0000-0000-000000000010';
UPDATE public.subcategories SET name = 'Deserts & Arid Lands'               WHERE id = 'c2000007-0000-0000-0000-000000000011';
UPDATE public.subcategories SET name = 'Mountains & Alpine Environments'    WHERE id = 'c2000007-0000-0000-0000-000000000012';
UPDATE public.subcategories SET name = 'Aging & Longevity'                  WHERE id = 'c2000008-0000-0000-0000-000000000010';
UPDATE public.subcategories SET name = 'Addiction & Recovery'               WHERE id = 'c2000008-0000-0000-0000-000000000011';
UPDATE public.subcategories SET name = 'Human Performance & Biohacking'     WHERE id = 'c2000008-0000-0000-0000-000000000012';