-- Change the default for urls.approved from FALSE to TRUE.
-- The column default was originally FALSE, which caused any insert that
-- didn't explicitly set approved=true to land as unapproved (invisible to
-- users via RLS).  Making the default TRUE means accidental omission of
-- the column won't hide content.
ALTER TABLE public.urls ALTER COLUMN approved SET DEFAULT TRUE;