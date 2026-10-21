'use client';

import { useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, KeyRound, LogOut, Tags } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { budgetFor, planBudget, type BudgetScope } from '@/lib/budget';
import { setCategoryRows } from '@/lib/categories';
import { useBudgets, useProfile, useSetBudget, useUpdateProfile, useUser } from '@/lib/data';
import { monthKeyOf, monthLabel, monthTitle, shiftMonth } from '@/lib/dates';
import { isDemo } from '@/lib/demo';
import { forgetGoogleToken } from '@/lib/google-sheets';
import { formatMoney, parseAmount } from '@/lib/money';
import { createClient } from '@/lib/supabase/client';
import type { BudgetEntry, PnlColor } from '@/lib/types';
import { useUi, type ThemePref } from '@/lib/ui-store';
import { useNow } from '@/lib/use-now';
import { BackupRow } from '../BackupRow';
import { CsvExportRow } from '../CsvExportRow';
import { SheetsExportRow } from '../SheetsExportRow';
import { Avatar } from '../ui';

const THEMES: [ThemePref, string][] = [['light', '淺色'], ['dark', '深色'], ['system', '跟隨系統']];
const PNL: [PnlColor, string][] = [['red_up', '紅漲綠跌（台股）'], ['green_up', '綠漲紅跌']];
const SCOPES: [BudgetScope, string][] = [['from', '從這個月起'], ['only', '只有這個月'], ['next', '從下個月起']];

const budgetText = (v: number | null) => (v ? formatMoney(v) : '不設預算');

/** 預算紀錄的期間：「2026 年 10 月起」「2026 年 10 月」「2026 年 5 月～8 月」 */
function span(start: string, next?: string) {
  if (!next) return `${monthTitle(start)}起`;
  const end = shiftMonth(next, -1);
  if (end === start) return monthTitle(start);
  return `${monthTitle(start)}～${end.slice(0, 4) === start.slice(0, 4) ? monthLabel(end) : monthTitle(end)}`;
}

/** 本月起接下來的預算：本月的金額，加上之後排好的改變 */
function upcoming(entries: BudgetEntry[], month: string): BudgetEntry[] {
  const later = entries.filter((e) => e.month > month).sort((a, b) => a.month.localeCompare(b.month));
  return [{ month, amount: budgetFor(entries, month) }, ...later];
}

