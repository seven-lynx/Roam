'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { useWorkstation, type BrowseTarget } from '@/components/WorkstationContext';
import { Window } from '@/components/Window';
import { WilsonScoreMeter } from '@/components/WilsonScoreMeter';
import { extractDomain } from '@/lib/url-utils';
import { fetchUrlMeta } from '@/lib/scan';
import { saveUrlForUser } from '@/lib/save-url';
import { saveUrl as playSaveUrl } from '@/lib/sfx';

/**
 * The in-OS browser window. Loads a roam URL inside the screen and shows a
 * diegetic "control deck": category · domain · subcategory, the Wilson score
 * meter, and up/down vote controls. The URL is framed in an iframe; sites that
 * refuse framing (X-Frame-Options / CSP) can be opened in a real tab.
 */
export function BrowserWindow() {
  const { browse, windows, updateBrowse, closeBrowse, showAlert } = useWorkstation();
  const { session } = useAuth();
  const router = useRouter();
  const [frameKey, setFrameKey] = useState(0);
  const [enriching, setEnriching] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const enrichedUrlRef = useRef<string | null>(null);

  const open = !!windows.browser;

  // Keep `browse` in sync with the window: closing via the title-bar ✕ clears it.
  useEffect(() => {
    if (!open && browse) closeBrowse();
  }, [open, browse, closeBrowse]);

  // Resolve any missing metadata (category/subcategory/wilson/votes) and the
  // signed-in user's rating once per loaded URL.
  useEffect(() => {
    if (!browse) {
      enrichedUrlRef.current = null;
      return;
    }
    if (enrichedUrlRef.current === browse.url) return;
    enrichedUrlRef.current = browse.url;

    const needsMeta = browse.urlId == null || browse.wilsonScore === undefined;
    if (!needsMeta) return;

    setEnriching(true);
    (async () => {
      let next: BrowseTarget = { ...browse };
      if (needsMeta) {
        const fetched = await fetchUrlMeta(browse.url);
        if (fetched) {
          next = {
            ...next,
            urlId: fetched.urlId,
            category: fetched.category,
            subcategory: fetched.subcategory,
            wilsonScore: fetched.wilsonScore,
            upvotes: fetched.upvotes,
            downvotes: fetched.downvotes,
          };
        }
      }
      updateBrowse(next);
      setEnriching(false);
    })();
  }, [browse, updateBrowse]);

  // Reset the save state whenever a different page is loaded.
  useEffect(() => {
    setSaved(false);
  }, [browse?.url]);

  const save = async () => {
    if (!browse) return;
    if (!session?.user?.id) {
      showAlert('ACCESS DENIED', 'Log in to save pages.\n\nRedirecting…');
      router.push('/signup?mode=signin');
      return;
    }
    if (saving || saved) return;

    setSaving(true);
    const ok = await saveUrlForUser(browse.url, browse.title ?? null, browse.urlId ?? null);
    setSaving(false);
    if (ok) {
      setSaved(true);
      playSaveUrl();
    } else {
      showAlert('SAVE FAILED', 'The save relay is unreachable. Try again.');
    }
  };

  if (!browse) return null;

  const domain = browse.domain || extractDomain(browse.url);
  const label = browse.title || domain;
  const score = browse.wilsonScore ?? 0;

  return (
    <Window id="browser" icon={<span aria-hidden="true">≈</span>}>
      {collapsed ? (
        <div className="browser-peek">
          <button
            type="button"
            className="browser-btn"
            aria-label="Show toolbar"
            title="Show toolbar"
            onClick={() => setCollapsed(false)}
          >
            ▴
          </button>
          <span className="browser-address" title={browse.url}>
            {domain}
          </span>
          <button
            type="button"
            className="browser-btn browser-close"
            aria-label="Close browser"
            title="Close browser"
            onClick={() => closeBrowse()}
          >
            ✕
          </button>
        </div>
      ) : (
        <div className="browser-deck">
          <div className="browser-toolbar">
            <button type="button" className="browser-btn" aria-label="Reload" onClick={() => setFrameKey((k) => k + 1)}>
              ↻
            </button>
            <span className="browser-address" title={browse.url}>
              {domain}
            </span>
            <button
              type="button"
              className="browser-btn"
              aria-label="Hide toolbar"
              title="Hide toolbar"
              onClick={() => setCollapsed(true)}
            >
              ▾
            </button>
            <button
              type="button"
              className="browser-btn"
              aria-pressed={saved}
              aria-label={saved ? 'Saved for later' : 'Save for later'}
              title={saved ? 'Saved for later' : 'Save for later'}
              onClick={save}
              disabled={saving}
            >
              {saving ? '…' : saved ? '✓' : '▣'}
            </button>
            <a
              className="browser-btn"
              href={browse.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Open in a new tab"
              title="Open in a new tab (some sites refuse to load inside the OS)"
            >
              ↗
            </a>
            <button
              type="button"
              className="browser-btn browser-close"
              aria-label="Close browser"
              title="Close browser"
              onClick={() => closeBrowse()}
            >
              ✕
            </button>
          </div>

          <div className="browser-meta">
            <span className="browser-meta-path">
              {browse.category ?? '—'} · {domain} · {browse.subcategory ?? '—'}
            </span>
            <WilsonScoreMeter score={score} upvotes={browse.upvotes} downvotes={browse.downvotes} />
          </div>
        </div>
      )}

      <div className="browser-frame">
        {enriching && <span className="browser-loading blink">resolving metadata…</span>}
        <iframe
          key={frameKey}
          src={browse.url}
          title={label || 'Surf'}
          className="browser-iframe"
          referrerPolicy="no-referrer"
        />
      </div>
      <p className="browser-hint">Some sites refuse to load inside the OS — use ↗ to open in a new tab.</p>
    </Window>
  );
}
