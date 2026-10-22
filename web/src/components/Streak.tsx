'use client';

import { ArrowRight, Check } from 'lucide-react';
import Link from 'next/link';
import { useEffect, type ReactNode } from 'react';
import { useActivity, useMarkNoSpend } from '@/lib/data';
import { dayName, MILESTONES, streakOf, weekdayLabel, weekOf, type DayKind, type Streak } from '@/lib/streak';
import { useUi } from '@/lib/ui-store';
import { Mascot } from './Mascot';
import { SealShape } from './Seal';

/** 徽章的顏色：7 天黃、30 天粉紅、100 天藍綠、365 天紫 */
const BADGE_COLORS: Record<number, string> = { 7: 'var(--yellow)', 30: 'var(--pink)', 100: 'var(--teal)', 365: 'var(--purple)' };
const CHEER_KEY = 'monee-streak-cheer';

/** 報讀用：10月18日 星期六，無消費 */
export function dayStatus(s: Streak, date: string, today: string) {
  if (date > today) return dayName(date);
  const kind = s.days.get(date);
  return `${dayName(date)}，${kind === 'logged' ? '有記帳' : kind === 'nospend' ? '無消費' : '沒記帳'}`;
}

/** 下一個要拿的徽章；365 天都拿過了就沒有 */
export const nextMilestone = (current: number) => MILESTONES.find((m) => m > current) ?? null;

/**
 * 一天的標記：有記帳是藍綠色圓、無消費是黃色鋸齒章、沒記是虛線圈、還沒到的淡淡的。
 * children 是裡面的字（月曆放日期）；沒給的話有記帳打勾、無消費寫 $0
 */
export function DayMark({ kind, future, isToday, children }: { kind?: DayKind; future: boolean; isToday: boolean; children?: ReactNode }) {
  if (kind === 'nospend') {
    return (
      <span className="relative inline-flex size-10 items-center justify-center">
        <SealShape fill="var(--yellow)" spikes={14} className="absolute inset-0 size-full" />
        <span className="num relative text-[13px] text-ink">{children ?? '$0'}</span>
      </span>
    );
  }
  const base = 'num inline-flex size-9 items-center justify-center rounded-full text-[14px]';
  if (kind === 'logged') return <span className={`${base} border-2 border-ink bg-teal text-ink`}>{children ?? <Check size={18} strokeWidth={2.5} aria-hidden />}</span>;
  if (future) return <span className={`${base} bg-fill text-muted opacity-60`}>{children}</span>;
  return <span className={`${base} border-2 border-dashed text-muted ${isToday ? 'border-ink' : 'border-dash'}`}>{children}</span>;
}

/** 鋸齒徽章：拿到的有顏色，還沒拿到的灰灰的 */
export function Badge({ days, earned, className = 'size-[72px]' }: { days: number; earned: boolean; className?: string }) {
  return (
    <span className={`relative inline-flex flex-none items-center justify-center ${className}`}>
      <SealShape fill={earned ? BADGE_COLORS[days] : 'var(--fill)'} className={`absolute inset-0 size-full ${earned ? '' : 'opacity-50'}`} />
      <span className={`relative flex flex-col items-center leading-none ${earned ? 'text-ink' : 'text-muted'}`}>
        <span className="font-fun text-[22px]">{days}</span>
        <span className="font-display text-[12px]">天</span>
      </span>
    </span>
  );
}

/** 首頁：連續記帳天數、這一週、「今天沒花錢」；剛好連續 7、30、100、365 天時角色慶祝 */
export function StreakCard({ today }: { today: string }) {
  const { data, isPending, isError } = useActivity();
  const mark = useMarkNoSpend();
  const showToast = useUi((s) => s.showToast);
  const s = data && streakOf(data, today);
  const milestone = s?.milestone ?? null;

  // 達成那天提示一次（換手機或清掉瀏覽器資料會再提示，沒關係）
  useEffect(() => {
    if (!milestone) return;
    const key = `${today}:${milestone}`;
    try {
      if (localStorage.getItem(CHEER_KEY) === key) return;
      localStorage.setItem(CHEER_KEY, key);
    } catch {
      // 存不了（無痕模式）就每次都提示
    }
    showToast(`連續記帳 ${milestone} 天！拿到 ${milestone} 天徽章`);
  }, [milestone, today, showToast]);

  if (isPending) return <div aria-busy="true" className="skeleton h-[196px]" />;
  // 讀不到（例如資料庫還沒更新）就先不顯示，不影響首頁其他東西
  if (isError || !s) return null;

  const toggleToday = (on: boolean) => mark.mutate({ date: today, on }, { onError: (e) => showToast(e.message) });
  const todayKind = s.days.get(today);
  const next = nextMilestone(s.current);

  return (
    <section aria-labelledby="streak-title" className="card flex flex-col gap-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 id="streak-title" className="m-0 font-display text-body tracking-[.12em]">連續記帳</h2>
          <p aria-live="polite" className="flex flex-wrap items-baseline gap-x-1.5">
            <span className="fun-text text-[44px] leading-[1.1] text-brand">{s.current}</span>
            <span className="font-display text-body">天</span>
            <span className="caption ml-2">最長 {s.longest} 天</span>
          </p>
        </div>
        <Link href="/streak" className="press -mr-1 inline-flex min-h-11 flex-none items-center gap-1 px-1 text-body-s tracking-[.08em]">
          月曆<ArrowRight size={16} strokeWidth={1.5} aria-hidden />
        </Link>
      </div>

      <ol aria-label="這一週" className="grid grid-cols-7">
        {weekOf(today).map((d) => {
          const isToday = d === today;
          return (
            <li key={d} className="flex flex-col items-center gap-1.5">
              <span aria-hidden className={`rounded-full px-1.5 text-caption ${isToday ? 'bg-ink text-surface' : 'text-muted'}`}>{weekdayLabel(d)}</span>
              <span aria-hidden className="flex h-10 items-center"><DayMark kind={d <= today ? s.days.get(d) : undefined} future={d > today} isToday={isToday} /></span>
              <span className="sr-only">{dayStatus(s, d, today)}{isToday ? '，今天' : ''}</span>
            </li>
          );
        })}
      </ol>

      {milestone ? (
        <div className="flex items-center gap-3 rounded-md border-2 border-ink bg-cream px-3 py-2 text-ink">
          <Badge days={milestone} earned className="size-14" />
          <p className="flex-1 font-display text-body-s leading-[1.7] tracking-[.06em]">連續 {milestone} 天達成！<br />徽章收進月曆頁了</p>
          <Mascot mood="yay" className="-my-3 w-16 flex-none rotate-6" />
        </div>
      ) : !s.todayDone || todayKind === 'nospend' ? (
        <div className="flex items-center justify-between gap-3">
          <p className="caption leading-[1.7]">
            {todayKind === 'nospend' ? '今天沒花錢，蓋上無消費章了' : s.current ? '今天還沒記。記一筆或按沒花錢，連續就不會斷' : '今天記一筆，開始連續記帳'}
          </p>
          {todayKind === 'nospend' ? (
            <button type="button" onClick={() => toggleToday(false)} aria-label="拿掉今天的無消費章" className="btn-secondary press flex-none">拿掉</button>
          ) : (
            <button type="button" onClick={() => toggleToday(true)} className="btn-secondary press flex-none">今天沒花錢</button>
          )}
        </div>
      ) : (
        <p className="caption leading-[1.7]">今天記過了{next ? `，再 ${next - s.current} 天拿 ${next} 天徽章` : '，365 天徽章也拿到了'}</p>
      )}
    </section>
  );
}
