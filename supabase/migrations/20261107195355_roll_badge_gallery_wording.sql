-- =============================================================================
-- Reconcile the two Gallery badge rows to their shipped wording
-- =============================================================================
-- Context (issue #50). 20261103000001_roll_badges.sql seeds 'roll-wallpaper'
-- and 'roll-rate-5' against the June taxonomy ('engagement'); the next
-- migration, 20261103000002_unify_xp_badges.sql, renames that category to
-- 'curiosity' and widens badges_category_check. Because 00001 is applied
-- BEFORE 00002 on every existing project, the wording update that shipped
-- inside 651668a -- an edit to the already-applied 00001 -- never executed
-- anywhere, and it broke replay from an empty database. 651668a was reverted;
-- this migration carries the wording half forward as a normal, forward-only
-- reconciliation.
--
-- Data-only, idempotent, no schema change: safe to apply to production.
-- =============================================================================

UPDATE public.badges
   SET category    = 'curiosity',
       description = CASE slug
         WHEN 'roll-wallpaper' THEN 'Set a photo from the Gallery as your desktop wallpaper'
         WHEN 'roll-rate-5'    THEN 'Like 5 photos in the Gallery'
       END
 WHERE slug IN ('roll-wallpaper', 'roll-rate-5');

