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
  if (typeof name !== 'string') return { valid: false, error: 'name must be a string' }
  const trimmed = name.trim()
  if (trimmed.length === 0) return { valid: false, error: 'name cannot be empty' }
  if (trimmed.length > 200) return { valid: false, error: 'name max 200 characters' }
  return { valid: true }
}

function validateSlug(slug: string): { valid: boolean; error?: string } {
  if (typeof slug !== 'string') return { valid: false, error: 'slug must be a string' }
  if (slug.length === 0) return { valid: false, error: 'slug cannot be empty' }
  if (slug.length > 100) return { valid: false, error: 'slug max 100 characters' }
  if (!/^[a-z0-9-]+$/.test(slug)) {
    return { valid: false, error: 'slug must contain only lowercase letters, numbers, and hyphens' }
  }
  if (RESERVED_SLUGS.has(slug)) {
    return { valid: false, error: `"${slug}" is a reserved slug` }
  }
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
  try {
    body = await req.json()
  } catch (err) {
    console.error('[collection] Invalid JSON body:', err)
    return json({ error: 'Invalid JSON' }, 400)
  }
  console.log('[collection] request body:', JSON.stringify(body))

  const action = body.action as string

  switch (action) {
    // ── Create collection ───────────────────────────────────────────────────
    case 'create': {
      const { name, is_public } = body

      const nameValidation = validateName(name as string)
      if (!nameValidation.valid) return json({ error: nameValidation.error }, 400)

      // Derive slug server-side, prefixed with the first 8 characters of the user's UUID.
      // This namespaces slugs by user, preventing cross-user collisions on the global
      // UNIQUE constraint without requiring a schema change.
      const baseSlug = (name as string)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 52)
      const slug = `${baseSlug}-${user.id.slice(0, 8)}`

      const { data, error } = await supabase
        .from('collections')
        .insert({ user_id: user.id, name: name as string, slug, is_public: is_public !== false })
        .select()
        .single()
      if (error) {
        if (error.code === '23505') return json({ error: 'A collection with that name already exists' }, 409)
        return json({ error: error.message }, 500)
      }

      // Fire-and-forget XP + badge evaluation — create_collection XP + first-collection / curator badges.
      // Idempotency key prevents double-awarding XP on retried requests.
      const idemKey = `create_collection:${data.id}:${user.id}`
      supabase.rpc('award_xp', {
        p_user_id: user.id,
        p_action: 'create_collection',
        p_metadata: { collection_id: data.id },
        p_idempotency_key: idemKey,
      })
        .then(
          () => supabase.rpc('evaluate_badges', { p_user_id: user.id }),
          (e: unknown) => { console.error('xp award failed (collection-create)', e) }
        )
        .then(
          () => {},
          (e: unknown) => { console.error('badge evaluation failed (collection-create)', e) }
        )

      return json(data, 201)
    }

    // ── Update collection metadata ──────────────────────────────────────────
    case 'update': {
      const { id, name, slug, is_public } = body
      if (typeof id !== 'string') return json({ error: 'id is required' }, 400)

      const patch: Record<string, unknown> = {}
      
      if (name !== undefined) {
        const nameValidation = validateName(name as string)
        if (!nameValidation.valid) return json({ error: nameValidation.error }, 400)
        patch.name = name
      }
      
      if (slug !== undefined) {
        const slugValidation = validateSlug(slug as string)
        if (!slugValidation.valid) return json({ error: slugValidation.error }, 400)
        patch.slug = slug
      }
      
      if (typeof is_public === 'boolean') patch.is_public = is_public

      if (Object.keys(patch).length === 0) return json({ error: 'Nothing to update' }, 400)

      const { data, error } = await supabase
        .from('collections')
        .update(patch)
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single()
      if (error) {
        if (error.code === '23505') return json({ error: 'A collection with that slug already exists' }, 409)
        return json({ error: error.message }, 500)
      }
      if (!data) return json({ error: 'Collection not found' }, 404)
      return json(data)
    }

    // ── Delete collection ────────────────────────────────────────────────────
    case 'delete': {
      const { id } = body
      if (typeof id !== 'string') return json({ error: 'id is required' }, 400)
      const { error } = await supabase
        .from('collections')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id)
      if (error) return json({ error: error.message }, 500)
      return json({ ok: true })
    }

    // ── Add item to collection ───────────────────────────────────────────────
    case 'add_item': {
      const { collection_id, url_id } = body
      if (typeof collection_id !== 'string' || typeof url_id !== 'string') {
        return json({ error: 'collection_id and url_id are required' }, 400)
      }

      // Verify the collection belongs to the authenticated user
      const { data: col, error: colError } = await supabase
        .from('collections')
        .select('id')
        .eq('id', collection_id)
        .eq('user_id', user.id)
        .single()
      if (colError || !col) return json({ error: 'Collection not found' }, 404)

      // Enforce per-user 10K cap across all collections
      // Use RPC for efficient aggregation instead of multi-query
      const { data: countResult, error: countError } = await supabase
        .rpc('count_user_collection_items', { user_id: user.id })
      
      if (countError || countResult === null) {
        return json({ error: 'Failed to check collection limit' }, 500)
      }

      const itemCount = countResult

      if ((itemCount ?? 0) >= COLLECTION_ITEM_CAP) {
        return json(
          {
            error: `You have reached the limit of ${COLLECTION_ITEM_CAP.toLocaleString()} saved items across all your collections. Remove some items to continue.`,
          },
          422,
        )
      }

      const { error: insertError } = await supabase
        .from('collection_items')
        .insert({ collection_id, url_id })

      if (insertError) {
        if (insertError.code === '23505') return json({ error: 'This URL is already in the collection' }, 409)
        return json({ error: insertError.message }, 500)
      }

      // Fire-and-forget badge evaluation — pack-rat / public-curator badges.
      supabase.rpc('evaluate_badges', { p_user_id: user.id })
        .then(() => {}, (e: unknown) => { console.error('badge evaluation failed', e) })

      // Track challenge progress for collection_count
      const svcClient = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
        { auth: { persistSession: false } },
      )
      incrementChallengeProgress(svcClient, user.id, 'collection_count')
        .catch((e: unknown) => { console.error('challenge progress failed (collection)', e) })

      return json({ ok: true }, 201)
    }

    // ── Remove item from collection ──────────────────────────────────────────
    case 'remove_item': {
      const { collection_id, url_id } = body
      if (typeof collection_id !== 'string' || typeof url_id !== 'string') {
        return json({ error: 'collection_id and url_id are required' }, 400)
      }
      // RLS on collection_items DELETE enforces user owns the collection
      const { error } = await supabase
        .from('collection_items')
        .delete()
        .eq('collection_id', collection_id)
        .eq('url_id', url_id)
      if (error) return json({ error: error.message }, 500)
      return json({ ok: true })
    }

    default:
      return json({ error: `Unknown action: ${action ?? 'missing'}` }, 400)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
