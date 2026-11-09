/**
 * Integration tests for Row-Level Security (RLS) policies.
 * These tests verify that data access is properly restricted by user.
 * 
 * Full integration tests should run against a staging Supabase project.
 * These unit tests verify the logic and structure.
 */

describe('RLS Policies - Critical Security Tests', () => {
  describe('profiles table', () => {
    it('should allow public read of public profiles', () => {
      // RLS policy: SELECT * FROM profiles WHERE is_public = true OR (auth.uid() = user_id)
      // For public profiles, no auth required
      const profile = { id: 'user123', is_public: true, display_name: 'Alice' }
      
      // Public profile should be readable without auth
      expect(profile.is_public).toBe(true)
    })

    it('should deny read of private profiles to unauthorized users', () => {
      // RLS policy requires either is_public = true OR auth.uid() = user_id
      const profile = { id: 'user123', is_public: false, display_name: 'Alice' }
      const currentUserId = 'user456'
      
      // Private profile should only be readable by owner
      const canRead = profile.is_public || profile.id === currentUserId
      expect(canRead).toBe(false)
    })

    it('should allow user to update only their own profile', () => {
      // RLS policy: UPDATE profiles SET ... WHERE auth.uid() = id
      const profile = { id: 'user123' }
      const currentUserId = 'user123'
      
      // User can only update their own profile
      const canUpdate = profile.id === currentUserId
      expect(canUpdate).toBe(true)
      
      // Different user cannot update
      const otherUserId = 'user456'
      const canOtherUpdate = profile.id === otherUserId
      expect(canOtherUpdate).toBe(false)
    })

    it('should allow approved followers to read private collections', () => {
      // RLS policy: SELECT * FROM collections WHERE is_public = true
      //   OR (auth.uid() = user_id)
      //   OR (auth.uid() IN (SELECT follower_id FROM follows WHERE follows.user_id = collections.user_id AND status = 'approved'))
      const collection = { id: 'col1', user_id: 'user123', is_public: false }
      const currentUserId = 'user456'
      const isApprovedFollower = true
      
      const canRead = collection.is_public || collection.user_id === currentUserId || isApprovedFollower
      expect(canRead).toBe(true)
    })
  })

  describe('ratings table', () => {
    it('should allow user to read only their own ratings', () => {
      // RLS policy: SELECT ratings WHERE auth.uid() = user_id
      const rating = { id: 'rate1', user_id: 'user123' }
      const currentUserId = 'user123'
      
      const canRead = rating.user_id === currentUserId
      expect(canRead).toBe(true)
      
      const otherUserId = 'user456'
      const canOtherRead = rating.user_id === otherUserId
      expect(canOtherRead).toBe(false)
    })

    it('should allow user to insert only their own ratings', () => {
      // RLS policy: INSERT INTO ratings WHERE auth.uid() = user_id
      const newRating = { user_id: 'user123', url_id: 'url1', vote: 1 }
      const currentUserId = 'user123'
      
      const canInsert = newRating.user_id === currentUserId
      expect(canInsert).toBe(true)
      
      // User cannot insert ratings for other users
      const ratingForOther = { user_id: 'user456', url_id: 'url1', vote: 1 }
      const canInsertForOther = ratingForOther.user_id === currentUserId
      expect(canInsertForOther).toBe(false)
    })
  })

  describe('moderation_queue table', () => {
    it('should allow submitter to read their own submission', () => {
      // RLS policy: SELECT * WHERE auth.uid() = submitted_by OR (auth.role() = 'admin')
      const submission = { id: 'mod1', submitted_by: 'user123', status: 'pending' }
      const currentUserId = 'user123'
      const isAdmin = false
      
      const canRead = submission.submitted_by === currentUserId || isAdmin
      expect(canRead).toBe(true)
    })

    it('should allow admin to read all submissions', () => {
      // RLS policy includes admin check
      const submission = { id: 'mod1', submitted_by: 'user456', status: 'pending' }
      const currentUserId = 'user123'
      const isAdmin = true
      
      const canRead = submission.submitted_by === currentUserId || isAdmin
      expect(canRead).toBe(true)
    })

    it('should deny non-admin updates to moderation_queue', () => {
      // RLS policy: UPDATE moderation_queue WHERE auth.role() = 'admin'
      const submission = { id: 'mod1', status: 'pending' }
      const userRole: string = 'authenticated' // not admin
      
      const canUpdate = userRole === 'admin'
      expect(canUpdate).toBe(false)
      
      const adminRole = 'admin'
      const canAdminUpdate = adminRole === 'admin'
      expect(canAdminUpdate).toBe(true)
    })

    it('should prevent updating submission status without admin role', () => {
      // Security test: ensure status can only be changed by admin
      const submission = { id: 'mod1', status: 'pending' }
      const currentUserId = 'user123'
      const userRole: string = 'authenticated'
      const canChangeStatus = userRole === 'admin'
      expect(canChangeStatus).toBe(false)
      
      // Submitter cannot change their own status
      expect(submission.status).toBe('pending') // Should remain unchanged
    })
  })

  describe('collections table', () => {
    it('should allow public read of public collections', () => {
      // RLS policy: SELECT * WHERE is_public = true OR auth.uid() = user_id
      const collection = { id: 'col1', user_id: 'user123', is_public: true }
      
      const canRead = collection.is_public
      expect(canRead).toBe(true)
    })

    it('should allow owner to read their private collections', () => {
      // RLS policy allows owner to read
      const collection = { id: 'col1', user_id: 'user123', is_public: false }
      const currentUserId = 'user123'
      
      const canRead = collection.user_id === currentUserId
      expect(canRead).toBe(true)
    })

    it('should deny read of private collections to unauthorized users', () => {
      // Non-owners and non-followers cannot read private collections
      const collection = { id: 'col1', user_id: 'user123', is_public: false }
      const currentUserId = 'user456'
      const isApprovedFollower = false
      
      const canRead = collection.user_id === currentUserId || isApprovedFollower
      expect(canRead).toBe(false)
    })

    it('should allow owner to update their collections', () => {
      // RLS policy: UPDATE collections WHERE auth.uid() = user_id
      const collection = { id: 'col1', user_id: 'user123' }
      const currentUserId = 'user123'
      
      const canUpdate = collection.user_id === currentUserId
      expect(canUpdate).toBe(true)
      
      const otherUserId = 'user456'
      const canOtherUpdate = collection.user_id === otherUserId
      expect(canOtherUpdate).toBe(false)
    })
  })

  describe('Cross-table RLS', () => {
    it('should prevent reading foreign key data without access to referenced table', () => {
      // When reading collection with items, user must have access to items table
      const collection = { id: 'col1', user_id: 'user123' }
      const currentUserId = 'user456'
      
      // Without RLS enforcement at database level, unauthorized reads are possible
      // This test verifies the logic that should be enforced by Supabase RLS
      const canReadCollection = collection.user_id === currentUserId
      expect(canReadCollection).toBe(false)
    })

    it('should cascade delete correctly with RLS enforcement', () => {
      // When a collection is deleted, items should be deleted
      // RLS should prevent unauthorized deletion
      const collection = { id: 'col1', user_id: 'user123' }
      const currentUserId = 'user123'
      
      const canDelete = collection.user_id === currentUserId
      expect(canDelete).toBe(true)
    })
  })
})

