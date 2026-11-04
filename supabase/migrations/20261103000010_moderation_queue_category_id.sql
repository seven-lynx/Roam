-- Add category_id (pillar) to moderation_queue so pillar-level submissions are
-- preserved end-to-end. submit-url previously only stored subcategory_id, so any
-- client that sent a top-level category_id (web, extension, Android thumbs-up)
-- had its category silently dropped and landed in discovery as uncategorized.
ALTER TABLE public.moderation_queue
  ADD COLUMN category_id UUID REFERENCES categories ON DELETE SET NULL;
