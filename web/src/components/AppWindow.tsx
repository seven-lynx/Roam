'use client';

import { useEffect } from 'react';
import { useWorkstation } from '@/components/WorkstationContext';
import { Window } from '@/components/Window';

/** Append the bare-render flag so an internal route loads without the OS shell. */
function withEmbed(url: string): string {
  return url.includes('?') ? `${url}&embed=1` : `${url}?embed=1`;
}

/**
 * The app-style window for internal roamtheweb.app pages. Unlike the ROAM
 * browser (which frames external sites with a rating/save toolbar), this is a
 * plain OS window whose body is the bare page — so every internal route gets
 * real window chrome (drag / minimize / close) without shell-in-shell nesting.
 */
export function AppWindow() {
  const { appView, closeAppView, windows } = useWorkstation();
  const open = !!windows.webapp;

  // Closing via the title-bar ✕ clears the app view.
  useEffect(() => {
    if (!open && appView) closeAppView();
  }, [open, appView, closeAppView]);

  if (!appView) return null;

  return (
    <Window id="webapp" icon={<span aria-hidden="true">◉</span>}>
      <div className="browser-frame">
        <iframe
          key={appView.url}
          src={withEmbed(appView.url)}
          title={appView.title}
          className="browser-iframe"
          referrerPolicy="no-referrer"
        />
      </div>
    </Window>
  );
}
