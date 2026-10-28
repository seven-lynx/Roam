import Link from 'next/link';
import type { RefObject } from 'react';
import { extractDomain } from '@/lib/url-utils';
import type { ScanTarget } from '@/lib/scan';

interface Props {
  target: ScanTarget | null;
  actionRef: RefObject<HTMLElement | null>;
  onAgain: () => void;
  onClose: () => void;
}

/**
 * Final card of the scan sequence. The site is opened with a plain link rather
 * than window.open after the animation, so popup blockers never interfere and
 * keyboard / screen-reader users get a real link.
 */
export function ScanResult({ target, actionRef, onAgain, onClose }: Props) {
  if (!target) {
    return (
      <div className="panel w-full max-w-md" role="status">
        <div className="panel-head"><span className="led" />no signal</div>
        <div className="space-y-3 p-5 text-sm text-muted">
          <p>The catalogue didn&rsquo;t answer. Try again, or browse the collections instead.</p>
          <div className="flex flex-wrap gap-3">
            <button ref={actionRef as RefObject<HTMLButtonElement>} type="button" className="btn btn-primary" onClick={onAgain}>
              Scan again
            </button>
            <Link href="/collections" className="btn btn-secondary" onClick={onClose}>Collections</Link>
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
        <div className="flex flex-wrap gap-3 pt-1">
          <a
            ref={actionRef as RefObject<HTMLAnchorElement>}
            href={target.original_url}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary"
          >
            Open ↗
          </a>
          <button type="button" className="btn btn-secondary" onClick={onAgain}>Scan again</button>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
