# Email (bulk / newsletter) system

How admin emails are composed, sent, and unsubscribed. This is a manual-only system
(no automated sends), triggered from the admin dashboard.

## The recipient list

The list is **not** stored anywhere separate. It is derived live from the DB:

- `user_settings.email_notifications` (boolean, default `true`) is the single opt-out flag.
- The Settings page (Notifications tab) toggles this flag.
- The email unsubscribe link also toggles this flag.

So "unsubscribe in the email" and "turn off emails in settings" are the same thing.
The bulk sender only targets rows where `email_notifications = true`, then resolves
each `user_id` to an email address via `auth.admin.listUsers()` (paginated, 1000/page).

## Sending flow

1. Admin dashboard -> Email tab (`/admin?view=email`).
2. Compose a subject + body, pick **Markdown** or **HTML**, optionally set a **Test email**.
3. "Send to All" calls the server action `sendBulkEmail()` in
   `web/src/app/admin/actions.ts`, which POSTs to the `send-bulk-email` Edge Function.
4. The Edge Function renders the body, injects a per-recipient unsubscribe link, and
   sends through the **Resend** API (`https://api.resend.com/emails`) in batches of 50.
5. Results are logged to the `email_log` table and shown under "Email History".

## Markdown vs HTML

- **Markdown** (default): rendered to HTML by a small built-in renderer (headings,
  bold, italic, lists, links), with a plain-text fallback. The unsubscribe footer is
  appended automatically.
- **HTML**: sent verbatim. The plain-text fallback is the HTML with tags stripped.

For HTML sends, put the token `{{UNSUBSCRIBE_URL}}` wherever the unsubscribe link
should go. The Edge Function replaces it with each recipient's unique signed link. If
the token is missing, a minimal footer with an unsubscribe link is appended so the
recipient can still opt out.

## Test email

Fill the "Test email" field to send to a single address instead of the whole list.
In test mode the unsubscribe link points at `/settings` (there is no real user token).
Clear the field to send to everyone.

## Unsubscribe endpoint

- `GET /api/unsubscribe?token=<signed-token>` (`web/src/app/api/unsubscribe/route.ts`).
- Token format: `base64(userId.timestamp.hexSignature)`, HMAC-SHA256 signed with
  `SUPABASE_SERVICE_ROLE_KEY`, expiring after 90 days.
- On success it sets `email_notifications = false` and redirects to
  `/settings?unsubscribed=true`.

## Logging

`email_log` records `subject`, `body_md` (raw body), `recipient_count`,
`success_count`, `fail_count`, `sent_by`, `sender_type`, and `sent_at`. The admin UI
shows the last 50 sends. `sent_by` is a placeholder UUID (the Edge Function has no
authenticated admin user).

## Ops prerequisites (do these before the first send)

1. **Set `RESEND_API_KEY` as a Supabase Edge Function secret.** The function reads it
   via `Deno.env.get('RESEND_API_KEY')`, so it must live in Supabase (Project Settings ->
   Edge Functions -> Secrets), not Vercel. Without it the function returns
   `RESEND_API_KEY not configured`.
2. **Verify `mail.roamtheweb.app` in Resend** (add the SPF + DKIM records). The sender
   is `Roam <hello@mail.roamtheweb.app>`.

## Files

- `web/src/app/admin/views/AdminEmail.tsx` - compose UI (Markdown/HTML toggle, preview, test email).
- `web/src/app/admin/AdminPageClient.tsx` - admin page wiring.
- `web/src/app/admin/actions.ts` - `sendBulkEmail()` server action.
- `supabase/functions/send-bulk-email/index.ts` - the Edge Function.
- `web/src/app/api/unsubscribe/route.ts` - unsubscribe handler.
- `supabase/migrations/20260707000000_email_notifications.sql` - schema.
