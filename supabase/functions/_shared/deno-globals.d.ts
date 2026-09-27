// supabase/functions/_shared/deno-globals.d.ts
//
// Ambient declarations for runtime-only globals that Supabase exposes to edge
// functions but the Deno type definitions used by `deno check` in CI do not.
//
// Adding the declaration here makes it globally visible to every edge function
// without each file having to re-declare it. The original inline declaration
// lived in supabase/functions/roam/index.ts; that file now imports nothing
// from this file (ambient declarations are file-less).
//
// If Supabase ever adds `EdgeRuntime` to its public typings, delete this file
// and the inline declaration in roam/index.ts.

// Supabase exposes a non-standard `EdgeRuntime` global on edge function hosts.
// It allows a function to hand a Promise to the host runtime so it can keep
// working on background work after the response has been sent (Supabase docs:
// https://supabase.com/docs/guides/functions/background-tasks).
declare const EdgeRuntime: {
  waitUntil: (p: Promise<unknown>) => void;
};