import { ImageResponse } from 'next/og';

// Route-level social card. Rendered at build time by Next (no request-time API here),
// 1200×630 per opengraph-image convention. Colours come from the ROAM-OS night
// palette in globals.css — keep them literal, Satori has no CSS cascade.
export const alt = 'Roam — scan the forgotten web';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const screen = '#07100f';
const bone = '#e6dcc3';
const muted = '#8fa3a0';
const gold = '#c9a24b';
const phosphor = '#59b3ae';
const line = '#28444a';

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: screen,
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          padding: '64px 72px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 24,
            letterSpacing: 6,
            color: muted,
          }}
        >
          <div style={{ display: 'flex' }}>SEVEN-LYNX</div>
          <div style={{ display: 'flex', color: gold }}>ROAM</div>
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              display: 'flex',
              fontSize: 180,
              letterSpacing: 16,
              color: bone,
              lineHeight: 1,
            }}
          >
            ROAM
          </div>
          <div
            style={{
              display: 'flex',
              marginTop: 20,
              fontSize: 44,
              color: phosphor,
              letterSpacing: 1,
            }}
          >
            Scan the forgotten web.
          </div>
          <div
            style={{
              display: 'flex',
              marginTop: 26,
              fontSize: 26,
              color: muted,
              maxWidth: 900,
            }}
          >
            A wanderer&apos;s workstation: a random corner of the internet, rated by real
            people.
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            borderTop: `2px solid ${line}`,
            paddingTop: 24,
            fontSize: 22,
            letterSpacing: 3,
            color: muted,
          }}
        >
          <div style={{ display: 'flex', color: gold, marginRight: 32 }}>WEB</div>
          <div style={{ display: 'flex', marginRight: 32 }}>BROWSER EXTENSION</div>
          <div style={{ display: 'flex' }}>ANDROID</div>
        </div>
      </div>
    ),
    { ...size }
  );
}
