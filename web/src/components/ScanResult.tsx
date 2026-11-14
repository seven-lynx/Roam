'use client';

import type { RefObject } from 'react';
import { useEffect, useState } from 'react';
import { extractDomain } from '@/lib/url-utils';
import { describeWait } from '@/lib/format';
import { useWorkstation } from '@/components/WorkstationContext';
import { WilsonScoreMeter } from '@/components/WilsonScoreMeter';
import { checkFramableOne } from '@/lib/framing-client';
import type { ScanTarget } from '@/lib/scan';
import type { RoamExhaustion } from '@/lib/roam-buffer';

interface Props {
  target: ScanTarget | null;
  error?: string | null;
  /** Why the feed came back empty (issue #120), when the server said why. */
  exhaustion?: RoamExhaustion | null;
  actionRef: RefObject<HTMLElement | null>;
  onAgain: () => void;
  onClose: () => void;
}

/**
 * Copy for a dry feed. A cooldown is a wait, an empty pool is a wall, and hidden
 * filters are the user's own doing — three different situations that used to read
 * as one "no signal". Returns null when the server gave no reason, so the plain
 * fallback copy still covers older replies.
 */
function explainExhaustion(
  exhaustion: RoamExhaustion | null | undefined,
): { head: string; body: string } | null {
  switch (exhaustion?.reason) {
    case 'pool_empty':
      return {
        head: 'read it all',
        body: 'Nothing unseen is left in this feed. Other categories still hold pages you haven\u2019t opened.',
      };
    case 'cooldown':
      return {
        head: 'feed resting',
        body: `Every domain here was shown in the last day, and each rests 24 h after a visit. The first one returns ${describeWait(exhaustion.available_later)}.`,
      };
    case 'filters':
      return {
        head: 'filtered out',
        body: 'Nothing left matches your categories. Loosen them in Settings and the feed reopens.',
      };
    default:
      return null;
  }
}

/**
 * Final card of the scan sequence. The primary action opens the page inside the
 * OS browser (with a "new tab" fallback for sites that refuse framing); the
 * card also surfaces the category · subcategory readout and the Wilson score.
 */
export function ScanResult({ target, error, exhaustion, actionRef, onAgain, onClose }: Props) {
  const { openUrl, closeWindow, openAppView } = useWorkstation();
  // Start from whatever the roam path already knew (the prefetch buffer probes
  // every URL it hands out) and probe the rest here, so the primary action is
  // honest *before* the click instead of after a blank white frame.
  const [framable, setFramable] = useState<boolean | null>(target?.framable ?? null);

  useEffect(() => {
    if (!target) {
      setFramable(null);
      return;
    }
    if (target.framable === true || target.framable === false) {
      setFramable(target.framable);
      return;
    }
    let cancelled = false;
    setFramable(null);
    void checkFramableOne(target.original_url).then((policy) => {
      if (cancelled) return;
      setFramable(policy === 'allow' ? true : policy === 'refuse' ? false : null);
    });
    return () => {
      cancelled = true;
    };
  }, [target]);

  // The verdict can land seconds after the card does and swaps the primary action
  // from a button to a link — keep the keyboard position on it.
  useEffect(() => {
    if (framable !== null) actionRef.current?.focus({ preventScroll: true });
  }, [framable, actionRef]);

  if (!target) {
    const why = explainExhaustion(exhaustion);
    return (
      <div className="panel w-full max-w-md" role="status">
        <div className="panel-head"><span className="led" />{why?.head ?? 'no signal'}</div>
        <div className="space-y-3 p-5 text-sm text-muted">
          <p>{why?.body ?? 'The catalog didn\u2019t answer. Try again, or browse the collections instead.'}</p>
          {error && (
            <p className="break-all text-xs text-muted">
              <span className="kicker">trace</span> {error}
            </p>
          )}
          <div className="flex flex-wrap gap-3">
            <button ref={actionRef as RefObject<HTMLButtonElement>} type="button" className="btn btn-primary" onClick={onAgain}>
              Scan again
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => { onClose(); openAppView('/collections', 'Collections'); }}>Collections</button>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    );
  }

  const domain = extractDomain(target.original_url);

  const openInOs = () => {
    closeWindow('scan');
    openUrl({
      url: target.original_url,
      title: target.title,
      domain,
      category: target.category,
      subcategory: target.subcategory,
      wilsonScore: target.wilson_score,
      upvotes: target.upvotes,
      downvotes: target.downvotes,
      urlId: target.id,
      framable,
    });
  };

  return (
    <div className="panel w-full max-w-md" role="status">
      <div className="panel-head"><span className="led" />target acquired</div>
      <div className="space-y-3 p-5">
        <h2 className="break-words font-sans text-xl font-semibold text-ink">{target.title || domain}</h2>
        <dl className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <dt className="kicker">domain</dt>
            <dd className="mt-1 break-all text-ink">{domain}</dd>
          </div>
          <div>
            <dt className="kicker">community votes</dt>
            <dd className="mt-1 text-ok">↑ {target.upvotes}</dd>
          </div>
        </dl>
        <div className="text-xs text-muted">
          {[target.category, target.subcategory].filter(Boolean).join(' · ') || 'uncategorized'}
        </div>
        <WilsonScoreMeter score={target.wilson_score} upvotes={target.upvotes} downvotes={target.downvotes} />
        <div className="flex flex-wrap gap-3 pt-1">
          {framable === false ? (
            <>
              {/* A real anchor, not a button: the site refuses framing, so the honest
                  primary action is a tab — and the click needs no popup workaround. */}
              <a
                ref={actionRef as RefObject<HTMLAnchorElement>}
                className="btn btn-primary"
                href={target.original_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                open in new tab ↗
              </a>
              <button type="button" className="btn btn-secondary" onClick={openInOs}>
                try in OS anyway
              </button>
            </>
          ) : (
            <button
              ref={actionRef as RefObject<HTMLButtonElement>}
              type="button"
              className="btn btn-primary"
              onClick={openInOs}
            >
              Open
            </button>
          )}
          <a href={target.original_url} target="_blank" rel="noopener noreferrer" className="btn btn-secondary">
            ↗ new tab
          </a>
          <button type="button" className="btn btn-secondary" onClick={onAgain}>Scan again</button>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Close</button>
        </div>
        {framable === false && (
          <p className="text-xs text-muted">{domain} refuses to be embedded, so it opens as a real tab.</p>
        )}
      </div>
    </div>
  );
}
