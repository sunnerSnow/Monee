'use client';

import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { getCategory, useCategories } from '@/lib/categories';
import { usePostRecurring, useRecurringRules } from '@/lib/data';
import { toISODate } from '@/lib/dates';
import { formatMoney, money, parseAmount } from '@/lib/money';
import { after, describe, dueDates, homeLists, shortDue, type RecurringRule } from '@/lib/recurring';
import { useUi } from '@/lib/ui-store';
import { SectionHeader, useHidden } from './ui';

/** 固定收支的名稱：有寫品項就用品項，沒有就用分類名稱 */
export const ruleTitle = (r: RecurringRule) => r.note || getCategory(r.type === 'TRANSFER' ? 'transfer' : r.categoryId).name;

/** 支出 −、收入 +、轉帳不加正負號 */
export const ruleMoney = (r: RecurringRule, value: number, hidden: boolean) =>
  `${hidden ? '' : r.type === 'EXPENSE' ? '−' : r.type === 'INCOME' ? '+' : ''}${money(value, hidden)}`;

/**
 * 打開 App 時，把到期的「自動記下」一次記好（很久沒打開就補記），記完提示一下。
 * 一次打開只跑一次；兩支手機同時打開由資料庫比對下次日期，不會重複記。
 */
export function RecurringAuto() {
  const { data: rules } = useRecurringRules();
  const { mutateAsync: post } = usePostRecurring();
  const showToast = useUi((s) => s.showToast);
  const ran = useRef(false);

  useEffect(() => {
    if (!rules || ran.current) return;
    ran.current = true;
    const today = toISODate(new Date());
    const due = rules.filter((r) => r.auto && !r.paused).map((r) => ({ r, dates: dueDates(r, today) })).filter((x) => x.dates.length);
    if (!due.length) return;
    void (async () => {
      const posted: string[] = [];
      for (const { r, dates } of due) {
        try {
          if (await post({ rule: r, dates, next: after(r, dates[dates.length - 1]) })) {
            posted.push(`${ruleTitle(r)} ${formatMoney(r.amount)}${dates.length > 1 ? ` × ${dates.length}` : ''}`);
          }
        } catch {
          // 這次沒記到，下次打開再試
        }
      }
      if (posted.length) showToast(`已幫你記下：${posted.join('、')}`);
    })();
  }, [rules, post, showToast]);

  return null;
}

/** 首頁：到期要問的（金額可以改，記下或略過）、7 天內會記的 */
export function RecurringHome({ today }: { today: string }) {
  useCategories(); // 分類改名、換顏色時重畫
  const hidden = useHidden();
  const { data: rules = [] } = useRecurringRules();
  const { ask, upcoming } = homeLists(rules, today);
  if (!ask.length && !upcoming.length) return null;

  return (
    <section aria-labelledby="recurring-title" className="flex flex-col gap-2.5">
      <SectionHeader
        id="recurring-title"
        title="固定收支"
        en="Recurring"
        action={<Link href="/settings/recurring" className="press inline-flex min-h-11 items-center gap-1 px-1 text-body-s tracking-[.08em]">管理<ArrowRight size={16} strokeWidth={1.5} aria-hidden /></Link>}
      />
      <ul className="card py-1">
        {ask.map((r) => <AskRow key={r.id} rule={r} />)}
        {upcoming.map((r) => {
          const cat = getCategory(r.type === 'TRANSFER' ? 'transfer' : r.categoryId);
          const Icon = cat.icon;
          return (
            <li key={r.id} className="border-t border-line first:border-t-0">
              <Link href="/settings/recurring" className="row press">
                <span aria-hidden className={`ico ${r.type === 'TRANSFER' ? 'tr' : ''}`} style={r.type === 'TRANSFER' ? undefined : { background: cat.color }}><Icon size={20} strokeWidth={1.5} /></span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-body">{ruleTitle(r)}</span>
                  <span className="truncate text-caption tracking-[.06em] text-muted">{shortDue(r.nextDate)}・{r.auto ? '自動記下' : '到時候問你'}</span>
                </span>
                <span className="num flex-none text-body">{ruleMoney(r, r.amount, hidden)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function AskRow({ rule }: { rule: RecurringRule }) {
  const { mutateAsync: post, isPending } = usePostRecurring();
  const showToast = useUi((s) => s.showToast);
  const [amount, setAmount] = useState(String(rule.amount));
  const cat = getCategory(rule.type === 'TRANSFER' ? 'transfer' : rule.categoryId);
  const Icon = cat.icon;
  const title = ruleTitle(rule);
  const inputId = `recurring-${rule.id}`;

  // 記下：照這次的金額記一筆；略過：不記，跳到下一期。兩個都會把下次日期往後推
  const handle = async (record: boolean) => {
    const value = parseAmount(amount);
    if (record && !value) return showToast('請輸入金額');
    try {
      const ok = await post({ rule, dates: record ? [rule.nextDate] : [], next: after(rule, rule.nextDate), amount: record ? value : undefined });
      showToast(!ok ? '這筆已經在別的地方處理過了' : record ? `已記下：${title} ${formatMoney(value)}` : `已略過這期的${title}，下次 ${shortDue(after(rule, rule.nextDate))}`);
    } catch (e) {
      showToast(e instanceof Error ? e.message : '儲存失敗，請再試一次');
    }
  };

  return (
    <li className="flex flex-col gap-3 border-t border-line px-5 py-3.5 first:border-t-0">
      <div className="flex items-center gap-3.5">
        <span aria-hidden className={`ico ${rule.type === 'TRANSFER' ? 'tr' : ''}`} style={rule.type === 'TRANSFER' ? undefined : { background: cat.color }}><Icon size={20} strokeWidth={1.5} /></span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate text-body">{title}</span>
          <span className="text-caption tracking-[.06em] text-muted">
            <span className="inline-block">{shortDue(rule.nextDate)} 到期・</span><span className="inline-block">{describe(rule)}</span>
          </span>
        </span>
        <span className="chip tight flex-none">要記嗎？</span>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2">
        <label htmlFor={inputId} className="sr-only">{title}這次的金額</label>
        <div className="field-input flex items-center gap-1 px-3.5">
          <span aria-hidden className="num text-muted">$</span>
          <input
            id={inputId}
            inputMode="numeric"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/\D/g, '').slice(0, 8))}
            autoComplete="off"
            className="num min-w-0 flex-1 bg-transparent text-[16px] outline-none"
          />
        </div>
        <button type="button" onClick={() => handle(false)} disabled={isPending} className="btn-secondary press">略過</button>
        <button type="button" onClick={() => handle(true)} disabled={isPending} className="btn-primary press min-h-11 px-4 text-[15px]">記下</button>
      </div>
    </li>
  );
}
