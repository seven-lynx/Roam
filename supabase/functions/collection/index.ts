// POST /functions/v1/collection
// Handles collection CRUD and item management for the authenticated user.
//
// Actions:
//   create       — { action, name, slug, is_public? }
//   update       — { action, id, name?, slug?, is_public? }
//   delete       — { action, id }
//   add_item     — { action, collection_id, url_id }  enforces 10K cap
//   remove_item  — { action, collection_id, url_id }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { incrementChallengeProgress } from '../_shared/challenge-progress.ts'

const COLLECTION_ITEM_CAP = 10_000
const RESERVED_SLUGS = new Set(['join', 'admin', 'privacy', 'terms', 'u', 'c'])

function validateName(name: string): { valid: boolean; error?: string } {
  if (!name || name.trim().length === 0) return { valid: false, error: 'Name is required' }
  if (name.length > 100) return { valid: false, error: 'Name must be 100 characters or less' }
  return { valid: true }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } },
  )

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return json({ error: 'Unauthorized' }, 401)

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return json({ error: 'Invalid JSON' }, 400) }

  const action = body.action as string | undefined
  if (!action) return json({ error: 'action required' }, 400)

  // ── CREATE ────────────────────────────────────────────────────────────
  if (action === 'create') {
    const name = (body.name as string)?.trim() || ''
    const slug = (body.slug as string)?.trim().toLowerCase() || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'collection'
    const isPublic = body.is_public === true

    const nameCheck = validateName(name)
    if (!nameCheck.valid) return json({ error: nameCheck.error }, 400)
    if (RESERVED_SLUGS.has(slug)) return json({ error: 'This URL is reserved' }, 400)

    const { data, error } = await supabase
      .from('collections')
      .insert({ user_id: user.id, name, slug, is_public: isPublic })
      .select('*')
      .single()

    if (error) {
      if (error.message?.includes('duplicate') || error.message?.includes('unique')) {
        return json({ error: 'A collection with this name or URL already exists' }, 409)
      }
      return json({ error: error.message }, 500)
    }

    // Track collection creation in user_actions
    await supabase.from("user_actions").insert({
      user_id: user.id,
      action_type: "collection",
      metadata: { collection_id: data.id }
    })

    // Fire-and-forget: award XP for creating a collection
    EdgeRuntime.waitUntil(
      (async () => {
        try {
          const svcClient = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
            { auth: { persistSession: false } },
          )
          await svcClient.from('xp_log').insert({
            user_id: user.id,
            action: 'create_collection',
            xp_awarded: 5,
          })
          await supabase.functions.invoke('evaluate-badges', { body: { user_id: user.id } })
        } catch { /* best effort */ }
      })()
    )

    return json(data, 201)
  }

  // ── UPDATE ────────────────────────────────────────────────────────────
  if (action === 'update') {
    const id = body.id as string | undefined
    if (!id) return json({ error: 'id required' }, 400)

    const updates: Record<string, unknown> = {}
    if (body.name !== undefined) {
      const nameCheck = validateName((body.name as string) || '')
      if (!nameCheck.valid) return json({ error: nameCheck.error }, 400)
      updates.name = body.name
    }
    if (body.slug !== undefined) {
      const slug = (body.slug as string).toLowerCase()
      if (RESERVED_SLUGS.has(slug)) return json({ error: 'This URL is reserved' }, 400)
      updates.slug = slug
    }
    if (body.is_public !== undefined) updates.is_public = body.is_public

    const { data, error } = await supabase
      .from('collections')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)
      .select('*')
      .single()

    if (error) {
      if (error.message?.includes('duplicate') || error.message?.includes('unique')) {
        return json({ error: 'A collection with this name or URL already exists' }, 409)
      }
      return json({ error: error.message }, 500)
    }

    return json(data)
  }

  // ── DELETE ────────────────────────────────────────────────────────────
  if (action === 'delete') {
    const id = body.id as string | undefined
    if (!id) return json({ error: 'id required' }, 400)

    const { error } = await supabase
      .from('collections')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) return json({ error: error.message }, 500)
    return json({ success: true })
  }

  // ── ADD ITEM ──────────────────────────────────────────────────────────
  if (action === 'add_item') {
    const collectionId = body.collection_id as string | undefined
    const urlId = body.url_id as string | undefined
    if (!collectionId || !urlId) return json({ error: 'collection_id and url_id required' }, 400)

    // Check ownership
    const { data: col } = await supabase
      .from('collections')
      .select('id')
      .eq('id', collectionId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (!col) return json({ error: 'Collection not found' }, 404)

    // Enforce cap
    const { count } = await supabase
      .from('collection_items')
      .select('id', { count: 'exact', head: true })
      .eq('collection_id', collectionId)

    if (count && count >= COLLECTION_ITEM_CAP) {
      return json({ error: `Collection limit reached (${COLLECTION_ITEM_CAP} items)` }, 400)
    }

    const { error } = await supabase
      .from('collection_items')
      .upsert({ collection_id: collectionId, url_id: urlId }, { onConflict: 'collection_id,url_id' })

    if (error) return json({ error: error.message }, 500)

    // Track collection add_item for challenge progress
    EdgeRuntime.waitUntil(
      (async () => {
        try {
          const svcClient = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
            { auth: { persistSession: false } },
          )
          await incrementChallengeProgress(svcClient, user.id, 'collection_count')
        } catch (e) {
          console.error('challenge progress failed', e)
        }
      })()
    )

    return json({ success: true })
  }

  // ── REMOVE ITEM ───────────────────────────────────────────────────────
  if (action === 'remove_item') {
    const collectionId = body.collection_id as string | undefined
    const urlId = body.url_id as string | undefined
    if (!collectionId || !urlId) return json({ error: 'collection_id and url_id required' }, 400)

    const { error } = await supabase
      .from('collection_items')
      .delete()
      .eq('collection_id', collectionId)
      .eq('url_id', urlId)

    if (error) return json({ error: error.message }, 500)
    return json({ success: true })
  }

  return json({ error: 'Unknown action' }, 400)
})

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}