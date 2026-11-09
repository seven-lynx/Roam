-- ============================================================================
-- discovery_exhausted: notification type + one-shot claim (issue #120)
-- ============================================================================
-- roam() v39 records why a serve came back empty. A user who hits exhaustion in
-- the morning should hear about it once, not on every empty call, and never
-- twice for the same episode: claim_exhaustion_notifications() claims the rows
-- and writes the notifications in a single statement, so a retried or concurrent
-- run cannot deliver the same nudge again.
--
-- Push only, by construction: 'discovery_exhausted' is deliberately absent from
-- EMAIL_NOTIFICATION_TYPES in push-notify/index.ts, which is the allowlist of
-- types allowed to send email. Delivery goes through the existing
-- notifications -> push-notify webhook; nothing here calls push-notify directly.
-- ============================================================================

-- ── 1. Widen the notification type CHECK ────────────────────────────────────
-- Same pattern as 20260805000000_challenge_system.sql:167-173, the last widening.
ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'url_approved', 'url_rejected', 'new_follower', 'badge_unlocked',
    'level_up', 'url_shared', 'challenge_complete', 'discovery_exhausted'
  ));

-- ── 2. Claim and notify in one statement ────────────────────────────────────
-- The UPDATE ... RETURNING is the claim: row locks make a concurrent run see
-- notified_at already set, and because the INSERT reads from that same CTE the
-- whole thing is one atomic statement. If it fails, nothing is claimed and the
-- next run retries.
CREATE OR REPLACE FUNCTION public.claim_exhaustion_notifications()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_notified INTEGER;
BEGIN
  WITH claimed AS (
    UPDATE public.user_exhaustion_state s
       SET notified_at = now()
     WHERE s.notified_at IS NULL
       -- Only a reason seen in the last day is worth a nudge. record_exhaustion()
       -- refreshes last_detected_at at least every 15 minutes while the state is
       -- live, so an older row means the user has not hit it recently.
       AND s.last_detected_at > now() - INTERVAL '24 hours'
    RETURNING s.user_id, s.scope_key, s.reason, s.available_later
  ), prepared AS (
    SELECT c.user_id, c.scope_key, c.reason, c.available_later,
           GREATEST(1, ROUND(EXTRACT(EPOCH FROM (c.available_later - now())) / 3600.0))::INTEGER AS hours_left
    FROM   claimed c
  ), inserted AS (
    INSERT INTO public.notifications (user_id, type, title, body, data)
    SELECT
      p.user_id,
      'discovery_exhausted',
      CASE p.reason
        WHEN 'pool_empty' THEN 'You have read it all'
        WHEN 'cooldown'   THEN 'Your feed is resting'
        ELSE 'Nothing matched your filters'
      END,
      -- push-notify answers 400 for a notification without a body
      -- (push-notify/index.ts:606), even though the column is nullable.
      CASE p.reason
        WHEN 'pool_empty' THEN
          'Nothing new left in this feed. Try another category to keep exploring.'
        WHEN 'cooldown' THEN
          'Every domain in this feed is cooling down. It refills ' ||
          CASE
            WHEN p.available_later IS NULL THEN 'soon.'
            WHEN p.available_later <= now() + INTERVAL '1 hour' THEN 'within the hour.'
            ELSE 'in about ' || p.hours_left::TEXT ||
                 CASE WHEN p.hours_left = 1 THEN ' hour.' ELSE ' hours.' END
          END
        ELSE
          'Your filters are hiding everything in this feed. Loosen them to see more.'
      END,
      jsonb_build_object(
        'reason',          p.reason,
        'scope',           p.scope_key,
        'available_later', p.available_later,
        'url',             '/'
      )
    FROM prepared p
    RETURNING 1
  )
  SELECT count(*)::INTEGER INTO v_notified FROM inserted;

  RETURN v_notified;
END;
$$;

-- Service role only: a client must not be able to fire every user's notifications.
REVOKE EXECUTE ON FUNCTION public.claim_exhaustion_notifications() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.claim_exhaustion_notifications() TO service_role;

