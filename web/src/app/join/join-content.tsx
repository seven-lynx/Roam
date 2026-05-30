"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import * as Sentry from "@sentry/nextjs";
import { createClient } from "@/lib/supabase/client";
import { validateEmail, validatePassword, validatePasswordsMatch, getPasswordStrengthColor, getPasswordStrengthLabel } from "@/lib/validation";
import { InterestPicker } from "@/components/InterestPicker";
import { saveUserInterests, type InterestMode } from "@/lib/interests";
import type { Subcategory } from "@/components/InterestPicker";

type CategoryItem = { id: string; label: string; emoji: string };

const FALLBACK_CATEGORIES: CategoryItem[] = [
  { id: "c1000000-0000-0000-0000-000000000001", label: "Science & Nature", emoji: "🔬" },
  { id: "c1000000-0000-0000-0000-000000000002", label: "Technology", emoji: "💻" },
  { id: "c1000000-0000-0000-0000-000000000003", label: "Arts & Culture", emoji: "🎨" },
  { id: "c1000000-0000-0000-0000-000000000004", label: "History & Ideas", emoji: "📜" },
  { id: "c1000000-0000-0000-0000-000000000005", label: "Games & Hobbies", emoji: "🎮" },
  { id: "c1000000-0000-0000-0000-000000000006", label: "Weird & Wonderful", emoji: "🌀" },
  { id: "c1000000-0000-0000-0000-000000000007", label: "People & Places", emoji: "🌍" },
  { id: "c1000000-0000-0000-0000-000000000008", label: "Mind & Body", emoji: "🧠" },
];

