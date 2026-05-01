// POST /functions/v1/roam
// Body (optional): { collection_id?: string }
// Calls the roam() RPC as the authenticated user and returns a single URL row.
// Returns 404 when the user's discovery pool is exhausted.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return json('ok', 200)
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } },
  )

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return json({ error: 'Unauthorized' }, 401)

  let body: { collection_id?: unknown; exclude_domain?: unknown } = {}
  try {
    const text = await req.text()
    if (text) body = JSON.parse(text)
  } catch {
    return json({ error: 'Invalid JSON' }, 400)
  }

  const collectionId = typeof body.collection_id === 'string' ? body.collection_id : null
  const excludeDomain = typeof body.exclude_domain === 'string' ? body.exclude_domain : null

  const { data, error } = await supabase.rpc('roam', {
    p_user_id: user.id,
    ...(collectionId ? { p_collection_id: collectionId } : {}),
    ...(excludeDomain ? { p_exclude_domain: excludeDomain } : {}),
  })

  if (error) {
    console.error('RPC error:', {
      message: error.message,
      code: error.code,
      details: (error as any).details,
      hint: (error as any).hint,
    })
    return json({ error: `RPC failed: ${error.message}` }, 500)
  }

  // roam() returns a table — data is an array; take the first row.
  console.log('RPC returned:', { data_type: typeof data, is_array: Array.isArray(data), length: Array.isArray(data) ? data.length : 'N/A' })
  const row = Array.isArray(data) ? data[0] : null
  if (!row) {
    console.log('No row found from RPC')
    return json({ error: 'No more URLs to discover' }, 404)
  }

  console.log('Returning URL:', { id: row.id, url: row.url })

  return json({
    id:            row.id,
    url:           row.url,
    title:         row.title,
    description:   row.description,
    og_image_url:  row.og_image_url,
    category_id:   row.subcategory_id,
    wilson_score:  row.wilson_score,
  })
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
