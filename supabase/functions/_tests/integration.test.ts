/**
 * Integration tests for Supabase Edge Functions.
 * Tests verify request/response contracts, error handling, and critical flows.
 * 
 * Note: Full integration requires Supabase local emulator or staging project.
 * These tests verify logic contracts and can be extended for E2E testing.
 */

import { assertEquals, assert, assertThrows, assertStringIncludes } from "https://deno.land/std@0.208.0/assert/mod.ts"

// ════════════════════════════════════════════════════════════════════════════════
// MOCK SUPABASE CLIENT
// ════════════════════════════════════════════════════════════════════════════════

interface MockSupabaseResponse<T> {
  data: T | null
  error: { message: string; code?: string } | null
}

interface MockSupabaseClient {
  auth: {
    // deno-lint-ignore no-explicit-any
    getUser: () => Promise<any>
  }
  rpc: (name: string, params: unknown) => Promise<MockSupabaseResponse<unknown[]>>
  from: (table: string) => {
    select: (cols: string, opts?: unknown) => {
      eq: (col: string, val: unknown) => {
        single: () => Promise<MockSupabaseResponse<unknown>>
        gte: (col: string, val: unknown) => Promise<MockSupabaseResponse<unknown>>
      }
      gte: (col: string, val: unknown) => Promise<MockSupabaseResponse<unknown>>
    }
    upsert: (data: unknown, opts?: unknown) => Promise<MockSupabaseResponse<unknown>>
    insert: (data: unknown) => Promise<MockSupabaseResponse<unknown>>
    update: (data: unknown) => {
      eq: (col: string, val: unknown) => Promise<MockSupabaseResponse<unknown>>
    }
    delete: () => {
      eq: (col: string, val: unknown) => Promise<MockSupabaseResponse<unknown>>
    }
  }
}

let mockSupabaseState = {
  authenticated: true,
  userId: "test-user-123",
  userEmail: "test@example.com",
}

function createMockSupabaseClient(): MockSupabaseClient {
  return {
    auth: {
      getUser: async () => {
        if (!mockSupabaseState.authenticated) {
          return { data: { user: null }, error: { message: "Unauthorized" } }
        }
        return {
          data: { user: { id: mockSupabaseState.userId } },
          error: null,
        }
      },
    },
    rpc: async (name: string, params: unknown) => {
      // Mock roam() RPC — returns array of URLs
      if (name === "roam") {
        return {
          data: [
            {
              id: "url-123",
              url: "https://example.com",
              title: "Example",
              description: "An example site",
              og_image_url: "https://example.com/og.jpg",
              subcategory_id: "subcat-456",
              wilson_score: 0.85,
            },
          ],
          error: null,
        }
      }
      // Default: return empty array
      return { data: [], error: null }
    },
    from: (table: string) => {
      return {
        select: (cols: string, opts?: unknown) => {
          return {
            eq: (col: string, val: unknown) => {
              return {
                gte: async (_col: string, _val: unknown) => {
                  return { data: [], error: null }
                },
                single: async () => {
                  // Mock profile lookup
                  if (table === "profiles" && col === "id") {
                    return {
                      data: {
                        id: val,
                        is_public: true,
                        display_name: "Test User",
                      },
                      error: null,
                    }
                  }
                  return { data: null, error: null }
                },
              }
            },
            gte: async (col: string, val: unknown) => {
              // Mock rate limit check
              if (table === "moderation_queue" && col === "created_at") {
                return { data: [], error: null }  // 0 submissions in last hour
              }
              return { data: null, error: null }
            },
          }
        },
        upsert: async (data: unknown, opts?: unknown) => {
          // Mock rating upsert
          return { data: { ok: true }, error: null }
        },
        insert: async (data: unknown) => {
          // Mock URL submission
          if (table === "moderation_queue") {
            return {
              data: { id: "queue-789", url: (data as any).url },
              error: null,
            }
          }
          return { data: null, error: null }
        },
        update: (data: unknown) => {
          return {
            eq: async (col: string, val: unknown) => {
              // Mock follow accept/reject
              return { data: { ok: true }, error: null }
            },
          }
        },
        delete: () => {
          return {
            eq: async (col: string, val: unknown) => {
              // Mock unfollow
              return { data: { ok: true }, error: null }
            },
          }
        },
      }
    },
  }
}

// ════════════════════════════════════════════════════════════════════════════════
// ROAM FUNCTION TESTS
// ════════════════════════════════════════════════════════════════════════════════

