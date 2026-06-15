'use client';

import { useState, useRef, useEffect, type ReactNode } from 'react';

interface TooltipProps {
  children: ReactNode;
  content: ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
}

export function Tooltip({ children, content, side = 'top' }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);

  const show = () => setVisible(true);
  const hide = () => setVisible(false);

  // Close on escape
  useEffect(() => {
    if (!visible) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') hide();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [visible]);

  const sideStyles: Record<string, string> = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  return (
    <div
      ref={triggerRef}
      className="relative inline-flex"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      {visible && (
        <div
          className={`
            absolute z-50 px-2 py-1.5 text-xs rounded-lg shadow-lg
            bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700
            text-gray-900 dark:text-gray-100 whitespace-nowrap
            pointer-events-none animate-fade-in
            ${sideStyles[side] || sideStyles.top}
          `}
        >
          {content}
        </div>
      )}
    </div>
  );
}