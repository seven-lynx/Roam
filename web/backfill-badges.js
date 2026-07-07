const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  process.env.SUPABASE_URL || 'https://yrhckctwtdjowulfuaqc.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '',
);

(async () => {
  const { data: users, error } = await supabase.from('profiles').select('id, username');
  if (error) { console.error('Failed to fetch users:', error.message); process.exit(1); }
  console.log('Found ' + users.length + ' users. Evaluating badges...');
  let total = 0, ok = 0, fail = 0;
  for (const user of users) {
    try {
      const { data: badges, error: rpcError } = await supabase.rpc('evaluate_badges', { p_user_id: user.id });
      if (rpcError) { console.error('  FAIL ' + (user.username || user.id) + ': ' + rpcError.message); fail++; }
      else { const c = (badges || []).length; if (c > 0) { console.log('  ' + user.username + ': ' + c + ' badge(s)'); total += c; } ok++; }
    } catch (e) { console.error('  FAIL ' + (user.username || user.id) + ': ' + e.message); fail++; }
  }
  // Verify one user to check correctness
  const checkUserId = users[0].id;
  const { data: badges } = await supabase
    .from('user_badges')
    .select('badge_id, badges(slug,name,required_count,category), unlocked_at, progress_current')
    .eq('user_id', checkUserId)
    .not('unlocked_at', 'is', null)
    .order('unlocked_at', { ascending: false });
  console.log('\nSample check for', users[0].username + ':');
  for (const b of (badges || []).slice(0, 10)) {
    console.log('  ' + b.badges?.slug + ' (' + b.badges?.name + ') unlocked at', b.unlocked_at);
  }
  console.log('Done. ' + ok + ' ok, ' + fail + ' failed, ' + total + ' badges awarded.');
})();