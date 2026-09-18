// POST /functions/v1/share-url
// Body: { url_id: string, recipient_id: string }
// Shares a URL with another user via the share_events table.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

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

  const urlId = body.url_id as string | undefined
  const recipientId = body.recipient_id as string | undefined

  if (!urlId || !recipientId) return json({ error: 'url_id and recipient_id required' }, 400)

  // Verify the URL exists
  const { data: urlData } = await supabase
    .from('urls')
    .select('id')
    .eq('id', urlId)
    .maybeSingle()

  if (!urlData) return json({ error: 'URL not found' }, 404)

  // Record the share event
  const { error } = await supabase
    .from('share_events')
    .insert({
      sender_id: user.id,
      recipient_id: recipientId,
      url_id: urlId,
    })

  if (error) return json({ error: error.message }, 500)

  // Track share action in user_actions (triggers challenge progress)
  await supabase.from("user_actions").insert({
    user_id: user.id,
    action_type: "share",
    metadata: { url_id: urlId, recipient_id: recipientId }
  })

  return json({ success: true })
})

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}