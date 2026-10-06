'use client';

import { useUi } from '@/lib/ui-store';

export function Toast() {
  const message = useUi((s) => s.toast);
  return (
    <div
      role="status"
      aria-live="polite"
      className={`pointer-events-none fixed bottom-[calc(108px+env(safe-area-inset-bottom))] left-1/2 z-40 max-w-[calc(100%-40px)] -translate-x-1/2 truncate rounded-full bg-fg px-[18px] py-2.5 text-body-s text-surface transition-opacity duration-[var(--dur-fade)] ${message ? 'opacity-100' : 'opacity-0'}`}
    >
      {message}
    </div>
  );
}