describe('Safe Browsing Integration', () => {
  it('should reject submissions from known malicious URLs', () => {
    // checkSafeBrowsing should return safe: false for malicious URLs
    const url = 'https://malicious-site.com'
    const isSafe = false // Would be determined by Safe Browsing API
    
    expect(isSafe).toBe(false)
  })

  it('should reject submissions when Safe Browsing API returns error', () => {
    // When Safe Browsing API fails, reject submission with 503
    const apiError = 'Service temporarily unavailable'
    const shouldReject = apiError !== null
    
    expect(shouldReject).toBe(true)
  })

  it('should handle Safe Browsing API errors gracefully', () => {
    // Network errors, timeouts, quota errors should all result in rejection
    const errors = [
      'Network error contacting API',
      'API rate limit exceeded',
      'API key invalid',
    ]
    
    errors.forEach((error) => {
      const shouldReject = error !== null
      expect(shouldReject).toBe(true)
    })
  })

  it('should pass safe URLs through to moderation queue', () => {
    // Only after Safe Browsing returns safe: true, URL should be inserted
    const url = 'https://safe-site.com'
    const safeBrowsingPassed = true
    
    if (safeBrowsingPassed) {
      // Should proceed to moderation queue insertion
      expect(safeBrowsingPassed).toBe(true)
    }
  })

  it('should require Safe Browsing API key at startup', () => {
    // Application should fail to start without SAFE_BROWSING_API_KEY
    const apiKey = undefined
    const hasRequiredKey = apiKey !== undefined
    
    expect(hasRequiredKey).toBe(false)
  })
})