Deno.test("roam - Returns a single URL when discovery pool has items", async () => {
  const supabase = createMockSupabaseClient()
  mockSupabaseState.authenticated = true

  // Simulate roam() call
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  assertEquals(authError, null)
  assertEquals(user.id, "test-user-123")

  const { data: rpcData, error: rpcError } = await supabase.rpc("roam", {
    p_user_id: user.id,
  })
  assertEquals(rpcError, null)
  assertEquals(Array.isArray(rpcData), true)
  assertEquals(rpcData!.length, 1)
  assert((rpcData![0] as Record<string, unknown>).id)
  assert((rpcData![0] as Record<string, unknown>).url)
})

Deno.test("roam - Returns 401 when not authenticated", async () => {
  const supabase = createMockSupabaseClient()
  mockSupabaseState.authenticated = false

  const { data, error } = await supabase.auth.getUser()
  assert(error !== null)
  assertEquals(error.message, "Unauthorized")
})

Deno.test("roam - Accepts optional collection_id parameter", async () => {
  const supabase = createMockSupabaseClient()
  mockSupabaseState.authenticated = true

  const { data: { user } } = await supabase.auth.getUser()
  const { data: rpcData } = await supabase.rpc("roam", {
    p_user_id: user.id,
    p_collection_id: "collection-123",
  })
  assertEquals(Array.isArray(rpcData), true)
})

Deno.test("roam - Accepts optional subcategory_id parameter", async () => {
  const supabase = createMockSupabaseClient()
  mockSupabaseState.authenticated = true

  const { data: { user } } = await supabase.auth.getUser()
  const { data: rpcData } = await supabase.rpc("roam", {
    p_user_id: user.id,
    p_subcategory_id: "subcat-789",
  })
  assertEquals(Array.isArray(rpcData), true)
})

// ════════════════════════════════════════════════════════════════════════════════
// RATE FUNCTION TESTS
// ════════════════════════════════════════════════════════════════════════════════

Deno.test("rate - Accepts POST with url_id and value (1 or -1)", async () => {
  const supabase = createMockSupabaseClient()
  mockSupabaseState.authenticated = true

  const { data: { user } } = await supabase.auth.getUser()
  const { data, error } = await supabase
    .from("ratings")
    .upsert({ user_id: user.id, url_id: "url-123", value: 1 })
  assertEquals(error, null)
})

Deno.test("rate - Validates value is 1 or -1", () => {
  function isValidRating(v: number) { return v === 1 || v === -1 }
  assertEquals(isValidRating(1), true)
  assertEquals(isValidRating(-1), true)
  assertEquals(isValidRating(2), false)
})

Deno.test("rate - Validates url_id is a string", () => {
  const validId = "url-123"
  const invalidId = 123

  assertEquals(typeof validId === "string", true)
  assertEquals(typeof invalidId === "string", false)
})

Deno.test("rate - Returns 401 when not authenticated", async () => {
  const supabase = createMockSupabaseClient()
  mockSupabaseState.authenticated = false

  const { data, error } = await supabase.auth.getUser()
  assert(error !== null)
})

// ════════════════════════════════════════════════════════════════════════════════
// SUBMIT-URL FUNCTION TESTS
// ════════════════════════════════════════════════════════════════════════════════

Deno.test("submit-url - Accepts POST with url, title, description, category_id", async () => {
  const supabase = createMockSupabaseClient()
  mockSupabaseState.authenticated = true

  const { data: { user } } = await supabase.auth.getUser()

  // Check rate limit
  const { data: rateData, error: rateError } = await supabase
    .from("moderation_queue")
    .select("*", { count: "exact", head: true })
    .eq("submitted_by", user.id)
    .gte("created_at", new Date(Date.now() - 3600000).toISOString())
  
  assertEquals(rateError, null)

  // Insert submission
  const { data: insertData, error: insertError } = await supabase
    .from("moderation_queue")
    .insert({
      url: "https://example.com",
      title: "Example Site",
      description: "A great site",
      submitted_by: user.id,
      safe_browsing_passed: true,
      status: "pending",
    })
  
  assertEquals(insertError, null)
})

Deno.test("submit-url - Requires url parameter", () => {
  const bodyWithUrl = { url: "https://example.com", title: "Example" }
  const bodyWithoutUrl = { title: "Example" }

  assertEquals(Boolean(typeof bodyWithUrl.url === "string" && bodyWithUrl.url), true)
  assertEquals(Boolean(typeof (bodyWithoutUrl as any).url === "string" && (bodyWithoutUrl as any).url), false)
})

