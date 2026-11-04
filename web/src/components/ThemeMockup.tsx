'use client';

import type { WebappTheme } from '@/components/WorkstationContext';

/**
 * Miniature, CSS-only mockups of the two webapp themes. Used on the walkthrough's
 * theme step so a brand-new account can see what each theme looks like before
 * choosing. Pure inline styles + a little DOM — no raster assets.
 */

const OS = {
  bg: '#07100f',
  panel: '#0f1f24',
  panel2: '#0a1518',
  ink: '#e6dcc3',
  muted: '#8fa3a0',
  line: '#28444a',
  phosphor: '#59b3ae',
  gold: '#c9a24b',
} as const;

const CLASSIC = {
  bg: '#0d0d0e',
  panel: '#171718',
  ink: '#ececec',
  muted: '#9a9a9c',
  line: 'rgba(255,255,255,0.14)',
  accent: '#59b3ae',
  accentInk: '#06211c',
} as const;

const mono = { fontFamily: 'var(--font-mono)' } as const;
const pixel = { fontFamily: 'var(--font-pixel)' } as const;

function Signal({ color }: { color: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'flex-end', gap: 2 }}>
      {[3, 5, 7, 9].map((h, i) => (
        <span key={i} style={{ width: 2, height: h, background: color, opacity: 0.35 + i * 0.22 }} />
      ))}
    </span>
  );
}

function OsHandheld() {
  return (
    <div
      style={{
        width: 128,
        borderRadius: 14,
        border: `1px solid ${OS.line}`,
        background: OS.bg,
        overflow: 'hidden',
        boxShadow: '0 10px 24px rgba(0,0,0,0.45)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 9px',
          borderBottom: `1px solid ${OS.line}`,
        }}
      >
        <span style={{ ...pixel, fontSize: 6, color: OS.phosphor, letterSpacing: '0.08em' }}>ROAM-OS</span>
        <Signal color={OS.phosphor} />
      </div>
      <div style={{ padding: 7, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            style={{
              height: 40,
              borderRadius: 5,
              border: `1px solid ${OS.line}`,
              background: OS.panel2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: 999,
                background: i === 0 ? OS.gold : OS.phosphor,
                boxShadow: `0 0 6px ${OS.phosphor}`,
              }}
            />
          </div>
        ))}
      </div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          gap: 4,
          padding: '6px 9px 9px',
          borderTop: `1px solid ${OS.line}`,
        }}
      >
        <span style={{ width: 16, height: 12, borderRadius: 3, border: `1px solid ${OS.line}`, background: OS.panel2 }} />
        <span style={{ width: 36, height: 12, borderRadius: 3, background: OS.phosphor }} />
        <span style={{ width: 16, height: 12, borderRadius: 3, border: `1px solid ${OS.line}`, background: OS.panel2 }} />
      </div>
    </div>
  );
}

function OsDesktop() {
  return (
    <div style={{ width: '100%', borderRadius: 10, border: `1px solid ${OS.line}`, background: OS.bg, overflow: 'hidden' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          padding: '5px 9px',
          borderBottom: `1px solid ${OS.line}`,
        }}
      >
        <span style={{ ...pixel, fontSize: 6, color: OS.phosphor, letterSpacing: '0.08em' }}>ROAM-OS</span>
        <span style={{ ...mono, fontSize: 7, color: OS.muted }}>~/roam/wander</span>
        <Signal color={OS.phosphor} />
      </div>
      <div style={{ display: 'flex', gap: 6, padding: 8 }}>
        <div style={{ flex: 1, height: 42, borderRadius: 5, border: `1px solid ${OS.line}`, background: OS.panel, padding: 5 }}>
          <div style={{ width: '48%', height: 4, background: OS.phosphor, borderRadius: 2, marginBottom: 4 }} />
          <div style={{ width: '82%', height: 3, background: OS.muted, borderRadius: 2, marginBottom: 3 }} />
          <div style={{ width: '64%', height: 3, background: OS.muted, borderRadius: 2 }} />
        </div>
        <div style={{ flex: 1, height: 42, borderRadius: 5, border: `1px solid ${OS.line}`, background: OS.panel, padding: 5 }}>
          <div style={{ width: '56%', height: 4, background: OS.gold, borderRadius: 2, marginBottom: 4 }} />
          <div style={{ width: '74%', height: 3, background: OS.muted, borderRadius: 2, marginBottom: 3 }} />
          <div style={{ width: '52%', height: 3, background: OS.muted, borderRadius: 2 }} />
        </div>
      </div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          gap: 5,
          padding: '5px 9px 8px',
          borderTop: `1px solid ${OS.line}`,
        }}
      >
        <span style={{ width: 18, height: 12, borderRadius: 3, border: `1px solid ${OS.line}`, background: OS.panel2 }} />
        <span style={{ width: 44, height: 12, borderRadius: 3, background: OS.phosphor }} />
        <span style={{ width: 18, height: 12, borderRadius: 3, border: `1px solid ${OS.line}`, background: OS.panel2 }} />
        <span style={{ width: 18, height: 12, borderRadius: 3, border: `1px solid ${OS.line}`, background: OS.panel2 }} />
      </div>
    </div>
  );
}

