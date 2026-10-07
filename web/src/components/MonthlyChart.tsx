'use client';

import { useState } from 'react';
import { monthLabel } from '@/lib/dates';
import { formatMoney, money } from '@/lib/money';

/** budget 是該月自己的預算（從某月起生效，各月可能不同）；沒有預算為 null */
interface Point { key: string; value: number; budget: number | null; /** 跟預算比的部分（扣掉不算進預算的旅程） */ budgetValue?: number }

// 圖表規格（dataviz）：單一系列一個顏色、直條 ≤ 24px、頂端 4px 圓角、細線格線、預算用每月一段的虛線
const W = 310;
const H = 186;
const L = 40;
const R = 6;
const T = 22;
const B = 156;
const BAR = 20;

const niceMax = (v: number) => {
  const step = v <= 10000 ? 2000 : v <= 50000 ? 10000 : 50000;
  return Math.max(step * 3, Math.ceil((v * 1.1) / step) * step);
};

export function MonthlyChart({ points, currentKey, hidden }: {
  points: Point[];
  currentKey: string;
  hidden: boolean;
}) {
  const [active, setActive] = useState<number | null>(null);
  const max = niceMax(Math.max(...points.map((p) => Math.max(p.value, p.budget ?? 0))));
  const y = (v: number) => B - (v / max) * (B - T);
  const slot = (W - L - R) / points.length;
  const ticks = [0, max / 3, (max / 3) * 2, max];
  const tip = (p: Point) => {
    const note = p.key === currentKey
      ? '，月份進行中'
      : p.budget && (p.budgetValue ?? p.value) > p.budget ? `，超出預算 ${money((p.budgetValue ?? p.value) - p.budget, hidden)}` : '';
    const budgetText = p.budget ? `（預算 ${money(p.budget, hidden)}）` : '';
    return `${monthLabel(p.key)}支出 ${money(p.value, hidden)}${budgetText}${note}`;
  };
  const activePoint = active === null ? null : points[active];

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full overflow-visible" role="group" aria-label="每月支出直條圖">
        <g stroke="var(--line)" strokeWidth={1}>
          {ticks.map((v) => <line key={v} x1={L} x2={W - R} y1={y(v)} y2={y(v)} />)}
        </g>
        {ticks.map((v) => (
          <text key={v} x={L - 8} y={y(v) + 4} textAnchor="end" className="num" fontSize={12} fill="var(--text-2)">
            {hidden ? '' : v ? `${Math.round(v / 1000)}k` : '0'}
          </text>
        ))}
        {points.map((p, i) => {
          const cx = L + slot * i + slot / 2;
          const x = cx - BAR / 2;
          const top = y(p.value);
          const r = Math.min(4, B - top);
          const current = p.key === currentKey;
          return (
            <g key={p.key}>
              {/* 該月預算：只畫在這個月的範圍內，預算調整時虛線會跟著高低變化 */}
              {p.budget && (
                <line
                  x1={L + slot * i + 3}
                  x2={L + slot * (i + 1) - 3}
                  y1={y(p.budget)}
                  y2={y(p.budget)}
                  stroke="var(--text-2)"
                  strokeWidth={1}
                  strokeDasharray="4 3"
                />
              )}
              {p.value > 0 && (
                <path
                  d={`M${x},${B}V${top + r}Q${x},${top} ${x + r},${top}H${x + BAR - r}Q${x + BAR},${top} ${x + BAR},${top + r}V${B}Z`}
                  fill={current ? 'var(--text-2)' : 'var(--text)'}
                />
              )}
              <text x={cx} y={B + 20} textAnchor="middle" className="num" fontSize={12} fill="var(--text-2)">
                {current ? '本月' : `${Number(p.key.slice(5))}月`}
              </text>
              {current && (
                <text x={cx} y={top - 8} textAnchor="middle" className="num" fontSize={12} fill="var(--text)">
                  {hidden ? '••••' : formatMoney(p.value)}
                </text>
              )}
              {/* 透明的點擊範圍比直條大，滑鼠移入或鍵盤聚焦都顯示數字 */}
              <rect
                x={L + slot * i}
                y={T}
                width={slot}
                height={B - T}
                fill={active === i ? 'var(--hover)' : 'transparent'}
                tabIndex={0}
                role="img"
                aria-label={tip(p)}
                onPointerEnter={() => setActive(i)}
                onPointerLeave={() => setActive(null)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
                className="cursor-pointer outline-none focus-visible:stroke-[var(--text)] focus-visible:stroke-[1.5]"
              />
            </g>
          );
        })}
      </svg>
      {activePoint && active !== null && (
        <div
          aria-hidden
          className="pointer-events-none absolute z-[3] -translate-x-1/2 -translate-y-[calc(100%+10px)] whitespace-nowrap rounded-xs bg-fg px-3 py-2 text-caption text-surface"
          style={{ left: `${((L + slot * active + slot / 2) / W) * 100}%`, top: `${(y(activePoint.value) / H) * 100}%` }}
        >
          {tip(activePoint)}
        </div>
      )}
    </div>
  );
}
