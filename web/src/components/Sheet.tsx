'use client';

import { ChevronLeft, X } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';

/**
 * 底部面板：打開時焦點移進面板（data-autofocus 優先，否則關閉鈕），
 * 按 Esc 或點遮罩關閉，關閉後焦點回到原本的按鈕。
 * docked：面板本身不捲，內容放 SheetBody（自己捲）、固定在底部的按鈕放 SheetFooter（例如記一筆的鍵盤）。
 * 畫面很矮（高度 ≤ 520px，例如手機橫放）時不固定：底部那塊放不下還會把內容擠沒，改回整個面板一起捲。
 */
export function Sheet({ open, onClose, labelledBy, docked = false, children }: {
  open: boolean;
  onClose: () => void;
  labelledBy: string;
  docked?: boolean;
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
        className={`fixed inset-x-0 bottom-0 z-30 mx-auto flex max-h-[calc(100dvh-24px)] w-full max-w-[480px] flex-col rounded-t-2xl border-x-[2.5px] border-t-[2.5px] border-ink bg-page motion-safe:animate-[sheet-in_var(--dur-enter)_var(--ease-out)] ${docked
          ? 'overflow-hidden [@media(max-height:520px)]:overflow-y-auto [@media(max-height:520px)]:overscroll-contain'
          : 'gap-[18px] overflow-y-auto overscroll-contain px-5 pt-2.5 pb-[calc(32px+env(safe-area-inset-bottom))] [&>*]:shrink-0'}`}
      >
        <div aria-hidden className={`h-1.5 w-12 flex-none self-center rounded-full bg-ink ${docked ? 'mt-2.5' : ''}`} />
        {children}
      </section>
    </>
  );
}

/** docked 面板的內容區：超過高度時只有這裡捲。last：下面沒有 SheetFooter 時，底部留出安全區。間距由 className 給 */
export function SheetBody({ children, last = false, className = '' }: { children: ReactNode; last?: boolean; className?: string }) {
  return (
    <div className={`flex min-h-0 flex-auto flex-col overflow-y-auto overscroll-contain px-5 pt-3 [&>*]:shrink-0 [@media(max-height:520px)]:flex-none [@media(max-height:520px)]:overflow-visible ${last ? 'pb-[calc(32px+env(safe-area-inset-bottom))]' : 'pb-4'} ${className}`}>
      {children}
    </div>
  );
}

/** docked 面板固定在底部的區塊：上面的內容怎麼捲，這裡都按得到 */
export function SheetFooter({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-none flex-col gap-2.5 border-t-2 border-line bg-page px-5 pt-3 pb-[calc(12px+env(safe-area-inset-bottom))]">
      {children}
    </div>
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
          <h2 id={id} className="flex items-baseline gap-2.5 font-display text-title-m leading-[1.3] tracking-[.1em]">
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