function ClassicHandheld() {
  return (
    <div
      style={{
        width: 128,
        borderRadius: 14,
        border: `1px solid ${CLASSIC.line}`,
        background: CLASSIC.bg,
        overflow: 'hidden',
        boxShadow: '0 10px 24px rgba(0,0,0,0.45)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '7px 9px',
          borderBottom: `1px solid ${CLASSIC.line}`,
        }}
      >
        <span style={{ fontWeight: 700, fontSize: 9, color: CLASSIC.ink, letterSpacing: '-0.01em' }}>Roam</span>
        <span style={{ width: 12, height: 12, borderRadius: 999, background: CLASSIC.accent }} />
      </div>
      <div style={{ padding: '7px 9px 3px' }}>
        <div
          style={{
            height: 16,
            borderRadius: 5,
            background: CLASSIC.accent,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span style={{ fontSize: 8, fontWeight: 700, color: CLASSIC.accentInk }}>Roam</span>
        </div>
      </div>
      <div style={{ padding: '6px 9px', display: 'flex', flexDirection: 'column', gap: 5 }}>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{ borderRadius: 6, border: `1px solid ${CLASSIC.line}`, background: CLASSIC.panel, padding: 6 }}>
            <div style={{ width: '54%', height: 4, background: CLASSIC.ink, borderRadius: 2, marginBottom: 4, opacity: 0.9 }} />
            <div style={{ width: '88%', height: 3, background: CLASSIC.muted, borderRadius: 2, marginBottom: 3 }} />
            <div style={{ width: '68%', height: 3, background: CLASSIC.muted, borderRadius: 2 }} />
          </div>
        ))}
      </div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-around',
          alignItems: 'center',
          padding: '6px 9px 9px',
          borderTop: `1px solid ${CLASSIC.line}`,
        }}
      >
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            style={{
              width: 14,
              height: 14,
              borderRadius: 3,
              background: i === 1 ? CLASSIC.accent : CLASSIC.muted,
              opacity: i === 1 ? 1 : 0.45,
            }}
          />
        ))}
      </div>
    </div>
  );
}

function ClassicDesktop() {
  return (
    <div style={{ width: '100%', borderRadius: 10, border: `1px solid ${CLASSIC.line}`, background: CLASSIC.bg, overflow: 'hidden' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 9px',
          borderBottom: `1px solid ${CLASSIC.line}`,
        }}
      >
        <span style={{ fontWeight: 700, fontSize: 9, color: CLASSIC.ink }}>Roam Classic</span>
        <span style={{ width: 12, height: 12, borderRadius: 999, background: CLASSIC.accent }} />
      </div>
      <div style={{ display: 'flex', gap: 6, padding: 8 }}>
        <div style={{ width: 34, borderRadius: 5, background: CLASSIC.panel, padding: 5, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} style={{ height: 4, background: CLASSIC.muted, borderRadius: 2 }} />
          ))}
        </div>
        <div style={{ flex: 1, display: 'flex', gap: 6 }}>
          <div style={{ flex: 1, borderRadius: 5, border: `1px solid ${CLASSIC.line}`, background: CLASSIC.panel, padding: 5 }}>
            <div style={{ width: '58%', height: 4, background: CLASSIC.ink, borderRadius: 2, marginBottom: 4, opacity: 0.9 }} />
            <div style={{ width: '86%', height: 3, background: CLASSIC.muted, borderRadius: 2, marginBottom: 3 }} />
            <div style={{ width: '56%', height: 3, background: CLASSIC.muted, borderRadius: 2 }} />
          </div>
          <div style={{ flex: 1, borderRadius: 5, border: `1px solid ${CLASSIC.line}`, background: CLASSIC.panel, padding: 5 }}>
            <div style={{ width: '50%', height: 4, background: CLASSIC.ink, borderRadius: 2, marginBottom: 4, opacity: 0.9 }} />
            <div style={{ width: '72%', height: 3, background: CLASSIC.muted, borderRadius: 2 }} />
          </div>
        </div>
      </div>
    </div>
  );
}

export function ThemeMockup({ theme }: { theme: WebappTheme }) {
  const os = theme === 'roam-os';
  const P = os ? OS : CLASSIC;
  return (
    <div aria-hidden="true" style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <div>
          <div
            style={{
              ...mono,
              fontSize: 9,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              color: P.muted,
              textAlign: 'center',
              marginBottom: 5,
            }}
          >
            Handheld
          </div>
          {os ? <OsHandheld /> : <ClassicHandheld />}
        </div>
      </div>
      <div>
        <div style={{ ...mono, fontSize: 9, letterSpacing: '0.16em', textTransform: 'uppercase', color: P.muted, marginBottom: 5 }}>
          Desktop
        </div>
        {os ? <OsDesktop /> : <ClassicDesktop />}
      </div>
    </div>
  );
}

