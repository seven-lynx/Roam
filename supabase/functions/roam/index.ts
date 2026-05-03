// POST /functions/v1/roam
// Body (optional): { collection_id?, exclude_domain?, category_id? }
// Returns a single URL row, or 404 when pool is exhausted.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }
  const supabase = createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } },
  )
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return json({ error: 'Unauthorized' }, 401)
  let body: Record<string, unknown> = {}
  try {
    const text = await req.text()
    if (text) body = JSON.parse(text)
  } catch {
    return json({ error: 'Invalid JSON' }, 400)
  }
  const collectionId  = typeof body.collection_id  === 'string' ? body.collection_id  : null
  const excludeDomain = typeof body.exclude_domain  === 'string' ? body.exclude_domain : null
  const categoryId    = typeof body.category_id     === 'string' ? body.category_id    : null
  const rpcParams: Record<string, unknown> = { p_user_id: user.id }
  if (collectionId)  rpcParams.p_collection_id  = collectionId
  if (excludeDomain) rpcParams.p_exclude_domain = excludeDomain
  if (categoryId)    rpcParams.p_category_id    = categoryId
  const { data, error } = await supabase.rpc('roam', rpcParams)
  if (error) {
    console.error('roam RPC error', error.code, error.message)
    return json({ error: 'Discovery failed. Please try again.' }, 500)
  }
  const row = Array.isArray(data) ? data[0] : null
  if (!row) {
    return json({ error: 'No more URLs to discover' }, 404)
  }
  return json({
    id:           row.id,
    url:          row.url,
    title:        row.title,
    description:  row.description,
    og_image_url: row.og_image_url,
    category_id:  row.category_id ?? row.subcategory_id ?? null,
    wilson_score: row.wilson_score,
  })
})
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}