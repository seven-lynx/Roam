'use client';

import { useEffect } from 'react';
import { useWorkstation } from '@/components/WorkstationContext';
import { click } from '@/lib/sfx';

/**
 * Diegetic ROAM-OS system dialog, used for in-universe errors (e.g. "sign in
 * required"). Rendered inside `.screen` so it reads as software the OS runs,
 * not a browser modal. `contain: layout paint` on `.screen` makes the fixed
 * backdrop resolve against the screen instead of the window.
 */
export function AlertDialog() {
  const { alert, dismissAlert } = useWorkstation();

  useEffect(() => {
    if (!alert) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismissAlert();
      if (e.key === 'Enter' && !alert.confirm) dismissAlert();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [alert, dismissAlert]);

  if (!alert) return null;

  const danger = !!alert.confirm?.danger;
  const confirmLabel = alert.confirm?.confirmLabel ?? 'OK';

  const confirm = () => {
    click();
    const fn = alert.confirm?.onConfirm;
    dismissAlert();
    fn?.();
  };

  return (
    <div
      className="os-alert"
      role="alertdialog"
      aria-modal="true"
      aria-label={alert.title}
    >
      <div className="os-alert-box">
        <div className="flex items-center gap-2 mb-3">
          <span className={`led${danger ? ' led--danger' : ''}`} aria-hidden="true" />
          <h2 className="font-pixel tracking-[0.18em] text-ink uppercase text-sm">{alert.title}</h2>
        </div>
        <p className="font-mono text-sm text-muted leading-relaxed whitespace-pre-wrap">{alert.message}</p>
        <div className="flex justify-end gap-2 mt-5">
          {alert.confirm && (
            <button type="button" className="btn btn-secondary" onClick={() => { click(); dismissAlert(); }}>
              Cancel
            </button>
          )}
          <button type="button" className={danger ? 'btn btn-danger' : 'btn btn-primary'} onClick={confirm} autoFocus>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
