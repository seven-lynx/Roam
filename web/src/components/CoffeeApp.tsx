'use client';

import { useWorkstation } from '@/components/WorkstationContext';
import { Window } from '@/components/Window';
import { BuyMeACoffeeButton } from '@/components/BuyMeACoffeeButton';

/** Diegetic "REFUEL" window — the support/tip surface for the OS. */
export function CoffeeApp() {
  const { isOpen } = useWorkstation();

  if (!isOpen('coffee')) return null;

  return (
    <Window id="coffee" icon={<span aria-hidden="true">☕</span>}>
      <div className="window-scroll">
        <div className="p-5 flex flex-col gap-4">
          <p className="font-pixel tracking-[0.18em] text-accent text-sm">REFUEL</p>
          <p className="font-mono text-sm text-muted leading-relaxed">
            Roam is free, open source and ad-free. If it&rsquo;s helped you discover something new, help keep it running.
          </p>
          <BuyMeACoffeeButton />
        </div>
      </div>
    </Window>
  );
}