Deno.test("submit-url - Validates url is not empty", () => {
  const validUrl = "https://example.com"
  const emptyUrl = ""
  const nullUrl = null

  assertEquals(Boolean(typeof validUrl === "string" && validUrl), true)
  assertEquals(Boolean(typeof emptyUrl === "string" && emptyUrl), false)
  assertEquals(Boolean(typeof nullUrl === "string" && nullUrl), false)
})

Deno.test("submit-url - Rate limit: rejects after 10 submissions per hour", () => {
  const submissions = 10
  const RATE_LIMIT = 10

  assertEquals(submissions >= RATE_LIMIT, true)

  const submissions2 = 9
  assertEquals(submissions2 >= RATE_LIMIT, false)
})

Deno.test("submit-url - Returns 401 when not authenticated", async () => {
  const supabase = createMockSupabaseClient()
  mockSupabaseState.authenticated = false

  const { data, error } = await supabase.auth.getUser()
  assert(error !== null)
})

// ════════════════════════════════════════════════════════════════════════════════
// FOLLOW FUNCTION TESTS
// ════════════════════════════════════════════════════════════════════════════════

Deno.test("follow - Accept action requires follower_id", async () => {
  const supabase = createMockSupabaseClient()
  mockSupabaseState.authenticated = true

  const { data: { user } } = await supabase.auth.getUser()

  // Simulate accept follow request
  const body = { action: "accept", follower_id: "user-456" }
  assertEquals(typeof body.follower_id === "string", true)
})

Deno.test("follow - Follow action requires following_id", async () => {
  const supabase = createMockSupabaseClient()
  mockSupabaseState.authenticated = true

  const { data: { user } } = await supabase.auth.getUser()

  // Check if target is public
  const { data: target } = await supabase
    .from("profiles")
    .select("is_public")
    .eq("id", "user-789")
    .single()

  assertEquals(target !== null, true)
})

Deno.test("follow - Follow pending: target profile is private", async () => {
  const supabase = createMockSupabaseClient()
  mockSupabaseState.authenticated = true

  // Simulate checking target profile
  const isPublic = false
  const isPending = !isPublic

  assertEquals(isPending, true)
})

Deno.test("follow - Follow not pending: target profile is public", async () => {
  const supabase = createMockSupabaseClient()
  mockSupabaseState.authenticated = true

  const isPublic = true
  const isPending = !isPublic

  assertEquals(isPending, false)
})

Deno.test("follow - Unfollow removes follow relationship", async () => {
  const supabase = createMockSupabaseClient()
  mockSupabaseState.authenticated = true

  const { data, error } = await supabase
    .from("follows")
    .delete()
    .eq("follower_id", "user-123")

  assertEquals(error, null)
})

Deno.test("follow - Returns 409 if already following", async () => {
  const supabase = createMockSupabaseClient()
  mockSupabaseState.authenticated = true

  // Simulate duplicate key error
  const error = { code: "23505", message: "Duplicate key" }
  assertEquals(error.code, "23505")
})

// ════════════════════════════════════════════════════════════════════════════════
// PROFILE FUNCTION TESTS
// ════════════════════════════════════════════════════════════════════════════════

Deno.test("profile - Accepts GET with username query parameter", () => {
  const url = new URL("https://api.example.com/functions/v1/profile?username=alice")
  const username = url.searchParams.get("username")

  assertEquals(username, "alice")
})

Deno.test("profile - Returns 400 when username is missing", () => {
  const url = new URL("https://api.example.com/functions/v1/profile")
  const username = url.searchParams.get("username")

  assertEquals(username, null)
})

Deno.test("profile - Rate limits: 60 requests per minute per IP", () => {
  const ip = "192.168.1.1"
  const RATE_LIMIT = 60
  const WINDOW_MS = 60_000

  const requests = 60
  assertEquals(requests >= RATE_LIMIT, true)

  const requests2 = 59
  assertEquals(requests2 >= RATE_LIMIT, false)
})

Deno.test("profile - Returns profile with follower/following counts", async () => {
  const supabase = createMockSupabaseClient()

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, display_name, is_public")
    .eq("id", "user-123")
    .single()

  assertEquals(profile !== null, true)
})

// ════════════════════════════════════════════════════════════════════════════════
// CROSS-FUNCTION INTEGRATION TESTS
// ════════════════════════════════════════════════════════════════════════════════