export function SettingsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: user } = useUser();
  const { data: profile } = useProfile();
  const { data: budgets = [] } = useBudgets();
  const update = useUpdateProfile();
  const setBudget = useSetBudget();
  const now = useNow();
  const theme = useUi((s) => s.theme);
  const setTheme = useUi((s) => s.setTheme);
  const showToast = useUi((s) => s.showToast);
  const [budgetInput, setBudgetInput] = useState<string | null>(null);
  const [scope, setScope] = useState<BudgetScope>('from');
  const [signingOut, setSigningOut] = useState(false);

  // 改預算時選套用到哪些月份；過去月份維持當時的預算，報表才準
  const month = now ? monthKeyOf(now) : null;
  const current = month ? budgetFor(budgets, month) : null;
  const budgetValue = budgetInput ?? (current ? String(current) : '');
  const editing = (budgetInput !== null || scope !== 'from') && month !== null;
  const plan = editing ? planBudget(budgets, month, parseAmount(budgetValue) || null, scope) : null;
  // 儲存後（或目前）本月起的預算
  const schedule = month ? upcoming(plan ? [...budgets.filter((b) => b.month < month), ...plan] : budgets, month) : [];
  const sorted = [...budgets].sort((a, b) => a.month.localeCompare(b.month));
  const history = sorted.map((b, i) => ({ ...b, label: span(b.month, sorted[i + 1]?.month) })).reverse().slice(0, 6);

  const back = () => (window.history.length > 1 ? router.back() : router.push('/'));

  const saveBudget = async () => {
    if (!month || !plan) return;
    const value = parseAmount(budgetValue) || null;
    const next = shiftMonth(month, 1);
    const amountText = value ? `每月預算 ${formatMoney(value)}` : '不設預算';
    try {
      await setBudget.mutateAsync({ from: month, entries: plan });
      setBudgetInput(null);
      setScope('from');
      showToast(
        scope === 'only' ? `只有 ${monthLabel(month)}${value ? `預算 ${formatMoney(value)}` : '不設預算'}，${monthLabel(next)}起回到原本的`
          : `${monthLabel(scope === 'next' ? next : month)}起${amountText}`,
      );
    } catch (e) {
      showToast(e instanceof Error ? e.message : '儲存失敗，請再試一次');
    }
  };

  const signOut = async () => {
    setSigningOut(true);
    await createClient().auth.signOut();
    queryClient.clear();
    setCategoryRows([]);
    forgetGoogleToken();
    router.replace('/login');
    router.refresh();
  };

  const seg = <T extends string>(items: [T, string][], current: T | undefined, onPick: (v: T) => void, label: string) => (
    <div role="group" aria-label={label} className="pills flex-wrap">
      {items.map(([v, l]) => (
        <button key={v} type="button" aria-pressed={current === v} onClick={() => onPick(v)} className="pill press">{l}</button>
      ))}
    </div>
  );

  return (
    <>
      <header className="flex min-h-12 items-center gap-1">
        <button type="button" onClick={back} aria-label="返回" className="icon-btn ghost press">
          <ChevronLeft size={20} strokeWidth={1.5} aria-hidden />
        </button>
        <h1 className="h-page">我的<span className="en">Settings</span></h1>
      </header>

      <section className="card flex items-center gap-4 p-5">
        <Avatar size={56} />
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate text-body">{user?.email ?? '…'}</span>
          <span className="caption">Monee 帳號</span>
        </span>
      </section>

      {!isDemo && (
        <Link href="/reset-password" className="card press flex min-h-14 items-center gap-3.5 px-5 py-2 text-body">
          <span aria-hidden className="ico sm"><KeyRound size={16} strokeWidth={1.5} /></span>
          修改密碼
          <ChevronRight size={18} strokeWidth={1.5} aria-hidden className="ml-auto text-muted" />
        </Link>
      )}

      <section aria-labelledby="s-budget" className="flex flex-col gap-2">
        <h2 id="s-budget" className="px-1 text-body-s font-normal tracking-[.1em] text-muted">每月預算</h2>
        <div className="card flex flex-col gap-3 px-5 py-4">
          <label htmlFor="budget" className="caption leading-[1.8] tracking-[.04em]">
            {month ? `${monthTitle(month)}的預算。` : ''}輸入新的金額，再選要套用到哪些月份；清空再儲存代表不設預算。
          </label>
          <div className="flex items-center gap-2">
            <div className="flex min-w-0 flex-1 items-baseline gap-1.5 border-b border-fg px-0.5 pb-1.5 focus-within:border-b-2 focus-within:pb-[5px]">
              <span className="display text-[18px]">$</span>
              <input
                id="budget"
                inputMode="numeric"
                value={budgetValue}
                onChange={(e) => setBudgetInput(e.target.value.replace(/\D/g, ''))}
                placeholder="例如 24000"
                autoComplete="off"
                className="display h-11 min-w-0 flex-1 bg-transparent text-[26px] outline-none"
              />
            </div>
            <button type="button" onClick={saveBudget} disabled={setBudget.isPending || !plan} className="btn-secondary press">
              {setBudget.isPending ? '儲存中…' : '儲存'}
            </button>
          </div>
          {/* 手機寬度三個並排，不用 seg（會換行） */}
          <div role="group" aria-label="套用到哪些月份" className="grid grid-cols-3 gap-2">
            {SCOPES.map(([v, l]) => (
              <button key={v} type="button" aria-pressed={scope === v} onClick={() => setScope(v)} className="pill press justify-center px-1">{l}</button>
            ))}
          </div>
          <div className="flex flex-col gap-1.5 rounded-sm bg-fill px-4 py-3">
            <span className="caption">{plan ? '儲存後' : '目前'}</span>
            <ul className="flex flex-col gap-1 text-body-s">
              {schedule.slice(0, 3).map((b, i) => (
                <li key={b.month} className="flex justify-between gap-2">
                  <span>{span(b.month, schedule[i + 1]?.month)}</span>
                  <span className="num">{budgetText(b.amount)}</span>
                </li>
              ))}
            </ul>
          </div>
          <p className="caption leading-[1.8]">過去的月份不會變，報表照當時的預算比較。</p>
          {history.length > 0 && (
            <div className="flex flex-col gap-1.5 border-t border-dashed border-line-strong pt-3">
              <span className="caption">預算紀錄</span>
              <ul className="flex flex-col gap-1 text-body-s">
                {history.map((b) => (
                  <li key={b.month} className="flex justify-between gap-2">
                    <span>{b.label}</span>
                    <span className="num text-muted">{budgetText(b.amount)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </section>

      <section aria-labelledby="s-categories" className="flex flex-col gap-2">
        <h2 id="s-categories" className="px-1 text-body-s font-normal tracking-[.1em] text-muted">記帳</h2>
        <Link href="/settings/categories" className="card press flex min-h-14 items-center gap-3.5 px-5 py-2">
          <span aria-hidden className="ico sm"><Tags size={16} strokeWidth={1.5} /></span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-body">分類管理</span>
            <span className="caption">新增、改名、隱藏、調整順序</span>
          </span>
          <ChevronRight size={18} strokeWidth={1.5} aria-hidden className="text-muted" />
        </Link>
      </section>

      <section aria-labelledby="s-theme" className="flex flex-col gap-2">
        <h2 id="s-theme" className="px-1 text-body-s font-normal tracking-[.1em] text-muted">外觀</h2>
        <div className="card px-5 py-4">{seg(THEMES, theme, setTheme, '外觀')}</div>
      </section>

      <section aria-labelledby="s-pnl" className="flex flex-col gap-2">
        <h2 id="s-pnl" className="px-1 text-body-s font-normal tracking-[.1em] text-muted">投資漲跌配色</h2>
        <div className="card px-5 py-4">
          {seg(PNL, profile?.pnlColor, (v) => update.mutate({ pnlColor: v }), '投資漲跌配色')}
        </div>
      </section>

      <section aria-labelledby="s-data" className="flex flex-col gap-2">
        <h2 id="s-data" className="px-1 text-body-s font-normal tracking-[.1em] text-muted">資料</h2>
        <ul className="card">
          <SheetsExportRow />
          <CsvExportRow />
          <BackupRow />
        </ul>
      </section>

      {!isDemo && (
        <button type="button" onClick={signOut} disabled={signingOut} className="btn-secondary press w-full">
          <LogOut size={16} strokeWidth={1.5} aria-hidden />{signingOut ? '登出中…' : '登出'}
        </button>
      )}
      <p className="caption text-center">Monee 0.1.0・Phase 2</p>
    </>
  );
}
