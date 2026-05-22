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

    // Create Supabase client with service role to bypass RLS for deletion
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !supabaseKey) {
      return new Response(
        JSON.stringify({ error: 'Missing environment variables' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    // Verify token and get user ID
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const userId = user.id

    // Start transaction-like deletion: delete user data from all tables
    // Order matters due to foreign key constraints

    // 1. Delete follow relationships (both directions)
    await supabase
      .from('follows')
      .delete()
      .or(`follower_id.eq.${userId},following_id.eq.${userId}`)

    // 2. Delete collection items
    const { data: collections } = await supabase
      .from('collections')
      .select('id')
      .eq('user_id', userId)

    if (collections) {
      for (const collection of collections) {
        await supabase
          .from('collection_items')
          .delete()
          .eq('collection_id', collection.id)
      }
    }

    // 3. Delete collections
    await supabase
      .from('collections')
      .delete()
      .eq('user_id', userId)

    // 4. Delete ratings
    await supabase
      .from('ratings')
      .delete()
      .eq('user_id', userId)

    // 5. Delete muted domains
    await supabase
      .from('muted_domains')
      .delete()
      .eq('user_id', userId)

    // 6. Anonymize profile (don't delete, keep for historical record)
    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        display_name: 'Deleted user',
        bio: null,
        avatar_url: null,
        username: `deleted_${userId.substring(0, 8)}`
      })
      .eq('id', userId)

    if (profileError) {
      console.error('Profile anonymization error:', profileError)
      return new Response(
        JSON.stringify({ error: 'Failed to anonymize profile' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 7. Delete from auth (this will cascade delete the profile via RLS)
    const { error: deleteError } = await supabase.auth.admin.deleteUser(userId)

    if (deleteError) {
      console.error('Auth deletion error:', deleteError)
      return new Response(
        JSON.stringify({ error: 'Failed to delete account' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Account deleted successfully' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Delete user error:', error)
    return new Response(
      JSON.stringify({ error: (error as Error).message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
