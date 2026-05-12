import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get user from auth header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const token = authHeader.replace('Bearer ', '')

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')

    if (!supabaseUrl || !supabaseKey) {
      return new Response(
        JSON.stringify({ error: 'Missing environment variables' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    })

    // Verify token and get user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const userId = user.id

    // Fetch all user data (RLS will enforce that user can only see their own data)
    const [
      { data: profile },
      { data: ratings },
      { data: collections },
      { data: follows }
    ] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).single(),
      supabase.from('ratings').select('url_id, rating, created_at').eq('user_id', userId),
      supabase
        .from('collections')
        .select(`
          id, name, description, is_public, created_at,
          collection_items(
            url_id, added_at,
            urls(original_url, title, category)
          )
        `)
        .eq('user_id', userId),
      supabase
        .from('follows')
        .select(`
          id,
          follower:follower_id(id, username),
          following:following_id(id, username),
          created_at
        `)
        .or(`follower_id.eq.${userId},following_id.eq.${userId}`)
    ])

    // Build the export data structure
    const exportData = {
      export_date: new Date().toISOString(),
      profile: profile || {},
      ratings: ratings || [],
      collections: collections || [],
      follows: follows || [],
      gdpr_notice: 'This is your personal data export from Roam. It includes your account information, ratings, collections, and social connections.'
    }

    // Return as JSON blob
    return new Response(
      JSON.stringify(exportData, null, 2),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="roam-data-export-${new Date().toISOString().split('T')[0]}.json"`
        }
      }
    )

  } catch (error) {
    console.error('Export user error:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