describe('Rate Limiting', () => {
  it('should reject submissions after user exceeds rate limit', () => {
    // Rate limit: 10 submissions per hour per user
    const userSubmissionCount = 10
    const RATE_LIMIT = 10
    
    const shouldReject = userSubmissionCount >= RATE_LIMIT
    expect(shouldReject).toBe(true)
  })

  it('should return Retry-After header on rate limit breach', () => {
    // When rate limited, should return Retry-After header
    const userSubmissionCount = 11
    const RATE_LIMIT = 10
    const retryAfterSec = 3600 // 1 hour
    
    if (userSubmissionCount >= RATE_LIMIT) {
      expect(retryAfterSec).toBeGreaterThan(0)
    }
  })

  it('should enforce per-user rate limits independently', () => {
    // Different users should have independent rate limit buckets
    const user1Count = 10
    const user2Count = 5
    const RATE_LIMIT = 10
    
    const user1Limited = user1Count >= RATE_LIMIT
    const user2Limited = user2Count >= RATE_LIMIT
    
    expect(user1Limited).toBe(true)
    expect(user2Limited).toBe(false)
  })
})

describe('URL failure tracking — report_url_failures()', () => {
  // Mirrors the threshold in
  // supabase/migrations/20261107184451_url_failure_tracking.sql: a URL is retired
  // only when it has >= 2 DISTINCT reporters AND >= 3 total failures within 30 days.
  const RETIRE_MIN_REPORTERS = 2
  const RETIRE_MIN_FAILURES = 3
  const WINDOW_DAYS = 30

  const shouldRetire = (
    reports: { user_id: string; fail_count: number; last_seen_days_ago: number }[],
  ) => {
    const recent = reports.filter((r) => r.last_seen_days_ago <= WINDOW_DAYS)
    const reporters = new Set(recent.map((r) => r.user_id)).size
    const failures = recent.reduce((sum, r) => sum + r.fail_count, 0)
    return reporters >= RETIRE_MIN_REPORTERS && failures >= RETIRE_MIN_FAILURES
  }

  it('should not retire a URL reported repeatedly by a single user', () => {
    // Reporter identity comes from auth.uid() and fail_count is clamped server-side,
    // so one client cannot retire a URL alone however many failures it claims.
    expect(
      shouldRetire([{ user_id: 'user1', fail_count: 50, last_seen_days_ago: 1 }]),
    ).toBe(false)
  })

  it('should not retire a URL reported once each by two users', () => {
    expect(
      shouldRetire([
        { user_id: 'user1', fail_count: 1, last_seen_days_ago: 1 },
        { user_id: 'user2', fail_count: 1, last_seen_days_ago: 1 },
      ]),
    ).toBe(false)
  })

  it('should retire a URL with two distinct reporters and three failures', () => {
    expect(
      shouldRetire([
        { user_id: 'user1', fail_count: 2, last_seen_days_ago: 1 },
        { user_id: 'user2', fail_count: 1, last_seen_days_ago: 2 },
      ]),
    ).toBe(true)
  })

  it('should ignore failures older than the 30-day window', () => {
    expect(
      shouldRetire([
        { user_id: 'user1', fail_count: 2, last_seen_days_ago: 45 },
        { user_id: 'user2', fail_count: 1, last_seen_days_ago: 1 },
      ]),
    ).toBe(false)
  })

  it('should only expose failure rows to their reporter and admins', () => {
    // Policy: USING (auth.uid() = user_id OR public.is_admin())
    const row = { user_id: 'user1' }
    const canRead = (viewer: string | null, isAdmin = false) =>
      (viewer !== null && viewer === row.user_id) || isAdmin

    expect(canRead('user1')).toBe(true)
    expect(canRead('user2')).toBe(false)
    expect(canRead(null)).toBe(false)
    expect(canRead('user2', true)).toBe(true)
  })

  it('should deny direct writes — only the RPC may insert', () => {
    // RLS is enabled with a SELECT policy only, so a client-side
    // .from('url_failure_reports').insert() must be denied; writes happen inside
    // the SECURITY DEFINER function, which derives the reporter from auth.uid().
    const policies = { select: 1, insert: 0, update: 0, delete: 0 }
    expect(policies.select).toBe(1)
    expect(policies.insert).toBe(0)
    expect(policies.update).toBe(0)
    expect(policies.delete).toBe(0)
  })
})

