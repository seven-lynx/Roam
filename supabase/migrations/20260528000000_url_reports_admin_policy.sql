-- Allow admin users to read url_reports for the admin dashboard.
-- Writes are still only possible via the report-url Edge Function (service role).
CREATE POLICY "url_reports: admin can read"
  ON public.url_reports FOR SELECT
  USING (public.is_admin());
