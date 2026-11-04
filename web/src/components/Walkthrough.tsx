'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { useWorkstation, type WebappTheme } from '@/components/WorkstationContext';
import { InterestPicker, type Category, type Subcategory } from '@/components/InterestPicker';
import { saveUserInterests, type InterestMode } from '@/lib/interests';

const USERNAME_RE = /^[a-z0-9_-]+$/;
const STEPS = 6;

/**
 * Unskippable scripted onboarding for brand-new accounts, shown as a full-screen
 * overlay until `walkthrough_completed_at` is set. Steps: welcome → theme →
 * interests → username → go public → first Roam.
 */
export function Walkthrough() {
  const { session } = useAuth();
  const { setWebappTheme } = useWorkstation();

  const [state, setState] = useState<'loading' | 'show' | 'hide'>('loading');
  const [step, setStep] = useState(0);

  const [themeChoice, setThemeChoice] = useState<WebappTheme>('roam-os');

  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [mode, setMode] = useState<InterestMode>('pillars');
  const [pillars, setPillars] = useState<Set<string>>(new Set());
  const [topics, setTopics] = useState<Set<string>>(new Set());

  const [username, setUsername] = useState('');
  const [isPublic, setIsPublic] = useState(true);

  const [roamUrl, setRoamUrl] = useState<string | null>(null);
  const [roaming, setRoaming] = useState(false);
  const [roamError, setRoamError] = useState(false);

  // Gate: only accounts whose walkthrough_completed_at is NULL see this.
  useEffect(() => {
    let cancelled = false;
    async function check() {
      if (!session?.user.id) {
        setState('hide');
        return;
      }
      try {
        const { data } = await createClient()
          .from('profiles')
          .select('walkthrough_completed_at')
          .eq('id', session.user.id)
          .maybeSingle();
        if (!cancelled) setState(data?.walkthrough_completed_at == null ? 'show' : 'hide');
      } catch {
        if (!cancelled) setState('hide');
      }
    }
    check();
    return () => {
      cancelled = true;
    };
  }, [session]);

  useEffect(() => {
    if (state !== 'show') return;
    const supabase = createClient();
    supabase
      .from('categories')
      .select('id, name, icon, sort_order')
      .order('sort_order')
      .then(({ data }) => {
        const rows = (data ?? []) as { id: string; name: string; icon: string }[];
        setCategories(rows.map((c) => ({ id: c.id, label: c.name, emoji: c.icon })));
      });
    supabase
      .from('subcategories')
      .select('id, name, category_id, sort_order')
      .order('sort_order')
      .then(({ data }) => setSubcategories((data ?? []) as Subcategory[]));
  }, [state]);

  const clean = username.trim().toLowerCase();
  const usernameValid = clean.length >= 3 && USERNAME_RE.test(clean);
  const interestsReady = mode === 'pillars' ? pillars.size > 0 : topics.size > 0;
  const canContinue =
    step === 2 ? interestsReady : step === 3 ? usernameValid : step === 5 ? roamUrl != null : true;

  if (state !== 'show') return null;

  async function advance() {
    if (step === 1) {
      setWebappTheme(themeChoice);
    } else if (step === 2) {
      const supabase = createClient();
      const parentMap = new Map(subcategories.map((s) => [s.id, s.category_id]));
      await saveUserInterests(supabase, session!.user.id, mode, pillars, topics, parentMap).catch(() => {});
    } else if (step === 3) {
      const supabase = createClient();
      await supabase
        .from('profiles')
        .update({ username: clean, display_name: clean })
        .eq('id', session!.user.id);
    } else if (step === 4) {
      const supabase = createClient();
      await supabase.from('profiles').update({ is_public: isPublic }).eq('id', session!.user.id);
    } else if (step === 5) {
      return finish();
    }
    setStep((s) => Math.min(s + 1, STEPS - 1));
  }

  async function finish() {
    const supabase = createClient();
    await supabase
      .from('profiles')
      .update({ walkthrough_completed_at: new Date().toISOString() })
      .eq('id', session!.user.id);
    setState('hide');
  }

  async function doRoam() {
    setRoaming(true);
    setRoamError(false);
    const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!base || !session?.access_token) {
      setRoamError(true);
      setRoaming(false);
      return;
    }
    try {
      const res = await fetch(`${base}/functions/v1/roam`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ count: 1 }),
      });
      if (!res.ok) {
        setRoamError(true);
      } else {
        const json = (await res.json().catch(() => null)) as { url?: string } | null;
        const url = typeof json?.url === 'string' ? json.url : null;
        if (url) setRoamUrl(url);
        else setRoamError(true);
      }
    } catch {
      setRoamError(true);
    }
    setRoaming(false);
  }

  const h1 = { fontSize: 28, fontWeight: 700, margin: '0 0 12px' } as const;
  const sub = { opacity: 0.7, fontSize: 15, lineHeight: 1.6, marginBottom: 20 } as const;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 90, background: '#05070a', color: '#e8e6df', display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '28px 26px 16px' }}>
        {step === 0 && (
          <div>
            <h1 style={h1}>Welcome to Roam</h1>
            <p style={sub}>
              Roam is a random walk across the open web. Every tap takes you somewhere new — a page
              another human actually found worth saving.
            </p>
            <div style={{ display: 'grid', gap: 10, fontSize: 15 }}>
              {['Roam — jump to a new page', 'Rate ↑ / ↓ — teach Roam what’s good', 'Submit — add a page for others to discover', 'Report — flag something that shouldn’t be here'].map((t) => (
                <div key={t} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <span style={{ width: 8, height: 8, borderRadius: 999, background: '#59b3ae', flexShrink: 0 }} />
                  {t}
                </div>
              ))}
            </div>
          </div>
        )}

        {step === 1 && (
          <div>
            <h1 style={h1}>Choose your theme</h1>
            <p style={sub}>You can switch anytime from the top-right of the status bar.</p>
            {(
              [
                { id: 'classic', title: 'Roam Classic', desc: 'The minimal light-and-dark app. Simple, familiar, focused.', bg: '#27272a' },
                { id: 'roam-os', title: 'Roam-OS', desc: 'The full cyberdeck experience. CRT glow, control deck and all.', bg: '#0b1a14' },
              ] as const
            ).map((t) => {
              const active = themeChoice === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setThemeChoice(t.id)}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    marginBottom: 16,
                    borderRadius: 16,
                    padding: 12,
                    cursor: 'pointer',
                    background: active ? 'rgba(89,179,174,0.15)' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${active ? '#59b3ae' : 'rgba(255,255,255,0.12)'}`,
                    color: '#e8e6df',
                  }}
                >
                  <div style={{ height: 120, borderRadius: 10, background: t.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontWeight: 700, fontSize: 16, color: '#fff' }}>{t.title}</div>
                      <div style={{ fontSize: 10, letterSpacing: 1, opacity: 0.55, color: '#fff', marginTop: 4 }}>SCREENSHOT PLACEHOLDER</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{t.title}</div>
                      <div style={{ opacity: 0.6, fontSize: 13 }}>{t.desc}</div>
                    </div>
                    <span style={{ fontSize: 12, color: active ? '#59b3ae' : 'rgba(255,255,255,0.5)' }}>{active ? '✓ Selected' : 'Select'}</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {step === 2 && (
          <div>
            <h1 style={h1}>What are you into?</h1>
            <p style={sub}>Pick interests to personalise your discoveries. You can change these anytime in Profile.</p>
            <InterestPicker
              categories={categories}
              subcategories={subcategories}
              mode={mode}
              selectedPillars={pillars}
              selectedTopics={topics}
              onPillarToggle={(id) => setPillars((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; })}
              onTopicToggle={(id) => setTopics((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; })}
              onModeChange={setMode}
            />
          </div>
        )}

        {step === 3 && (
          <div>
            <h1 style={h1}>Choose a username</h1>
            <p style={sub}>
              This is your public handle: roamtheweb.app/u/{clean || 'you'}. You can change it later.
            </p>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="yourname"
              autoFocus
              autoComplete="username"
              style={{
                width: '100%',
                padding: '12px 14px',
                borderRadius: 10,
                border: '1px solid rgba(255,255,255,0.2)',
                background: 'rgba(255,255,255,0.06)',
                color: '#e8e6df',
                fontSize: 16,
              }}
            />
            <p style={{ fontSize: 12, opacity: 0.55, marginTop: 8 }}>
              Letters, numbers, hyphens, underscores. Min 3 characters.
            </p>
          </div>
        )}

        {step === 4 && (
          <div>
            <h1 style={h1}>Go public</h1>
            <p style={sub}>A public profile lets others find you at your /u/ link and follow your discoveries.</p>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderRadius: 14,
                padding: 16,
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.1)',
              }}
            >
              <div>
                <div style={{ fontWeight: 700 }}>Public profile</div>
                <div style={{ opacity: 0.6, fontSize: 13 }}>{isPublic ? 'Visible to everyone' : 'Hidden'}</div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={isPublic}
                onClick={() => setIsPublic(!isPublic)}
                style={{
                  width: 48,
                  height: 28,
                  borderRadius: 999,
                  background: isPublic ? '#59b3ae' : 'rgba(255,255,255,0.2)',
                  border: 'none',
                  position: 'relative',
                  cursor: 'pointer',
                }}
              >
                <span style={{ position: 'absolute', top: 3, left: isPublic ? 23 : 3, width: 22, height: 22, borderRadius: 999, background: '#06211c', transition: 'left 0.15s' }} />
              </button>
            </div>
          </div>
        )}

        {step === 5 && (
          <div>
            <h1 style={h1}>Your first Roam</h1>
            <p style={sub}>Tap Roam and we’ll surface your first page. One tap, somewhere new.</p>
            <button
              type="button"
              onClick={doRoam}
              disabled={roaming}
              style={{
                width: '100%',
                padding: 14,
                borderRadius: 10,
                background: '#59b3ae',
                border: 'none',
                color: '#06211c',
                fontSize: 15,
                fontWeight: 700,
                cursor: roaming ? 'default' : 'pointer',
                opacity: roaming ? 0.6 : 1,
              }}
            >
              {roaming ? 'Roaming…' : 'Roam'}
            </button>
            {roamUrl && (
              <div style={{ marginTop: 16, borderRadius: 12, padding: 14, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}>
                <div style={{ fontSize: 14, wordBreak: 'break-all', color: '#59b3ae' }}>{roamUrl}</div>
              </div>
            )}
            {roamError && <p style={{ marginTop: 12, fontSize: 14, color: '#ff8a8a' }}>Something went wrong. Tap Roam again.</p>}
          </div>
        )}
      </div>

      <div style={{ padding: '14px 26px 20px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <button
          type="button"
          disabled={!canContinue}
          onClick={advance}
          style={{
            width: '100%',
            padding: 14,
            borderRadius: 10,
            background: canContinue ? '#59b3ae' : 'rgba(255,255,255,0.08)',
            border: 'none',
            color: canContinue ? '#06211c' : 'rgba(255,255,255,0.4)',
            fontSize: 15,
            fontWeight: 700,
            cursor: canContinue ? 'pointer' : 'default',
          }}
        >
          {step === 5 ? 'Finish' : 'Continue'}
        </button>
        {step > 0 && (
          <button type="button" onClick={() => setStep(step - 1)} style={{ width: '100%', padding: 10, borderRadius: 10, background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.6)', fontSize: 13, cursor: 'pointer', marginTop: 6 }}>
            Back
          </button>
        )}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginTop: 14 }}>
          {Array.from({ length: STEPS }).map((_, i) => (
            <span
              key={i}
              style={{
                width: i === step ? 12 : 9,
                height: i === step ? 12 : 9,
                borderRadius: 999,
                background: i === step ? '#59b3ae' : i < step ? 'rgba(89,179,174,0.5)' : 'rgba(255,255,255,0.18)',
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
