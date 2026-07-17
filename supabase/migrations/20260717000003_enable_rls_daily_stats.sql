-- ============================================================================
-- Enable RLS on daily_stats and add read RPC for admin analytics
-- ============================================================================

-- 1. Enable RLS on the daily_stats table (fixes Supabase warning)
ALTER TABLE public.daily_stats ENABLE ROW LEVEL SECURITY;

-- 2. Service role retains full access (refresh_daily_stats writes via SECURITY DEFINER)
CREATE POLICY "service_role_full_access" ON public.daily_stats
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 3. Authenticated users can read (admin dashboard reads via service_role RPC anyway,
--    but this allows future client-side reads if desired)
CREATE POLICY "authenticated_select" ON public.daily_stats
  FOR SELECT
  TO authenticated
  USING (true);

-- 4. Revoke public access for good measure
REVOKE ALL ON public.daily_stats FROM PUBLIC, anon;

-- 5. RPC to fetch recent daily_stats rows for admin dashboard
CREATE OR REPLACE FUNCTION public.get_daily_stats(p_days INT DEFAULT 30)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET statement_timeout = '5s'
AS $$
DECLARE
  v_rows JSON;
BEGIN
  SELECT json_agg(row ORDER BY row.date)
  INTO v_rows
  FROM (
    SELECT
      date::text       AS date,
      dau,
      mau,
      new_users,
      total_roams,
      total_saves,
      total_submits
    FROM public.daily_stats
    WHERE date >= CURRENT_DATE - (p_days - 1)
    ORDER BY date DESC
  ) row;
  RETURN COALESCE(v_rows, '[]'::json);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_daily_stats(INT) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.get_daily_stats(INT) TO service_role;