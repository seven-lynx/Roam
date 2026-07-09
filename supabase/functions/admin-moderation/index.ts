// POST /functions/v1/admin-moderation
// Body: { action: "list" | "approve" | "reject" | "stats" | "reports" | "restore" }
//
// Requires JWT with app_metadata.role = 'admin' or 'moderator'.
// The admin-only actions (beta signups, email) are handled by the web admin
// server actions. This edge function covers moderation queue + stats + reports.
//
// Actions:
//   list     — returns all moderation_queue entries with submitter profile + subcategory
//   approve  — body: { id } — updates moderation_queue.status = 'approved', upserts into urls
//   reject   — body: { id } — updates moderation_queue.status = 'rejected'
//   stats    — returns { pending, approved, rejected, reports }
//   reports  — returns grouped url_reports with report count
//   restore  — body: { url_id } — sets urls.inactive = false

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCorsHeaders } from '../_shared/cors.ts'
import { validateRequired } from '../_shared/env.ts'
import { initSentry } from '../_shared/sentry.ts'

const report = initSentry('admin-moderation')

const env = validateRequired([
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
])

const ADMIN_HEADERS = {
  apikey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!}`,
}

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin')
  if (req.method === 'OPTIONS') return new Response('ok', { headers: getCorsHeaders(origin) })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  // Authenticate via user JWT (not service key — verifies the user is signed in)
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } },
  )

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return json({ error: 'Unauthorized' }, 401)

  // Role check — must be admin or moderator
  const role = user.app_metadata?.role as string | undefined
  if (role !== 'admin' && role !== 'moderator') {
    return json({ error: 'Forbidden — admin or moderator role required' }, 403)
  }
  const isAdmin = role === 'admin'

  // Service-role admin client for bypassing RLS on upserts/deletes
  const adminClient = createClient(
    env.SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return json({ error: 'Invalid JSON' }, 400) }

  const action = typeof body.action === 'string' ? body.action : null
  if (!action) return json({ error: 'action is required' }, 400)

  try {
    switch (action) {
      case 'list': return await handleList(adminClient)
      case 'approve': return await handleApprove(adminClient, body, user)
      case 'reject': return await handleReject(adminClient, body, user)
      case 'stats': return await handleStats(adminClient)
      case 'reports': return await handleReports(adminClient)
      case 'restore': return await handleRestore(adminClient, body)
      default: return json({ error: `Unknown action: ${action}` }, 400)
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[admin-moderation] ${action} failed:`, message)
    report(err, 'error', { action, userId: user.id })
    return json({ error: message }, 500)
  }
})

// ── Handlers ─────────────────────────────────────────────────────────────────

// deno-lint-ignore no-explicit-any
async function handleList(admin: any) {
  const { data, error } = await admin
    .from('moderation_queue')
    .select(`
      id,
      url,
      title,
      description,
      status,
      safe_browsing_passed,
      submitted_by,
      created_at,
      updated_at,
      reviewer_note,
      reviewed_by,
      subcategory_id
    `)
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) return json({ error: error.message }, 500)

  // Fetch submitter profiles for display
  const userIds = [...new Set((data ?? []).map((item: any) => item.submitted_by).filter(Boolean))] as string[]
  const profileMap: Record<string, { display_name: string | null; username: string | null }> = {}
  if (userIds.length > 0) {
    const { data: profiles } = await admin
      .from('profiles')
      .select('id, display_name, username')
      .in('id', userIds)
    if (profiles) {
      for (const p of profiles) {
        profileMap[p.id] = { display_name: p.display_name, username: p.username }
      }
    }
  }

  // Fetch subcategory names
  const subcatIds = [...new Set((data ?? []).map((item: any) => item.subcategory_id).filter(Boolean))] as string[]
  const subcatMap: Record<string, string> = {}
  if (subcatIds.length > 0) {
    const { data: subcats } = await admin
      .from('subcategories')
      .select('id, name')
      .in('id', subcatIds)
    if (subcats) {
      for (const s of subcats) {
        subcatMap[s.id] = s.name
      }
    }
  }

  const enriched = (data ?? []).map((item: any) => ({
    ...item,
    submitted_by_username: item.submitted_by
      ? (profileMap[item.submitted_by]?.username ?? null)
      : null,
    subcategory_name: item.subcategory_id
      ? (subcatMap[item.subcategory_id] ?? null)
      : null,
  }))

  return json(enriched)
}

