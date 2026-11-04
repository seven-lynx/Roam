-- =============================================================================
-- Approval notification copy: "catalog" -> "database"
-- =============================================================================
-- The moderation trigger's approval body read "...was approved and is now in
-- the catalog." Align it with the "database" wording used elsewhere in the
-- approval flow so the in-app notification and the transactional approval
-- email stay consistent.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.notify_on_moderation_decision()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = ''
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.status = 'pending' AND NEW.status IN ('approved', 'rejected') THEN
    INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (
      NEW.submitted_by,
      CASE WHEN NEW.status = 'approved' THEN 'url_approved' ELSE 'url_rejected' END,
      CASE WHEN NEW.status = 'approved' THEN 'URL approved!' ELSE 'URL not approved' END,
      CASE
        WHEN NEW.status = 'approved' THEN 'Your submission "' || COALESCE(NULLIF(NEW.title, ''), NEW.url) || '" was approved and is now in the database.'
        ELSE 'Your submission "' || COALESCE(NULLIF(NEW.title, ''), NEW.url) || '" was not approved.'
      END,
      jsonb_build_object(
        'url', NEW.url,
        'queue_id', NEW.id,
        'title', NEW.title
      )
    );
  END IF;
  RETURN NEW;
END;
$$;