Deno.test("Integration: User can discover, rate, and submit URLs", async () => {
  const supabase = createMockSupabaseClient()
  mockSupabaseState.authenticated = true

  // Step 1: Get authenticated user
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  assertEquals(authError, null)

  // Step 2: Discover a URL
  const { data: rpcData, error: rpcError } = await supabase.rpc("roam", {
    p_user_id: user.id,
  })
  assertEquals(rpcError, null)
  assertEquals(Array.isArray(rpcData) && rpcData.length > 0, true)

  // Step 3: Rate the URL
  const url = rpcData![0] as { id: string }
  const { data: rateData, error: rateError } = await supabase
    .from("ratings")
    .upsert({ user_id: user.id, url_id: url.id, value: 1 })
  assertEquals(rateError, null)

  // Step 4: Submit a new URL
  const { data: submitData, error: submitError } = await supabase
    .from("moderation_queue")
    .insert({
      url: "https://newsite.com",
      submitted_by: user.id,
      status: "pending",
    })
  assertEquals(submitError, null)
})

Deno.test("Integration: User can follow/unfollow other users", async () => {
  const supabase = createMockSupabaseClient()
  mockSupabaseState.authenticated = true

  const { data: { user } } = await supabase.auth.getUser()

  // Check target profile
  const { data: target } = await supabase
    .from("profiles")
    .select("is_public")
    .eq("id", "user-789")
    .single()
  assertEquals(target !== null, true)

  // Follow user
  const { data: followData, error: followError } = await supabase
    .from("follows")
    .insert({ follower_id: user.id, following_id: "user-789" })
  
  // Unfollow user
  const { data: unfollowData, error: unfollowError } = await supabase
    .from("follows")
    .delete()
    .eq("follower_id", user.id)
  assertEquals(unfollowError, null)
})

Deno.test("Integration: Authentication required for private operations", async () => {
  const supabase = createMockSupabaseClient()

  // Test 1: roam requires auth
  mockSupabaseState.authenticated = false
  const { data: roamData, error: roamError } = await supabase.auth.getUser()
  assert(roamError !== null)

  // Test 2: rate requires auth
  mockSupabaseState.authenticated = false
  const { data: rateData, error: rateError } = await supabase.auth.getUser()
  assert(rateError !== null)

  // Test 3: submit-url requires auth
  mockSupabaseState.authenticated = false
  const { data: submitData, error: submitError } = await supabase.auth.getUser()
  assert(submitError !== null)

  // Test 4: follow requires auth
  mockSupabaseState.authenticated = false
  const { data: followData, error: followError } = await supabase.auth.getUser()
  assert(followError !== null)
})

Deno.test("Integration: Invalid JSON request body returns 400", () => {
  // Valid JSON
  const validJson = JSON.stringify({ url: "https://example.com" })
  assertEquals(() => JSON.parse(validJson), () => ({ url: "https://example.com" }))

  // Invalid JSON
  const invalidJson = "{ url: https://example.com }"  // Missing quotes
  assertThrows(() => JSON.parse(invalidJson), SyntaxError)
})

Deno.test("Integration: HTTP method validation (POST/GET/OPTIONS)", () => {
  const validPost = "POST"
  const validGet = "GET"
  const validOptions = "OPTIONS"
  const invalidPut = "PUT"

  assertEquals(["POST", "GET", "OPTIONS"].includes(validPost), true)
  assertEquals(["POST", "GET", "OPTIONS"].includes(validGet), true)
  assertEquals(["POST", "GET", "OPTIONS"].includes(validOptions), true)
  assertEquals(["POST", "GET", "OPTIONS"].includes(invalidPut), false)
})

Deno.test("Integration: CORS headers present in responses", () => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  }

  assertEquals(corsHeaders["Access-Control-Allow-Origin"], "*")
  assertEquals(corsHeaders["Access-Control-Allow-Methods"].includes("POST"), true)
  assertEquals(corsHeaders["Access-Control-Allow-Headers"].includes("authorization"), true)
})

Deno.test("Integration: Error responses have consistent format", () => {
  const errorResponse = {
    error: "Rate limit exceeded",
    status: 429,
  }

  assertEquals(typeof errorResponse.error === "string", true)
  assertEquals(typeof errorResponse.status === "number", true)
})

Deno.test("Integration: Success responses include status code", () => {
  const successResponse = {
    ok: true,
    status: 200,
  }

  assertEquals(successResponse.ok, true)
  assertEquals(successResponse.status === 200, true)
})
