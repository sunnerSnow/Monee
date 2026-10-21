'use client';

import { useUi } from '@/lib/ui-store';

export function Toast() {
  const message = useUi((s) => s.toast);
  return (
    <div
      role="status"
      aria-live="polite"
      className={`pointer-events-none fixed bottom-[calc(108px+env(safe-area-inset-bottom))] left-1/2 z-40 max-w-[calc(100%-40px)] -translate-x-1/2 truncate rounded-full border-2 border-ink bg-brand px-[18px] py-2.5 font-display text-[14px] text-ink shadow-[var(--pop-sm)] transition-opacity duration-[var(--dur-fade)] ${message ? 'opacity-100' : 'opacity-0'}`}
    >
      {message}
    </div>
  );
}
