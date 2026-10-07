'use client';

import Image from 'next/image';
import { useState } from 'react';
import { budgetFor, expenseByCategory, monthTotals, monthlyExpenses } from '@/lib/budget';
import { getCategory } from '@/lib/categories';
import { HISTORY_MONTHS, useBudgets, useTransactions } from '@/lib/data';
import { monthLabel, monthKeyOf, shiftMonth } from '@/lib/dates';
import { MASK, formatMoney, money } from '@/lib/money';
import { useNow } from '@/lib/use-now';
import { MonthlyChart } from '../MonthlyChart';
import { EmptyBox, ErrorBox, LoadingBlocks, MonthSwitch, PageHeader, useHidden } from '../ui';

export function ReportsScreen() {
  const now = useNow();
  const txQ = useTransactions();
  const budgetsQ = useBudgets();
  const hidden = useHidden();
  const [offset, setOffset] = useState(0);

  const header = <PageHeader title="報表" en="Reports" />;
  if (!now || txQ.isPending || budgetsQ.isPending) return <>{header}<LoadingBlocks /></>;
  const error = txQ.error ?? budgetsQ.error;
  if (error) return <>{header}<ErrorBox message={error.message} onRetry={() => { txQ.refetch(); budgetsQ.refetch(); }} /></>;

  const txs = txQ.data ?? [];
  const budgets = budgetsQ.data ?? [];
  const current = monthKeyOf(now);
  const month = shiftMonth(current, offset);
  const totals = monthTotals(txs, month);
  const cats = expenseByCategory(txs, month);
  // 每個月配上該月自己的預算（預算是「從某月起生效」，各月可能不同）
  const series = monthlyExpenses(txs, current, HISTORY_MONTHS).map((p) => ({ ...p, budget: budgetFor(budgets, p.key) }));
  const budget = budgetFor(budgets, month);
  const hasAnyBudget = series.some((p) => p.budget !== null);
  const kpis: [string, string][] = [
    ['支出', money(totals.expense, hidden)],
    ['收入', money(totals.income, hidden)],
    ['結餘', `${totals.income - totals.expense < 0 && !hidden ? '−' : ''}${money(totals.income - totals.expense, hidden)}`],
    budget ? ['預算已用', `${Math.round((totals.expense / budget) * 100)}%`] : ['交易筆數', `${txs.filter((t) => t.date.startsWith(month)).length} 筆`],
  ];

  return (
    <>
      {header}
      <MonthSwitch month={month} onPrev={() => setOffset((o) => o - 1)} onNext={() => setOffset((o) => o + 1)} canPrev={offset > -(HISTORY_MONTHS - 1)} canNext={offset < 0} />

      <div className="grid grid-cols-2 gap-2.5">
        {kpis.map(([k, v]) => (
          <div key={k} className="card flex flex-col gap-1 rounded-sm px-4 py-3.5">
            <span className="caption">{k}</span>
            <span className="display text-[20px]">{v}</span>
          </div>
        ))}
      </div>

      <section aria-labelledby="cat-title" className="card flex flex-col gap-4 p-5">
        <div className="flex items-baseline justify-between gap-2">
          <h2 id="cat-title" className="h-sec">支出分類<span className="en">By category</span></h2>
          <span className="caption num">{money(totals.expense, hidden)}</span>
        </div>
        {cats.length === 0 ? (
          <p className="text-body-s text-muted">這個月還沒有支出。</p>
        ) : (
          // 由大到小的橫條：相近數值比圓餅圖好比較，每個數字都直接標示
          <ul className="flex flex-col gap-3.5">
            {cats.map((c) => {
              const cat = getCategory(c.categoryId);
              const Icon = cat.icon;
              return (
                <li key={c.categoryId} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2">
                  <span className="flex items-center gap-2.5 text-[14px]">
                    <span aria-hidden className="ico sm"><Icon size={16} strokeWidth={1.5} /></span>{cat.name}
                  </span>
                  <span className="num text-[14px]">
                    {money(c.amount, hidden)}
                    <small className="ml-2 text-caption text-muted">{Math.round((c.amount / totals.expense) * 100)}%</small>
                  </span>
                  <span aria-hidden className="col-span-2 h-2">
                    <i className="block h-full rounded-r-[4px] bg-fg" style={{ width: `${(c.amount / cats[0].amount) * 100}%` }} />
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="trend-title" className="card flex flex-col gap-4 p-5">
        <div className="flex items-baseline justify-between gap-2">
          <h2 id="trend-title" className="h-sec">每月支出<span className="en">Monthly</span></h2>
          {hasAnyBudget && <span className="caption">虛線＝當月預算</span>}
        </div>
        {series.every((p) => p.value === 0) ? (
          <EmptyBox title="還沒有資料">記帳一段時間後，這裡會顯示每月支出的變化。</EmptyBox>
        ) : (
          <>
            <MonthlyChart points={series} currentKey={current} hidden={hidden} />
            <details className="group">
              <summary className="press inline-flex min-h-11 cursor-pointer list-none items-center gap-1.5 text-body-s tracking-[.08em] [&::-webkit-details-marker]:hidden">
                看數字<span aria-hidden className="text-muted group-open:hidden">＋</span><span aria-hidden className="hidden text-muted group-open:inline">－</span>
              </summary>
              <table className="w-full border-collapse text-body-s">
                <thead>
                  <tr className="text-caption tracking-[.1em] text-muted">
                    <th scope="col" className="border-b border-line px-1 py-2 text-left font-normal">月份</th>
                    <th scope="col" className="border-b border-line px-1 py-2 text-right font-normal">支出</th>
                    {hasAnyBudget && <th scope="col" className="border-b border-line px-1 py-2 text-right font-normal">預算</th>}
                    {hasAnyBudget && <th scope="col" className="border-b border-line px-1 py-2 text-right font-normal">與預算差</th>}
                  </tr>
                </thead>
                <tbody>
                  {series.map((p) => (
                    <tr key={p.key}>
                      <td className="border-b border-line px-1 py-2">{monthLabel(p.key)}{p.key === current ? '（進行中）' : ''}</td>
                      <td className="num border-b border-line px-1 py-2 text-right">{money(p.value, hidden)}</td>
                      {hasAnyBudget && <td className="num border-b border-line px-1 py-2 text-right">{p.budget === null ? '—' : money(p.budget, hidden)}</td>}
                      {hasAnyBudget && (
                        <td className="num border-b border-line px-1 py-2 text-right">
                          {p.budget === null ? '—' : hidden ? MASK : `${p.value > p.budget ? '+' : '−'}${formatMoney(p.value - p.budget)}`}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          </>
        )}
      </section>

      <section aria-labelledby="wrapped-title" className="relative min-h-[140px] overflow-hidden rounded-xl bg-brand py-5 pr-[140px] pl-5 text-ink">
        <span className="num text-caption tracking-[.06em]">{now.getFullYear()} Wrapped</span>
        <h2 id="wrapped-title" className="my-1.5 text-title-s font-medium tracking-[.14em]">你的年度金錢故事</h2>
        <p className="text-body-s leading-[1.8]">12 月 31 日解鎖：一年花最多的地方、最省的月份，還有 Monee 給你的小結語。</p>
        <Image src="/monee.png" alt="" width={124} height={90} className="absolute right-2 bottom-0 h-auto w-[124px]" />
      </section>
    </>
  );
}
