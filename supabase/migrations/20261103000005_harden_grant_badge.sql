-- ============================================================================
-- Harden grant_badge(): service-role only.
-- ============================================================================
-- grant_badge() awards an arbitrary badge + its XP reward, so it must never be
-- callable by a normal signed-in client (that would let any user self-award).
-- The only caller is the admin server action (web/src/app/admin/actions.ts),
-- which uses the service-role key. Restrict to service_role.
-- ============================================================================

REVOKE EXECUTE ON FUNCTION public.grant_badge(UUID, TEXT, UUID) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.grant_badge(UUID, TEXT, UUID) TO service_role;
