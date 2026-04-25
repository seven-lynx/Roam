"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// ── Seed data matches the migration ──────────────────────────────────────────
const CATEGORIES = [
  { id: "c1000000-0000-0000-0000-000000000001", label: "Science & Nature", emoji: "🔬" },
  { id: "c1000000-0000-0000-0000-000000000002", label: "Technology", emoji: "💻" },
  { id: "c1000000-0000-0000-0000-000000000003", label: "Arts & Culture", emoji: "🎨" },
  { id: "c1000000-0000-0000-0000-000000000004", label: "History & Ideas", emoji: "📜" },
  { id: "c1000000-0000-0000-0000-000000000005", label: "Games & Hobbies", emoji: "🎮" },
  { id: "c1000000-0000-0000-0000-000000000006", label: "Weird & Wonderful", emoji: "🌀" },
  { id: "c1000000-0000-0000-0000-000000000007", label: "People & Places", emoji: "🌍" },
  { id: "c1000000-0000-0000-0000-000000000008", label: "Mind & Body", emoji: "🧠" },
];

type Step = "account" | "categories" | "done";

export default function JoinPage() {
  const router = useRouter();
  const supabase = createClient();

  const [step, setStep] = useState<Step>("account");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Check session on mount (handles OAuth redirect)
  useEffect(() => {
    async function checkSession() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        console.log('[roam] session found on mount, checking if user needs to pick categories');
        // Check for OAuth code in URL (means we just came back from OAuth)
        const hasOAuthCode = new URLSearchParams(location.search).has('code');
        if (hasOAuthCode) {
          console.log('[roam] OAuth code detected, advancing to categories');
          setStep("categories");
        }
        // Otherwise, stay on account page — user can proceed with email/password or sign out
      }
    }
    checkSession();
  }, []);

  // ── Step 1: create account ────────────────────────────────────────────────
  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.signUp({ email, password });
    setLoading(false);
    if (error) { setError(error.message); return; }
    setStep("categories");
  }

  async function handleGoogleSignUp() {
    setError(null);
    setLoading(true);
    try {
      console.log('[roam] starting Google OAuth with redirectTo:', `${location.origin}/join`);
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${location.origin}/join` },
      });
      console.log('[roam] OAuth response:', { data, error });
      if (error) {
        setError(error.message);
        setLoading(false);
      }
    } catch (err) {
      console.error('[roam] OAuth error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      setLoading(false);
    }
  }

  // ── Step 2: save category preferences ────────────────────────────────────
  function toggleCategory(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function handleCategories(e: React.FormEvent) {
    e.preventDefault();
    if (selected.size === 0) { setError("Pick at least one category."); return; }
    setError(null);
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError("Session expired — please sign up again."); setLoading(false); return; }

    // First, delete any existing category preferences for this user
    const { error: deleteError } = await supabase
      .from("user_categories")
      .delete()
      .eq("user_id", user.id);
    
    if (deleteError) { setError(deleteError.message); setLoading(false); return; }

    // Then insert the newly selected categories
    const rows = Array.from(selected).map((category_id) => ({
      user_id: user.id,
      category_id,
    }));

    const { error: insertError } = await supabase.from("user_categories").insert(rows);
    setLoading(false);
    if (insertError) { setError(insertError.message); return; }
    setStep("done");
  }

  // ── Step 3: done ─────────────────────────────────────────────────────────
  if (step === "done") {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center bg-white dark:bg-zinc-950">
        <div className="flex flex-col items-center gap-6 max-w-sm">
          <span className="text-5xl">🧭</span>
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">You&apos;re all set!</h1>
          <p className="text-zinc-500 dark:text-zinc-400">
            Download the browser extension or app to start roaming. You can also
            update your preferences any time from your profile.
          </p>
          <button
            onClick={() => router.push("/")}
            className="mt-2 rounded-full bg-zinc-900 dark:bg-white px-8 py-3 text-white dark:text-zinc-900 font-semibold hover:opacity-90 transition-opacity"
          >
            Back to home
          </button>
        </div>
      </main>
    );
  }

  // ── Step 2: category picker ───────────────────────────────────────────────
  if (step === "categories") {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center px-6 py-16 bg-white dark:bg-zinc-950">
        <form onSubmit={handleCategories} className="w-full max-w-lg flex flex-col gap-8">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">What are you into?</h1>
            <p className="mt-2 text-zinc-500 dark:text-zinc-400">Pick at least one — you can change this later.</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {CATEGORIES.map((cat) => {
              const active = selected.has(cat.id);
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => toggleCategory(cat.id)}
                  className={`flex flex-col items-center gap-1 rounded-xl border-2 px-4 py-3 text-sm font-medium transition-colors ${
                    active
                      ? "border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-zinc-900"
                      : "border-zinc-200 text-zinc-700 hover:border-zinc-400 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-zinc-500"
                  }`}
                >
                  {cat.emoji}
                  {cat.label}
                </button>
              );
            })}
          </div>

          {error && <p className="text-sm text-red-500 text-center">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="rounded-full bg-zinc-900 dark:bg-white px-8 py-3 text-white dark:text-zinc-900 font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {loading ? "Saving…" : "Continue →"}
          </button>
        </form>
      </main>
    );
  }

  // ── Step 1: account creation ──────────────────────────────────────────────
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 bg-white dark:bg-zinc-950">
      <div className="w-full max-w-sm flex flex-col gap-8">
        <div className="text-center">
          <span className="text-4xl">🧭</span>
          <h1 className="mt-3 text-3xl font-bold text-zinc-900 dark:text-white">Create your account</h1>
          <p className="mt-2 text-zinc-500 dark:text-zinc-400">Free, forever.</p>
        </div>

        {/* Google */}
        <button
          onClick={handleGoogleSignUp}
          className="flex items-center justify-center gap-3 rounded-full border border-zinc-300 dark:border-zinc-700 px-6 py-3 text-zinc-800 dark:text-zinc-200 font-medium hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Continue with Google
        </button>

        <div className="flex items-center gap-4">
          <hr className="flex-1 border-zinc-200 dark:border-zinc-800" />
          <span className="text-xs text-zinc-400">or</span>
          <hr className="flex-1 border-zinc-200 dark:border-zinc-800" />
        </div>

        {/* Email / password */}
        <form onSubmit={handleSignUp} className="flex flex-col gap-4">
          <input
            type="email"
            required
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 py-3 text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white"
          />
          <input
            type="password"
            required
            minLength={8}
            placeholder="Password (min 8 characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 py-3 text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white"
          />
          {error && <p className="text-sm text-red-500">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="rounded-full bg-zinc-900 dark:bg-white px-8 py-3 text-white dark:text-zinc-900 font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {loading ? "Creating account…" : "Create account"}
          </button>
        </form>
      </div>
    </main>
  );
}
