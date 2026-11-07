// supabase/functions/_shared/deno-globals.d.ts
//
// Ambient declarations for runtime-only globals that Supabase exposes to edge
// functions but the Deno type definitions do not.
//
// `deno check` only includes files reachable from the entry module, so an
// ambient file nobody references is invisible: checking a single function used
// to fail with `TS2304: Cannot find name 'EdgeRuntime'` even though this file
// was sitting in the tree. The root `deno.json` wires it in for every run:
//
//   "compilerOptions": { "types": ["./supabase/functions/_shared/deno-globals.d.ts"] }
//
// Deno discovers that config by walking up from the working directory, so it
// applies from the repo root, from `supabase/`, and in CI. Do not drop the
// entry to "tidy" the config — that brings the single-file failure back.
//
// If Supabase ever adds `EdgeRuntime` to its public typings, delete this file
// and the `compilerOptions.types` entry in `deno.json`.

// Supabase exposes a non-standard `EdgeRuntime` global on edge function hosts.
// It allows a function to hand a Promise to the host runtime so it can keep
// working on background work after the response has been sent (Supabase docs:
// https://supabase.com/docs/guides/functions/background-tasks).
declare const EdgeRuntime: {
  waitUntil: (p: Promise<unknown>) => void;
};