'use client';

import { ChevronLeft, X } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';

/**
 * 底部面板：打開時焦點移進面板（data-autofocus 優先，否則關閉鈕），
 * 按 Esc 或點遮罩關閉，關閉後焦點回到原本的按鈕。
 */
export function Sheet({ open, onClose, labelledBy, children }: {
  open: boolean;
  onClose: () => void;
  labelledBy: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const target = ref.current?.querySelector<HTMLElement>('[data-autofocus]') ?? ref.current?.querySelector<HTMLElement>('[data-close]');
    target?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <>
      <button
        type="button"
        tabIndex={-1}
        aria-label="關閉面板"
        onClick={onClose}
        className="fixed inset-0 z-20 bg-[var(--scrim)] motion-safe:animate-[fade-in_var(--dur-fade)_ease-out]"
      />
      <section
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        // [&>*]:shrink-0：內容超過高度時改成捲動，不要把可左右捲動的按鈕列壓成 0 高度
        className="fixed inset-x-0 bottom-0 z-30 mx-auto flex max-h-[calc(100dvh-24px)] w-full max-w-[480px] flex-col gap-[18px] overflow-y-auto overscroll-contain rounded-t-2xl bg-page px-5 pt-2.5 pb-[calc(32px+env(safe-area-inset-bottom))] motion-safe:animate-[sheet-in_var(--dur-enter)_var(--ease-out)] [&>*]:shrink-0"
      >
        <div aria-hidden className="h-1 w-9 flex-none self-center rounded-full bg-line-strong" />
        {children}
      </section>
    </>
  );
}

export function SheetHeader({ id, title, en, sub, onClose, onBack }: {
  id: string;
  title: string;
  en: string;
  sub?: string;
  onClose: () => void;
  onBack?: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2">
        {onBack && (
          <button type="button" onClick={onBack} aria-label="回上一步" className="icon-btn ghost press">
            <ChevronLeft size={20} strokeWidth={1.5} aria-hidden />
          </button>
        )}
        <div>
          <h2 id={id} className="flex items-baseline gap-2.5 text-title-m font-medium leading-[1.3] tracking-[.14em]">
            {title}<span className="en">{en}</span>
          </h2>
          {sub && <p className="caption mt-1">{sub}</p>}
        </div>
      </div>
      <button type="button" onClick={onClose} aria-label="關閉" data-close className="icon-btn press">
        <X size={20} strokeWidth={1.5} aria-hidden />
      </button>
    </div>
  );
}