// deno-lint-ignore no-explicit-any
async function handleApprove(
  admin: any,
  body: Record<string, unknown>,
  actor: { id: string },
) {
  const id = typeof body.id === 'string' ? body.id : null
  if (!id) return json({ error: 'id is required' }, 400)

  // Fetch the submission
  const { data: item, error: fetchErr } = await admin
    .from('moderation_queue')
    .select('url, title, description, subcategory_id')
    .eq('id', id)
    .single()

  if (fetchErr || !item) return json({ error: 'Submission not found' }, 404)

  // Update status to approved
  const { error: updateErr } = await admin
    .from('moderation_queue')
    .update({
      status: 'approved',
      reviewed_by: actor.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (updateErr) return json({ error: updateErr.message }, 500)

  // Upsert into the live urls table so the URL enters the discovery pool
  const { error: upsertErr } = await admin
    .from('urls')
    .upsert(
      {
        url: item.url,
        original_url: item.url,
        approved: true,
        title: item.title,
        description: item.description,
        subcategory_id: item.subcategory_id,
      },
      { onConflict: 'url' },
    )

  if (upsertErr) {
    console.error('Failed to upsert into urls:', upsertErr)
    // Don't fail the request — the moderation state is already updated
  }

  return json({ ok: true, message: 'Approved' })
}

// deno-lint-ignore no-explicit-any
async function handleReject(
  admin: any,
  body: Record<string, unknown>,
  actor: { id: string },
) {
  const id = typeof body.id === 'string' ? body.id : null
  if (!id) return json({ error: 'id is required' }, 400)

  const { error } = await admin
    .from('moderation_queue')
    .update({
      status: 'rejected',
      reviewed_by: actor.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) return json({ error: error.message }, 500)

  return json({ ok: true, message: 'Rejected' })
}

// deno-lint-ignore no-explicit-any
async function handleStats(admin: any) {
  const { count: pending, error: pErr } = await admin
    .from('moderation_queue')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending')

  const { count: approved, error: aErr } = await admin
    .from('moderation_queue')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'approved')

  const { count: rejected, error: rErr } = await admin
    .from('moderation_queue')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'rejected')

  // Count distinct URLs with reports
  const { count: reports, error: repErr } = await admin
    .from('url_reports')
    .select('url_id', { count: 'exact', head: true })

  const { count: users, error: uErr } = await admin
    .from('profiles')
    .select('*', { count: 'exact', head: true })

  return json({
    pending: pending ?? 0,
    approved: approved ?? 0,
    rejected: rejected ?? 0,
    reports: reports ?? 0,
    users: users ?? 0,
  })
}

// deno-lint-ignore no-explicit-any
async function handleReports(admin: any) {
  const { data, error } = await admin
    .from('url_reports')
    .select('url_id, reported_at, url:urls(url, title, inactive)')
    .order('reported_at', { ascending: false })

  if (error) return json({ error: error.message }, 500)

  // Group by url_id with report count
  const grouped = new Map<string, {
    url_id: string
    url: string
    title: string | null
    inactive: boolean
    report_count: number
    reported_at: string
  }>()

  for (const row of (data ?? []) as any[]) {
    const urlData = Array.isArray(row.url) ? (row.url[0] ?? null) : row.url
    if (!row.url_id || !urlData) continue
    const existing = grouped.get(row.url_id)
    if (!existing) {
      grouped.set(row.url_id, {
        url_id: row.url_id,
        url: (urlData as any).url ?? '',
        title: (urlData as any).title ?? null,
        inactive: (urlData as any).inactive ?? false,
        report_count: 1,
        reported_at: row.reported_at,
      })
    } else {
      existing.report_count += 1
      if (row.reported_at > existing.reported_at) existing.reported_at = row.reported_at
    }
  }

  const result = [...grouped.values()].sort((a, b) => b.report_count - a.report_count)
  return json(result)
}

// deno-lint-ignore no-explicit-any
async function handleRestore(
  admin: any,
  body: Record<string, unknown>,
) {
  const urlId = typeof body.url_id === 'string' ? body.url_id : null
  if (!urlId) return json({ error: 'url_id is required' }, 400)

  const { error } = await admin
    .from('urls')
    .update({ inactive: false })
    .eq('id', urlId)

  if (error) return json({ error: error.message }, 500)

  return json({ ok: true, message: 'Link restored' })
}

function json(body: unknown, status = 200, responseHeaders?: Record<string, string>) {
  const h = responseHeaders ?? getCorsHeaders(null);
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...h, 'Content-Type': 'application/json' },
  })
}