export default function JoinPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isAndroid = searchParams.get("platform") === "android";
  const initialMode = searchParams.get("mode") === "signin" ? "signin" : "create";
  const jumpToCategories = searchParams.get("step") === "categories";
  const supabase = createClient();

  const [mode, setMode] = useState<"create" | "signin">(initialMode);
  const [showCategories, setShowCategories] = useState(jumpToCategories);

  // Account form state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [passwordStrength, setPasswordStrength] = useState<"weak" | "fair" | "good" | "strong">("weak");

  // Category / interest state
  const [categories, setCategories] = useState<CategoryItem[]>(FALLBACK_CATEGORIES);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [interestMode, setInterestMode] = useState<InterestMode>('pillars');
  const [selectedPillars, setSelectedPillars] = useState<Set<string>>(new Set());
  const [selectedTopics, setSelectedTopics] = useState<Set<string>>(new Set());

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Fetch categories + subcategories from DB
  useEffect(() => {
    (async () => {
      try {
        const [catsRes, subcatsRes] = await Promise.all([
          supabase.from("categories").select("id, name, icon, sort_order").order("sort_order"),
          supabase.from("subcategories").select("id, name, category_id, sort_order").order("sort_order"),
        ]);
        if (catsRes.data && catsRes.data.length > 0) {
          setCategories(catsRes.data.map((c) => ({ id: c.id, label: c.name, emoji: c.icon })));
        }
        if (subcatsRes.data && subcatsRes.data.length > 0) {
          setSubcategories(subcatsRes.data.map((s) => ({ id: s.id, name: s.name, category_id: s.category_id })));
        }
      } catch {
        // keep fallback
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync mode to URL without full navigation
  function switchMode(next: "create" | "signin") {
    setMode(next);
    setError(null);
    const params = new URLSearchParams(searchParams.toString());
    if (next === "signin") { params.set("mode", "signin"); } else { params.delete("mode"); }
    router.replace(`/join?${params.toString()}`, { scroll: false });
  }

  // ── Validation helpers ────────────────────────────────────────────────────
  function handleEmailChange(value: string) {
    setEmail(value);
    setEmailError(value ? (validateEmail(value).error ?? null) : null);
  }

  function handlePasswordChange(value: string) {
    setPassword(value);
    if (!value) { setPasswordError(null); setPasswordStrength("weak"); return; }
    const v = validatePassword(value);
    setPasswordError(v.error ?? null);
    setPasswordStrength(v.strength);
    if (confirmPassword) setConfirmError(validatePasswordsMatch(value, confirmPassword).error ?? null);
  }

  function handleConfirmChange(value: string) {
    setConfirmPassword(value);
    setConfirmError(value ? (validatePasswordsMatch(password, value).error ?? null) : null);
  }

  const createFormValid =
    email && password && confirmPassword &&
    !emailError && !passwordError && !confirmError &&
    passwordStrength !== "weak" && agreedToTerms;

  const signinFormValid = email && password && !emailError;

  // ── OAuth ─────────────────────────────────────────────────────────────────
  async function handleOAuth(provider: "google" | "github") {
    setError(null);
    setLoading(true);
    try {
      const redirectTo = isAndroid
        ? `${location.origin}/join?platform=android`
        : `${location.origin}/auth/callback`;
      const { error: err } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo, skipBrowserRedirect: false },
      });
      if (err) {
        setError(err.message);
        setLoading(false);
      }
    } catch (err) {
      Sentry.captureException(err, { tags: { context: `${provider}-oauth` } });
      setError(err instanceof Error ? err.message : "Sign-in failed — please try again.");
      setLoading(false);
    }
  }

  // ── Email sign-up ─────────────────────────────────────────────────────────
  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { data, error: err } = await supabase.auth.signUp({ email, password });
      if (err) { setError(err.message); return; }

      // If Supabase requires email confirmation, session will be null
      if (!data.session) {
        router.push(`/auth/verify-email?email=${encodeURIComponent(email)}`);
        return;
      }

      setShowCategories(true);
    } catch (err) {
      Sentry.captureException(err, { tags: { context: "email-signup" } });
      setError(err instanceof Error ? err.message : "Sign-up failed");
    } finally {
      setLoading(false);
    }
  }

  // ── Email sign-in ─────────────────────────────────────────────────────────
  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { error: err } = await supabase.auth.signInWithPassword({ email, password });
      if (err) { setError(err.message); return; }
      // Invalidate the RSC cache so the server re-reads the fresh session cookie.
      router.refresh();
      router.replace("/profile");
    } catch (err) {
      Sentry.captureException(err, { tags: { context: "email-signin" } });
      setError(err instanceof Error ? err.message : "Sign-in failed");
    } finally {
      setLoading(false);
    }
  }

  // ── Interest helpers ──────────────────────────────────────────────────────
  function handlePillarToggle(id: string) {
    setSelectedPillars((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  }

  function handleTopicToggle(id: string) {
    setSelectedTopics((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  }

  function handleModeChange(next: InterestMode) {
    setInterestMode(next);
    if (next === 'topics') setSelectedPillars(new Set());
    else setSelectedTopics(new Set());
  }

  const hasSelection =
    (interestMode === 'pillars' && selectedPillars.size > 0) ||
    (interestMode === 'topics' && selectedTopics.size > 0);

  async function handleCategories(e: React.FormEvent) {
    e.preventDefault();
    if (!hasSelection) { setError("Pick at least one interest."); return; }
    setError(null);
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setError("Not signed in — please refresh and try again."); setLoading(false); return; }

      const subcategoryParentMap = new Map(subcategories.map((s) => [s.id, s.category_id]));
      await saveUserInterests(supabase, user.id, interestMode, selectedPillars, selectedTopics, subcategoryParentMap);

      if (isAndroid) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            const fragment = new URLSearchParams({
              access_token: session.access_token,
              refresh_token: session.refresh_token ?? "",
              token_type: "bearer",
              type: "signup",
              expires_in: String(session.expires_in ?? 3600),
            });
            window.location.href = `app.roam.android://callback#${fragment.toString()}`;
            return;
          }
        } catch (err) {
          Sentry.captureException(err, { tags: { context: "android-deeplink" } });
        }
      }

      router.refresh();
      router.replace("/profile");
    } catch (err) {
      Sentry.captureException(err, { tags: { context: "category-selection" } });
      setError(err instanceof Error ? err.message : "Something went wrong — please try again.");
      setLoading(false);
    }
  }

  // ── Category picker ───────────────────────────────────────────────────────
  if (showCategories) {
    return (
      <div className="flex min-h-[calc(100vh-8rem)] flex-col items-center justify-center px-6 py-16 bg-white dark:bg-zinc-950">
        <form onSubmit={handleCategories} className="w-full max-w-lg flex flex-col gap-8">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">What are you into?</h1>
            <p className="mt-2 text-zinc-500 dark:text-zinc-400">Pick at least one — you can change this later.</p>
          </div>

          <InterestPicker
            categories={categories}
            subcategories={subcategories}
            mode={interestMode}
            selectedPillars={selectedPillars}
            selectedTopics={selectedTopics}
            onPillarToggle={handlePillarToggle}
            onTopicToggle={handleTopicToggle}
            onModeChange={handleModeChange}
          />

          {error && <p className="text-sm text-red-500 text-center">{error}</p>}

          <button
            type="submit"
            disabled={loading || !hasSelection}
            className="rounded-full bg-zinc-900 dark:bg-white px-8 py-3 text-white dark:text-zinc-900 font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {loading ? "Saving…" : "Start exploring →"}
          </button>
        </form>
      </div>
    );
  }

  // ── Account form ──────────────────────────────────────────────────────────
  const oauthButtons = (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={() => handleOAuth("google")}
        disabled={loading}
        className="flex items-center justify-center gap-3 rounded-lg border border-zinc-300 dark:border-zinc-700 px-6 py-2.5 text-sm text-zinc-800 dark:text-zinc-200 font-medium hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors disabled:opacity-50"
      >
        <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        Continue with Google
      </button>
      <button
        type="button"
        onClick={() => handleOAuth("github")}
        disabled={loading}
        className="flex items-center justify-center gap-3 rounded-lg border border-zinc-300 dark:border-zinc-700 px-6 py-2.5 text-sm text-zinc-800 dark:text-zinc-200 font-medium hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors disabled:opacity-50"
      >
        <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
          <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>
        </svg>
        Continue with GitHub
      </button>
    </div>
  );

  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col items-center justify-center px-6 py-16 bg-white dark:bg-zinc-950">
      <div className="w-full max-w-sm flex flex-col gap-6">
        <div className="text-center">
          <Image src="/icon-512.png" alt="Roam" width={64} height={64} className="mx-auto" />
          <h1 className="mt-4 text-2xl font-bold text-zinc-900 dark:text-white">
            {mode === "create" ? "Create your account" : "Welcome back"}
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {mode === "create" ? "Free, forever." : "Sign in to continue."}
          </p>
        </div>

        {/* Tabs */}
        <div className="flex rounded-lg border border-zinc-200 dark:border-zinc-800 p-1 gap-1">
          <button
            type="button"
            onClick={() => switchMode("create")}
            className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-colors ${
              mode === "create"
                ? "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900"
                : "text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
            }`}
          >
            Create account
          </button>
          <button
            type="button"
            onClick={() => switchMode("signin")}
            className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-colors ${
              mode === "signin"
                ? "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900"
                : "text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
            }`}
          >
            Sign in
          </button>
        </div>

        {/* OAuth buttons */}
        {oauthButtons}

        <div className="flex items-center gap-3">
          <hr className="flex-1 border-zinc-200 dark:border-zinc-800" />
          <span className="text-xs text-zinc-400">or</span>
          <hr className="flex-1 border-zinc-200 dark:border-zinc-800" />
        </div>

        {/* Error */}
        {error && (
          <p className="text-sm text-red-600 bg-red-50 dark:bg-red-950/40 rounded-lg px-4 py-2">{error}</p>
        )}

        {mode === "create" ? (
          /* ── Create account form ── */
          <form onSubmit={handleSignUp} className="flex flex-col gap-4" noValidate>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="email" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Email</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={e => handleEmailChange(e.target.value)}
                className={`w-full rounded-lg border px-4 py-2.5 text-sm bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white ${emailError ? "border-red-500" : "border-zinc-300 dark:border-zinc-700"}`}
                placeholder="you@example.com"
              />
              {emailError && <p className="text-xs text-red-600">{emailError}</p>}
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="password" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Password</label>
              <input
                id="password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={e => handlePasswordChange(e.target.value)}
                className={`w-full rounded-lg border px-4 py-2.5 text-sm bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white ${passwordError ? "border-red-500" : "border-zinc-300 dark:border-zinc-700"}`}
                placeholder="Min 8 characters"
              />
              {password && (
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1 rounded-full bg-zinc-200 dark:bg-zinc-700">
                    <div
                      className={`h-1 rounded-full transition-all ${getPasswordStrengthColor(passwordStrength)}`}
                      style={{ width: { weak: "25%", fair: "50%", good: "75%", strong: "100%" }[passwordStrength] }}
                    />
                  </div>
                  <span className="text-xs text-zinc-500">{getPasswordStrengthLabel(passwordStrength)}</span>
                </div>
              )}
              {passwordError && <p className="text-xs text-red-600">{passwordError}</p>}
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="confirm" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Confirm password</label>
              <input
                id="confirm"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={e => handleConfirmChange(e.target.value)}
                className={`w-full rounded-lg border px-4 py-2.5 text-sm bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white ${confirmError ? "border-red-500" : "border-zinc-300 dark:border-zinc-700"}`}
              />
              {confirmError && <p className="text-xs text-red-600">{confirmError}</p>}
            </div>

            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={agreedToTerms}
                onChange={e => setAgreedToTerms(e.target.checked)}
                className="mt-0.5 rounded border-zinc-300 dark:border-zinc-600"
              />
              <span className="text-xs text-zinc-600 dark:text-zinc-400">
                I agree to the{" "}
                <Link href="/terms" target="_blank" className="underline hover:text-zinc-900 dark:hover:text-white">Terms of Service</Link>
                {" "}and{" "}
                <Link href="/privacy" target="_blank" className="underline hover:text-zinc-900 dark:hover:text-white">Privacy Policy</Link>
              </span>
            </label>

            <button
              type="submit"
              disabled={loading || !createFormValid}
              className="w-full rounded-lg bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 py-2.5 text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-40"
            >
              {loading ? "Creating account…" : "Create account"}
            </button>
          </form>
        ) : (
          /* ── Sign in form ── */
          <form onSubmit={handleSignIn} className="flex flex-col gap-4" noValidate>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="signin-email" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Email</label>
              <input
                id="signin-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={e => handleEmailChange(e.target.value)}
                className={`w-full rounded-lg border px-4 py-2.5 text-sm bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white ${emailError ? "border-red-500" : "border-zinc-300 dark:border-zinc-700"}`}
                placeholder="you@example.com"
              />
              {emailError && <p className="text-xs text-red-600">{emailError}</p>}
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between items-center">
                <label htmlFor="signin-password" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Password</label>
                <Link href="/forgot-password" className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors">
                  Forgot password?
                </Link>
              </div>
              <input
                id="signin-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 px-4 py-2.5 text-sm bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !signinFormValid}
              className="w-full rounded-lg bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 py-2.5 text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-40"
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}


