'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import Image from 'next/image';
import type { ReactNode } from 'react';
import { monthTitle } from '@/lib/dates';
import { splitMoney } from '@/lib/money';
import { useUi } from '@/lib/ui-store';

export const useHidden = () => useUi((s) => s.hidden);

/** 大金額：$ 縮成上標、數字細體；隱藏模式顯示 •••• */
export function BigMoney({ value, className = '' }: { value: number; className?: string }) {
  const hidden = useHidden();
  const { sign, digits } = splitMoney(value, hidden);
  return (
    <p className={`display m-0 ${className}`}>
      <small>$</small>{sign}{digits}
    </p>
  );
}

export function PageHeader({ title, en, action }: { title: string; en: string; action?: ReactNode }) {
  return (
    <header className="flex min-h-12 items-center justify-between gap-3">
      <h1 className="h-page">{title}<span className="en">{en}</span></h1>
      {action}
    </header>
  );
}

export function SectionHeader({ id, title, en, action }: { id: string; title: string; en: string; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between px-1">
      <h2 id={id} className="h-sec">{title}<span className="en">{en}</span></h2>
      {action}
    </div>
  );
}

export function EmptyBox({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="empty-box">
      <p className="text-body font-medium">{title}</p>
      <p className="text-body-s leading-[1.8] text-muted">{children}</p>
    </div>
  );
}

export function LoadingBlocks() {
  return (
    <div aria-busy="true" aria-label="載入中" className="flex flex-col gap-5">
      <div className="skeleton h-12 w-2/5" />
      <div className="skeleton h-48" />
      <div className="skeleton h-64" />
    </div>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="empty-box">
      <p className="text-body font-medium">資料載入失敗</p>
      <p className="text-body-s leading-[1.8] text-muted">{message}</p>
      <button type="button" onClick={onRetry} className="btn-secondary press mt-2 self-start">再試一次</button>
    </div>
  );
}

export function MonthSwitch({ month, onPrev, onNext, canPrev, canNext }: {
  month: string;
  onPrev: () => void;
  onNext: () => void;
  canPrev: boolean;
  canNext: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <button type="button" onClick={onPrev} disabled={!canPrev} aria-label="上個月" className="icon-btn ghost press">
        <ChevronLeft size={20} strokeWidth={1.5} aria-hidden />
      </button>
      <span className="text-body tracking-[.1em]" aria-live="polite">{monthTitle(month)}</span>
      <button type="button" onClick={onNext} disabled={!canNext} aria-label="下個月" className="icon-btn ghost press">
        <ChevronRight size={20} strokeWidth={1.5} aria-hidden />
      </button>
    </div>
  );
}

/**
 * 今日卡片外框：上半右上角是招牌黃圓塊與吉祥物，吉祥物底邊貼齊上下兩區的分隔線
 * （圖檔底部被切到，一定要貼齊分隔線，見 MASTER.md「吉祥物」）。
 */
export function HeroCard({ labelledBy, top, bottom }: { labelledBy: string; top: ReactNode; bottom: ReactNode }) {
  return (
    <section aria-labelledby={labelledBy} className="relative overflow-hidden rounded-xl border border-line bg-surface">
      <div className="relative flex min-h-[152px] flex-col gap-1.5 px-5 pt-[22px] pb-[18px]">
        <span aria-hidden className="absolute -top-[84px] -right-[90px] h-60 w-60 rounded-full bg-brand" />
        <Image
          src="/monee.png"
          alt=""
          width={124}
          height={90}
          priority
          className="pointer-events-none absolute right-1.5 bottom-0 h-auto w-[124px] select-none"
        />
        <div className="relative flex flex-col gap-1.5 pr-[130px]">{top}</div>
      </div>
      <div className="relative flex flex-col gap-3 border-t border-line bg-surface px-5 pt-4 pb-[18px]">{bottom}</div>
    </section>
  );
}
