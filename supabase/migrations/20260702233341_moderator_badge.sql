-- Moderator badge: gift-only, hidden, tier 4
-- Applied directly via Supabase MCP on 2026-07-02

INSERT INTO public.badges (slug, name, description, icon, category, tier, required_count, is_hidden, is_gift_only, xp_reward)
VALUES ('moderator', 'Moderator', 'Trusted community moderator', '🛡️', 'gift', 4, NULL, true, true, 0)
ON CONFLICT (slug) DO NOTHING;
