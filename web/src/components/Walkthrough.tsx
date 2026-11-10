'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { useWorkstation, type WebappTheme } from '@/components/WorkstationContext';
import { InterestPicker, type Category, type Subcategory } from '@/components/InterestPicker';
import { saveUserInterests, selectAllCategories, type InterestMode } from '@/lib/interests';
import Image from 'next/image';

const USERNAME_RE = /^[a-z0-9_-]+$/;
const STEPS = 5;

/** OS palette — kept in sync with globals.css night-theme tokens. */
const C = {
  bg: '#040a0a',
  panel: 'rgba(15,31,36,0.5)',
  fg: '#e6dcc3',
  muted: '#8fa3a0',
  line: '#28444a',
  phosphor: '#59b3ae',
  phosphorBright: '#7fd0cb',
  gold: '#c9a24b',
  tealInk: '#06211c',
} as const;

const mono = { fontFamily: 'var(--font-mono)' } as const;
const pixel = { fontFamily: 'var(--font-pixel)' } as const;

/**
 * Unskippable scripted onboarding for brand-new accounts, shown as a full-screen
 * overlay until `walkthrough_completed_at` is set. Steps: welcome → theme →
 * interests → handle (username + public) → final message.
 */
export function Walkthrough() {
  const { session, refresh } = useAuth();
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
  const interestSelected = mode === 'pillars' ? pillars.size : topics.size;
  const interestTotal = mode === 'pillars' ? categories.length : subcategories.length;

  /** "Everything" as a first-class choice: all categories, or all topics. */
  function selectAll() {
    if (mode === 'pillars') setPillars(selectAllCategories(categories));
    else setTopics(new Set(subcategories.map((s) => s.id)));
  }

  const last = step === STEPS - 1;

  let canContinue = true;
  if (step === 2) canContinue = interestsReady;
  else if (step === 3) canContinue = usernameValid;
  else if (last) canContinue = usernameValid && interestsReady;

  if (state !== 'show') return null;

  async function advance() {
    if (step === 1) {
      setWebappTheme(themeChoice);
    } else if (step === 2) {
      const supabase = createClient();
      // One RPC: the mode is persisted and the rows replaced in a single
      // transaction, so onboarding cannot leave a half-applied scope (#121).
      await saveUserInterests(supabase, mode, pillars, topics).catch(() => {});
    } else if (step === 3) {
      const supabase = createClient();
      await supabase
        .from('profiles')
        .update({ username: clean, display_name: clean, is_public: isPublic })
        .eq('id', session!.user.id);
    } else if (last) {
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
    await refresh();
    setState('hide');
  }

  const h1 = { fontSize: 27, fontWeight: 700, letterSpacing: '-0.02em', margin: 0 } as const;
  const sub = { opacity: 0.68, fontSize: 15, lineHeight: 1.6, margin: '12px 0 22px' } as const;
  const kicker = { ...mono, color: C.gold, fontSize: 11, letterSpacing: '0.18em', marginBottom: 14 } as const;
  const hint = { ...mono, fontSize: 12, opacity: 0.55, marginTop: 8 } as const;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 90, background: C.bg, color: C.fg, display: 'flex', flexDirection: 'column' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 26px',
          borderBottom: `1px solid ${C.line}`,
        }}
      >
        <span style={{ ...pixel, color: C.phosphor, fontSize: 12, letterSpacing: '0.18em' }}>ROAM // ONBOARD</span>
        <span style={{ ...mono, color: C.muted, fontSize: 12, letterSpacing: '0.12em' }}>
          STEP {String(step + 1).padStart(2, '0')} / {String(STEPS).padStart(2, '0')}
        </span>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '32px 26px' }}>
        <div style={{ maxWidth: 480, margin: '0 auto' }}>
        {step === 0 && (
          <div>
            <div style={kicker}>SIGNAL // ACQUIRED</div>
            <h1 style={h1}>The internet died. Roam kept walking.</h1>
            <p style={sub}>
              Most of the web is static now — auto-generated and abandoned. Roam walks the parts a
              human still left alive: one tap, one page, somewhere new.
            </p>
            <div style={{ display: 'grid', gap: 8 }}>
              {[
                ['Roam', 'jump to a random saved page'],
                ['Rate', 'teach Roam what’s worth surfacing'],
                ['Submit', 'add a page for others to find'],
                ['Report', 'flag anything that shouldn’t be here'],
              ].map(([k, v]) => (
                <div
                  key={k}
                  style={{
                    display: 'flex',
                    gap: 12,
                    alignItems: 'center',
                    padding: '10px 12px',
                    borderRadius: 10,
                    background: C.panel,
                    border: `1px solid ${C.line}`,
                    fontSize: 14,
                  }}
                >
                  <span style={{ ...pixel, color: C.phosphor, fontSize: 11, letterSpacing: '0.1em', minWidth: 54 }}>
                    {k.toUpperCase()}
                  </span>
                  <span style={{ opacity: 0.8 }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {step === 1 && (
          <div>
            <h1 style={h1}>Choose your theme</h1>
            <p style={sub}>You can switch anytime from the top-right of the status bar.</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {(
                [
                  {
                    id: 'classic',
                    title: 'Roam Classic',
                    desc: 'The minimal app. Clean, quiet — just Roam.',
                    shot: '/walkthrough/theme-roam-classic.webp',
                  },
                  {
                    id: 'roam-os',
                    title: 'Roam-OS',
                    desc: 'The full cyberdeck. CRT glow, control deck and all.',
                    shot: '/walkthrough/theme-roam-os.webp',
                  },
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
                      borderRadius: 16,
                      padding: 10,
                      cursor: 'pointer',
                      background: active ? 'rgba(89,179,174,0.12)' : 'rgba(15,31,36,0.35)',
                      border: `1px solid ${active ? C.phosphor : C.line}`,
                      color: C.fg,
                    }}
                  >
                    <div
                      style={{
                        position: 'relative',
                        aspectRatio: '16 / 9',
                        borderRadius: 10,
                        overflow: 'hidden',
                        background: '#040a0a',
                        border: `1px solid ${active ? C.phosphorBright : C.line}`,
                        marginBottom: 10,
                      }}
                    >
                      <Image
                        src={t.shot}
                        alt={`${t.title} preview`}
                        fill
                        sizes="(max-width: 520px) 44vw, 210px"
                        style={{ objectFit: 'cover' }}
                      />
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{t.title}</div>
                    <div style={{ opacity: 0.6, fontSize: 12, marginTop: 2, lineHeight: 1.45 }}>{t.desc}</div>
                    <div style={{ ...mono, fontSize: 11, letterSpacing: '0.1em', color: active ? C.phosphor : C.muted, marginTop: 8 }}>
                      {active ? '✓ SELECTED' : 'SELECT'}
                    </div>
                  </button>
                );
              })}
            </div>
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
              scope={{ selected: interestSelected, total: interestTotal }}
              onSelectAll={selectAll}
            />
          </div>
        )}

        {step === 3 && (
          <div>
            <h1 style={h1}>Claim your handle</h1>
            <p style={sub}>
              Your public address: roamtheweb.app/u/{clean || 'you'}. Pick a name, then decide who can
              see your discoveries.
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
                border: `1px solid ${C.line}`,
                background: 'rgba(15,31,36,0.5)',
                color: C.fg,
                fontSize: 16,
              }}
            />
            <p style={hint}>Letters, numbers, hyphens, underscores. Min 3 characters.</p>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderRadius: 14,
                padding: 16,
                marginTop: 16,
                background: C.panel,
                border: `1px solid ${C.line}`,
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
                  background: isPublic ? C.phosphor : 'rgba(255,255,255,0.18)',
                  border: 'none',
                  position: 'relative',
                  cursor: 'pointer',
                }}
              >
                <span
                  style={{
                    position: 'absolute',
                    top: 3,
                    left: isPublic ? 23 : 3,
                    width: 22,
                    height: 22,
                    borderRadius: 999,
                    background: C.tealInk,
                    transition: 'left 0.15s',
                  }}
                />
              </button>
            </div>
          </div>
        )}

        {last && (
          <div>
            <div style={{ ...pixel, color: C.phosphor, fontSize: 12, letterSpacing: '0.18em', marginBottom: 14 }}>
              UPLINK // ONLINE
            </div>
            <h1 style={h1}>You’re a wanderer now.</h1>
            <p style={sub}>The forgotten web remembers you. One tap, and you’re somewhere a human actually saved.</p>
            <p
              style={{
                padding: '12px 14px',
                borderRadius: 12,
                background: C.panel,
                border: `1px solid ${C.line}`,
                fontSize: 14,
                lineHeight: 1.6,
                opacity: 0.85,
              }}
            >
              <span style={{ color: C.gold }}>Roam lives everywhere:</span> your phone, your deck, your
              browser — one feed, one wanderer.
            </p>
          </div>
        )}
        </div>
      </div>

      <div style={{ padding: '14px 26px 20px', borderTop: `1px solid ${C.line}` }}>
        <div style={{ maxWidth: 480, margin: '0 auto' }}>
          <button
            type="button"
            disabled={!canContinue}
            onClick={advance}
            style={{
              width: '100%',
              padding: 14,
              borderRadius: 10,
              background: canContinue ? C.phosphor : 'rgba(230,220,195,0.08)',
              border: 'none',
              color: canContinue ? C.tealInk : 'rgba(230,220,195,0.4)',
              fontSize: 15,
              fontWeight: 700,
              cursor: canContinue ? 'pointer' : 'default',
            }}
          >
            {last ? 'Start roaming' : 'Continue'}
          </button>
          {step > 0 && (
            <button
              type="button"
              onClick={() => setStep(step - 1)}
              style={{
                width: '100%',
                padding: 10,
                borderRadius: 10,
                background: 'transparent',
                border: 'none',
                color: 'rgba(230,220,195,0.6)',
                fontSize: 13,
                cursor: 'pointer',
                marginTop: 6,
              }}
            >
              Back
            </button>
          )}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginTop: 14 }}>
            {Array.from({ length: STEPS }).map((_, i) => (
              <span
                key={i}
                style={{
                  width: i === step ? 12 : 8,
                  height: i === step ? 12 : 8,
                  borderRadius: 999,
                  background: i === step ? C.phosphor : i < step ? 'rgba(89,179,174,0.45)' : 'rgba(230,220,195,0.18)',
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
