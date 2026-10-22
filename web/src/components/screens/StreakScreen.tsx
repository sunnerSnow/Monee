'use client';

import { ChevronLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useActivity, useMarkNoSpend } from '@/lib/data';
import { monthLabel, shiftMonth, toISODate } from '@/lib/dates';
import { canMarkNoSpend, MILESTONES, monthDays, streakOf, type Activity } from '@/lib/streak';
import { useUi } from '@/lib/ui-store';
import { useNow } from '@/lib/use-now';
import { SealShape } from '../Seal';
import { Badge, DayMark, dayStatus, nextMilestone } from '../Streak';
import { ErrorBox, MonthSwitch, SectionHeader } from '../ui';

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

/** 最早有資料的月份：月曆最多翻到這裡 */
const firstMonth = (a: Activity, fallback: string) => [a.logged[0], [...a.noSpend].sort()[0]].filter(Boolean).sort()[0]?.slice(0, 7) ?? fallback;

/** 記帳月曆：連續天數、每個月哪幾天有記帳、無消費日（沒花錢的日子點一下蓋章），還有徽章 */
export function StreakScreen() {
  const router = useRouter();
  const now = useNow();
  const { data, isPending, error, refetch } = useActivity();
  const back = () => (window.history.length > 1 ? router.back() : router.push('/'));

  return (
    <>
      <header className="flex min-h-12 items-center gap-1">
        <button type="button" onClick={back} aria-label="返回" className="icon-btn ghost press">
          <ChevronLeft size={20} strokeWidth={1.5} aria-hidden />
        </button>
        <h1 className="h-page">記帳月曆<span className="en">Streak</span></h1>
      </header>
      {error ? <ErrorBox message={error.message} onRetry={() => refetch()} />
        : !now || isPending ? <div aria-busy="true" className="skeleton h-96" />
        : <Calendar activity={data} today={toISODate(now)} />}
    </>
  );
}

function Calendar({ activity, today }: { activity: Activity; today: string }) {
  const mark = useMarkNoSpend();
  const showToast = useUi((s) => s.showToast);
  const current = today.slice(0, 7);
  const [month, setMonth] = useState(current);
  const s = streakOf(activity, today);
  const earliest = firstMonth(activity, current);
  const { blanks, days } = monthDays(month);
  const noSpendCount = days.filter((d) => s.days.get(d) === 'nospend').length;
  const next = nextMilestone(s.current);

  const toggle = (date: string) => {
    const on = s.days.get(date) !== 'nospend';
    mark.mutate({ date, on }, { onError: (e) => showToast(e.message) });
  };

  const stat = (label: string, value: number) => (
    <div className="flex flex-col items-center gap-1 px-1 py-3 text-center">
      <span className="caption">{label}</span>
      <span className="flex items-baseline gap-1"><span className="font-fun text-[30px] leading-none">{value}</span><span className="font-display text-body-s">天</span></span>
    </div>
  );

  return (
    <>
      <section aria-label="統計" className="card grid grid-cols-3 divide-x divide-line">
        {stat('目前連續', s.current)}
        {stat('最長紀錄', s.longest)}
        {stat(`${monthLabel(month)}無消費`, noSpendCount)}
      </section>

      <section aria-label="月曆" className="card flex flex-col gap-2 p-3">
        <MonthSwitch
          month={month}
          onPrev={() => setMonth(shiftMonth(month, -1))}
          onNext={() => setMonth(shiftMonth(month, 1))}
          canPrev={month > earliest}
          canNext={month < current}
        />
        <div aria-hidden className="grid grid-cols-7 text-center text-caption text-muted">
          {WEEKDAYS.map((w) => <span key={w} className="py-1">{w}</span>)}
        </div>
        <div className="grid grid-cols-7 gap-y-1">
          {Array.from({ length: blanks }, (_, i) => <span key={`blank-${i}`} aria-hidden />)}
          {days.map((d) => {
            const isToday = d === today;
            const markEl = (
              <DayMark kind={d <= today ? s.days.get(d) : undefined} future={d > today} isToday={isToday}>
                <span className={isToday ? 'underline decoration-2 underline-offset-4' : ''}>{Number(d.slice(8))}</span>
              </DayMark>
            );
            const label = `${dayStatus(s, d, today)}${isToday ? '，今天' : ''}`;
            return (
              <div key={d} className="flex h-12 items-center justify-center">
                {canMarkNoSpend(s, d, today) ? (
                  <button type="button" onClick={() => toggle(d)} aria-pressed={s.days.get(d) === 'nospend'} aria-label={`${label}，點一下${s.days.get(d) === 'nospend' ? '拿掉' : '蓋上'}無消費章`} className="press flex size-11 items-center justify-center rounded-full">
                    <span aria-hidden className="contents">{markEl}</span>
                  </button>
                ) : (
                  <span role="img" aria-label={label} className="flex size-11 items-center justify-center">{markEl}</span>
                )}
              </div>
            );
          })}
        </div>
        <ul aria-label="圖例" className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 border-t border-line px-1 pt-3 text-caption text-muted">
          <li className="flex items-center gap-1.5"><span aria-hidden className="inline-block size-4 rounded-full border-2 border-ink bg-teal" />有記帳</li>
          <li className="flex items-center gap-1.5"><SealShape fill="var(--yellow)" spikes={14} className="size-5" />無消費</li>
          <li className="flex items-center gap-1.5"><span aria-hidden className="inline-block size-4 rounded-full border-2 border-dashed border-dash" />沒記帳</li>
        </ul>
      </section>
      <p className="caption -mt-2 px-1 leading-[1.8]">
        沒花錢的日子點一下蓋上無消費章，再點一次拿掉；有支出的日子不能蓋。記一筆或蓋章的日子都算進連續天數，補記以前的帳也算。固定收支自動記的不算。
      </p>

      <section aria-labelledby="badge-title" className="flex flex-col gap-2.5">
        <SectionHeader id="badge-title" title="徽章" en="Badges" />
        <ul className="card grid grid-cols-4 gap-1 px-2 py-4">
          {MILESTONES.map((m) => {
            const earned = s.longest >= m;
            return (
              <li key={m} className="flex flex-col items-center gap-2 text-center">
                <Badge days={m} earned={earned} />
                <span className="caption leading-[1.5]">{earned ? '拿到了' : m === next ? `還差 ${m - s.current} 天` : `連續 ${m} 天`}</span>
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}