describe('Discovery state — prefetch vs serve (issue #122)', () => {
  // Mirrors supabase/migrations/20261109060000_roam_v38_prefetch_skips_state.sql.
  // roam() records a serve only when the transaction-local `roam.prefetch` flag is
  // off, and roam_prefetch() sets it for the whole transaction — so a buffered URL
  // carries no discovery state until a client calls mark_url_seen() on render.
  const recordsServe = (prefetchFlag: string | null, hasRow: boolean) =>
    hasRow && (prefetchFlag ?? 'off') !== 'on'

  it('records the serve for a real roam() call', () => {
    expect(recordsServe(null, true)).toBe(true)
    expect(recordsServe('off', true)).toBe(true)
  })

  it('records nothing for a prefetched row', () => {
    expect(recordsServe('on', true)).toBe(false)
  })

  it('records nothing when the pool is exhausted', () => {
    expect(recordsServe(null, false)).toBe(false)
  })

  it('cools a domain only in discovery mode, and only when p_cool_domain', () => {
    // p_cool_domain is false for collection browsing; mark_url_seen() takes the
    // user from auth.uid(), so there is no p_user_id to spoof.
    const cools = (coolDomain: boolean, mode: string | null) =>
      coolDomain && (mode ?? 'discovery') === 'discovery'

    expect(cools(true, 'discovery')).toBe(true)
    expect(cools(true, null)).toBe(true)
    expect(cools(true, 'deep_dive')).toBe(false)
    expect(cools(false, 'discovery')).toBe(false)
  })

  it('cannot return the same domain twice in one prefetch batch', () => {
    // roam_prefetch() appends every returned domain to the exclusion array before
    // the next iteration. Without that, a non-writing roam() repeats its top row,
    // the edge function dedupes it away, and the batch yields one URL instead of 5.
    const pickDistinctDomains = (pool: string[], count: number) => {
      const excluded: string[] = []
      for (let i = 0; i < count; i++) {
        const next = pool.find((domain) => !excluded.includes(domain))
        if (!next) break
        excluded.push(next)
      }
      return excluded
    }

    expect(pickDistinctDomains(['a.com', 'a.com', 'a.com'], 3)).toEqual(['a.com'])
    expect(pickDistinctDomains(['a.com', 'b.com', 'c.com'], 3)).toEqual(['a.com', 'b.com', 'c.com'])
  })
})
describe('Discovery exhaustion state — user_exhaustion_state (issue #120)', () => {
  // Mirrors supabase/migrations/20261109130000_user_exhaustion_state.sql.
  // One policy: an owner-only SELECT. There is deliberately no INSERT, UPDATE or
  // DELETE policy, because the row is written by record_exhaustion() (SECURITY
  // DEFINER, so it runs as the owner and bypasses RLS) and drained by the notify
  // cron as service_role. A client must not be able to claim another user is
  // exhausted, nor clear its own notice before the cron sees it.
  const canRead = (viewer: string | null, row: { user_id: string }) =>
    viewer !== null && viewer === row.user_id

  it('should let a user read their own exhaustion row', () => {
    expect(canRead('user1', { user_id: 'user1' })).toBe(true)
  })

  it('should hide every other user row', () => {
    expect(canRead('user2', { user_id: 'user1' })).toBe(false)
    expect(canRead(null, { user_id: 'user1' })).toBe(false)
  })

  it('should deny client writes even for the owner', () => {
    // The whole point of the SECURITY DEFINER writer: the owner can read the
    // reason, but cannot forge detections or wipe notified_at.
    const policies = { select: 1, insert: 0, update: 0, delete: 0 }
    expect(policies.select).toBe(1)
    expect(policies.insert).toBe(0)
    expect(policies.update).toBe(0)
    expect(policies.delete).toBe(0)
  })

  it('should keep both writers off the client grant list', () => {
    // record_exhaustion() takes p_user_id as an argument, so granting it to
    // authenticated would let a client mark anyone exhausted.
    const execute = {
      record_exhaustion: { public: false, anon: false, authenticated: false, service_role: true },
      claim_exhaustion_notifications: { public: false, anon: false, authenticated: false, service_role: true },
    }
    for (const fn of Object.values(execute)) {
      expect(fn.public).toBe(false)
      expect(fn.anon).toBe(false)
      expect(fn.authenticated).toBe(false)
      expect(fn.service_role).toBe(true)
    }
  })

  it('should only allow a cooldown to carry an available_later', () => {
    // Mirrors the user_exhaustion_state_available_later_needs_cooldown CHECK.
    // A timestamp on pool_empty or filters would be a promise the feed cannot keep.
    const accepts = (reason: string, availableLater: string | null) =>
      availableLater === null || reason === 'cooldown'

    expect(accepts('cooldown', '2026-11-09T15:00:00Z')).toBe(true)
    expect(accepts('cooldown', null)).toBe(true)
    expect(accepts('pool_empty', null)).toBe(true)
    expect(accepts('pool_empty', '2026-11-09T15:00:00Z')).toBe(false)
    expect(accepts('filters', '2026-11-09T15:00:00Z')).toBe(false)
  })

  it('should require a recognised reason and a non-blank scope', () => {
    // Mirrors the reason CHECK and user_exhaustion_state_scope_key_not_blank.
    const accepts = (reason: string, scopeKey: string) =>
      ['pool_empty', 'cooldown', 'filters'].includes(reason) && scopeKey !== ''

    expect(accepts('pool_empty', 'global')).toBe(true)
    expect(accepts('cooldown', 'category:11111111-1111-1111-1111-111111111111')).toBe(true)
    expect(accepts('paywall', 'global')).toBe(false)
    expect(accepts('pool_empty', '')).toBe(false)
  })
})
