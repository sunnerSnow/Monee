'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { monthTitle, shiftMonth, toISODate } from '@/lib/dates';

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

const parse = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const addDays = (iso: string, n: number) => {
  const d = parse(iso);
  d.setDate(d.getDate() + n);
  return toISODate(d);
};
const daysBetween = (a: string, b: string) => Math.round((parse(b).getTime() - parse(a).getTime()) / 86_400_000);
/** 10/7（三）；不是今年就加上年份 */
const boxDate = (iso: string) => {
  const d = parse(iso);
  const year = d.getFullYear() === new Date().getFullYear() ? '' : `${d.getFullYear()}/`;
  return `${year}${d.getMonth() + 1}/${d.getDate()}（${WEEKDAYS[d.getDay()]}）`;
};

/**
 * 旅程的出發與回來：在月曆上先點出發日、再點回來日，中間的日子會標出來。
 * 點上面的「出發」「回來」可以只改其中一個。鍵盤可以用方向鍵移動日期、Page Up/Down 換月。
 */
export function RangeCalendar({ start, end, onChange }: {
  start: string;
  /** null：出發日選好了，還沒選回來 */
  end: string | null;
  onChange: (start: string, end: string | null) => void;
}) {
  const [picking, setPicking] = useState<'start' | 'end'>(end ? 'start' : 'end');
  const [month, setMonth] = useState(start.slice(0, 7));
  // 方向鍵移動的焦點日期（同一時間只有一個日期按鈕可以 Tab 進來）
  const [focusDay, setFocusDay] = useState(start);
  const moved = useRef(false);
  const grid = useRef<HTMLDivElement>(null);
  const today = toISODate(new Date());

  useEffect(() => {
    if (!moved.current) return;
    moved.current = false;
    grid.current?.querySelector<HTMLElement>(`[data-day="${focusDay}"]`)?.focus();
  }, [focusDay, month]);

  const pick = (iso: string) => {
    setFocusDay(iso);
    if (picking === 'start') {
      // 新的出發日沒有超過回來日就保留回來日，接著可以改回來日
      onChange(iso, end && iso <= end ? end : null);
      setPicking('end');
    } else if (iso < start) {
      onChange(iso, null);
    } else {
      onChange(start, iso);
      setPicking('start');
    }
  };

  const moveFocus = (iso: string) => {
    moved.current = true;
    setFocusDay(iso);
    if (iso.slice(0, 7) !== month) setMonth(iso.slice(0, 7));
  };
  const onKey = (e: KeyboardEvent) => {
    const step: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (e.key in step) moveFocus(addDays(focusDay, step[e.key]));
    else if (e.key === 'PageUp' || e.key === 'PageDown') {
      // 換到上／下個月的同一天；那個月沒有這一天（例如 3/31 → 2 月）就停在月底
      const key = shiftMonth(focusDay.slice(0, 7), e.key === 'PageUp' ? -1 : 1);
      const last = new Date(Number(key.slice(0, 4)), Number(key.slice(5, 7)), 0).getDate();
      moveFocus(`${key}-${String(Math.min(Number(focusDay.slice(8, 10)), last)).padStart(2, '0')}`);
    } else if (e.key === 'Home') moveFocus(addDays(focusDay, -parse(focusDay).getDay()));
    else if (e.key === 'End') moveFocus(addDays(focusDay, 6 - parse(focusDay).getDay()));
    else return;
    e.preventDefault();
  };
  const goMonth = (n: number) => {
    const next = shiftMonth(month, n);
    setMonth(next);
    setFocusDay(`${next}-01`);
  };

  const first = parse(`${month}-01`);
  const total = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const days = Array.from({ length: total }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`);
  // 焦點日期不在這個月時，讓這個月的 1 號可以 Tab 進來
  const tabDay = focusDay.slice(0, 7) === month ? focusDay : days[0];
  const length = end ? daysBetween(start, end) + 1 : 0;

  const box = (which: 'start' | 'end', label: string, value: string | null) => (
    <button
      type="button"
      aria-pressed={picking === which}
      onClick={() => { setPicking(which); const d = value ?? start; setMonth(d.slice(0, 7)); setFocusDay(d); }}
      className={`press flex min-h-14 min-w-0 flex-col items-start justify-center gap-0.5 rounded-sm bg-surface py-1.5 text-left ${picking === which ? 'border-2 border-fg px-[11px]' : 'border border-line px-3'}`}
    >
      <span className="caption">{label}</span>
      <span className={`num truncate text-body ${value ? '' : 'text-muted'}`}>{value ? boxDate(value) : '點月曆選日期'}</span>
    </button>
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2">
        {box('start', '出發', start)}
        {box('end', '回來', end)}
      </div>
      <p aria-live="polite" className="-mt-1 px-1 text-caption leading-[1.8] text-muted">
        {picking === 'end' ? '接著點回來的日期' : `共 ${length} 天・點日期可以重新選出發日`}
      </p>

      <div className="card flex flex-col gap-1 p-3">
        <div className="flex items-center justify-between">
          <button type="button" onClick={() => goMonth(-1)} aria-label="上個月" className="icon-btn ghost press">
            <ChevronLeft size={18} strokeWidth={1.5} aria-hidden />
          </button>
          <span aria-live="polite" className="text-body">{monthTitle(month)}</span>
          <button type="button" onClick={() => goMonth(1)} aria-label="下個月" className="icon-btn ghost press">
            <ChevronRight size={18} strokeWidth={1.5} aria-hidden />
          </button>
        </div>
        <div aria-hidden className="grid grid-cols-7 text-center text-caption text-muted">
          {WEEKDAYS.map((w) => <span key={w} className="py-1">{w}</span>)}
        </div>
        <div ref={grid} role="group" aria-label={monthTitle(month)} onKeyDown={onKey} className="grid grid-cols-7">
          {Array.from({ length: first.getDay() }, (_, i) => <span key={`blank-${i}`} aria-hidden />)}
          {days.map((iso) => {
            const isStart = iso === start;
            const isEnd = iso === end;
            const inside = Boolean(end) && iso > start && iso < end!;
            const ranged = Boolean(end) && end !== start;
            const d = parse(iso);
            const band = inside ? 'inset-x-0' : isStart && ranged ? 'left-1/2 right-0' : isEnd && ranged ? 'left-0 right-1/2' : '';
            return (
              <div key={iso} className="relative flex h-11 items-center justify-center">
                {band && <span aria-hidden className={`absolute inset-y-0.5 bg-fill ${band}`} />}
                <button
                  type="button"
                  data-day={iso}
                  tabIndex={iso === tabDay ? 0 : -1}
                  aria-pressed={isStart || isEnd}
                  aria-label={`${d.getMonth() + 1}月${d.getDate()}日 星期${WEEKDAYS[d.getDay()]}${iso === today ? '，今天' : ''}${isStart ? '，出發' : ''}${isEnd ? '，回來' : ''}${inside ? '，旅程中' : ''}`}
                  onClick={() => pick(iso)}
                  className={`press num relative size-10 rounded-full text-[15px] ${isStart || isEnd ? 'bg-primary text-on-primary' : ''} ${iso === today && !isStart && !isEnd ? 'underline decoration-2 underline-offset-4' : ''}`}
                >
                  {d.getDate()}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
