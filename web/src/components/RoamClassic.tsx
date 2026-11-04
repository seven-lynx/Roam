'use client';

import { useWorkstation } from '@/components/WorkstationContext';

/**
 * Roam Classic — the original, pre-cyberdeck web-app shell. Mounted when the
 * status-bar theme toggle is set to "classic". The full old site (header,
 * landing, join, discover) is being restored from the `pre-cyberdeck-web`
 * snapshot and will render here once re-integrated.
 */
export function RoamClassic() {
  const { setWebappTheme } = useWorkstation();

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 80,
        background: '#0b0b0c',
        color: '#eee',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 24px',
          borderBottom: '1px solid rgba(255,255,255,0.12)',
        }}
      >
        <span style={{ fontWeight: 700, fontSize: 20, letterSpacing: '-0.02em' }}>
          Roam <span style={{ opacity: 0.55, fontWeight: 400 }}>Classic</span>
        </span>
        <button
          type="button"
          onClick={() => setWebappTheme('roam-os')}
          style={{
            padding: '8px 14px',
            borderRadius: 8,
            border: '1px solid rgba(255,255,255,0.2)',
            background: 'transparent',
            color: '#eee',
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          Back to ROAM-OS
        </button>
      </header>
      <main
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          textAlign: 'center',
        }}
      >
        <div>
          <h1 style={{ fontSize: 32, fontWeight: 700, margin: 0 }}>Roam Classic</h1>
          <p style={{ marginTop: 12, maxWidth: 440, opacity: 0.6, fontSize: 15, lineHeight: 1.6 }}>
            The original Roam web app. The classic site — home, join, and the discovery pages — is
            being restored from the pre-cyberdeck snapshot and will render here.
          </p>
        </div>
      </main>
    </div>
  );
}
