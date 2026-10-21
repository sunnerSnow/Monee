'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useId, type ButtonHTMLAttributes, type CSSProperties, type ReactNode } from 'react';
import { monthTitle } from '@/lib/dates';
import { splitMoney } from '@/lib/money';
import { useUi } from '@/lib/ui-store';
import { Mascot, type Mood } from './Mascot';

export const useHidden = () => useUi((s) => s.hidden);

/** 使用者頭像：使用者挑的角色放在黃色圓形裡；外層按鈕或連結負責無障礙名稱 */
export function Avatar({ size }: { size: number }) {
  return (
    <span className="flex flex-none items-end justify-center overflow-hidden rounded-full border-[2.5px] border-ink bg-brand" style={{ width: size, height: size }}>
      <Mascot className="-mb-[18%] w-[118%] max-w-none flex-none" />
    </span>
  );
}

/** 泡泡字 Logo：每個字母一個顏色、粗黑描邊、各自歪一點 */
const LOGO: [string, string, number][] = [['M', 'var(--teal)', -6], ['O', 'var(--pink)', 4], ['N', 'var(--yellow)', -3], ['E', 'var(--green)', 5], ['E', 'var(--purple)', -4]];
export function BubbleLogo({ className = '' }: { className?: string }) {
  return (
    <span aria-hidden className={`inline-flex leading-none ${className}`}>
      {LOGO.map(([ch, color, deg], i) => (
        <span key={i} className="fun-text inline-block" style={{ color, transform: `rotate(${deg}deg) translateY(${i % 2 ? -2 : 1}px)` }}>{ch}</span>
      ))}
    </span>
  );
}

/** 大金額：$ 縮成上標；fun 是首頁今日卡片用的卡通大字（黃字黑描邊）；隱藏模式顯示 •••• */
export function BigMoney({ value, className = '', fun = false }: { value: number; className?: string; fun?: boolean }) {
  const hidden = useHidden();
  const { sign, digits } = splitMoney(value, hidden);
  return (
    <p className={`m-0 ${fun ? 'fun-text text-brand' : 'display'} ${className}`}>
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
 * 今日卡片：傾斜的藍綠色漫畫格，右上角是使用者挑的角色（表情跟著預算狀態），下半是白底的額度列。
 * 藍綠底上放白字對比不夠，上半的字一律墨色（--text-2 也換成墨色）。tag 是裝飾用的塗鴉小字。
 */
export function HeroCard({ labelledBy, top, bottom, mood = 'ok', tag }: {
  labelledBy: string;
  top: ReactNode;
  bottom: ReactNode;
  mood?: Mood;
  tag?: string;
}) {
  return (
    <section aria-labelledby={labelledBy} className="sticker panel relative -rotate-[1.5deg] overflow-hidden bg-teal" style={{ '--text-2': 'var(--ink)' } as CSSProperties}>
      <div className="relative flex min-h-[160px] flex-col gap-1.5 px-5 pt-5 pb-4">
        <Mascot mood={mood} className="pointer-events-none absolute -top-1 -right-3 w-[128px] rotate-[8deg] select-none" />
        {tag && <span aria-hidden className="tag-text absolute right-5 bottom-2 -rotate-6 text-[22px] text-pink">{tag}</span>}
        <div className="relative flex flex-col gap-1.5 pr-[112px]">{top}</div>
      </div>
      <div className="relative flex flex-col gap-3 border-t-[3px] border-ink bg-surface px-5 pt-4 pb-[18px]">{bottom}</div>
    </section>
  );
}

/**
 * 開關列：整列都能點（不只右邊的小開關），螢幕閱讀器唸標題當名稱、說明另外唸。
 * 其他屬性（例如 data-split-switch）放在按鈕上。
 */
export function SwitchRow({ title, hint, checked, onChange, ...rest }: {
  title: string;
  hint: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onChange' | 'title'>) {
  const id = useId();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-hint`}
      onClick={() => onChange(!checked)}
      className="press flex min-h-14 w-full items-center justify-between gap-3 rounded-lg border border-line bg-surface px-4 py-2 text-left disabled:opacity-60"
      {...rest}
    >
      <span className="flex min-w-0 flex-col gap-0.5">
        <span id={`${id}-title`} className="text-body">{title}</span>
        <span id={`${id}-hint`} className="caption leading-[1.7]">{hint}</span>
      </span>
      <span aria-hidden className="switch" />
    </button>
  );
}
