'use client';

import type { RefObject } from 'react';
import { extractDomain } from '@/lib/url-utils';
import { useWorkstation } from '@/components/WorkstationContext';
import { WilsonScoreMeter } from '@/components/WilsonScoreMeter';
import type { ScanTarget } from '@/lib/scan';

interface Props {
  target: ScanTarget | null;
  error?: string | null;
  actionRef: RefObject<HTMLElement | null>;
  onAgain: () => void;
  onClose: () => void;
}

/**
 * Final card of the scan sequence. The primary action opens the page inside the
 * OS browser (with a "new tab" fallback for sites that refuse framing); the
 * card also surfaces the category · subcategory readout and the Wilson score.
 */
export function ScanResult({ target, error, actionRef, onAgain, onClose }: Props) {
  const { openUrl, closeWindow, openAppView } = useWorkstation();

  if (!target) {
    return (
      <div className="panel w-full max-w-md" role="status">
        <div className="panel-head"><span className="led" />no signal</div>
        <div className="space-y-3 p-5 text-sm text-muted">
          <p>The catalog didn&rsquo;t answer. Try again, or browse the collections instead.</p>
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
          <button
            ref={actionRef as RefObject<HTMLButtonElement>}
            type="button"
            className="btn btn-primary"
            onClick={() => {
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
              });
            }}
          >
            Open
          </button>
          <a href={target.original_url} target="_blank" rel="noopener noreferrer" className="btn btn-secondary">
            ↗ new tab
          </a>
          <button type="button" className="btn btn-secondary" onClick={onAgain}>Scan again</button>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
