'use client';

import { useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, CloudUpload, KeyRound, LogOut, Sheet as SheetIcon, User } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useProfile, useUpdateProfile, useUser } from '@/lib/data';
import { isDemo } from '@/lib/demo';
import { formatMoney, parseAmount } from '@/lib/money';
import { createClient } from '@/lib/supabase/client';
import type { PnlColor } from '@/lib/types';
import { useUi, type ThemePref } from '@/lib/ui-store';

const THEMES: [ThemePref, string][] = [['light', '淺色'], ['dark', '深色'], ['system', '跟隨系統']];
const PNL: [PnlColor, string][] = [['red_up', '紅漲綠跌（台股）'], ['green_up', '綠漲紅跌']];

export function SettingsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: user } = useUser();
  const { data: profile } = useProfile();
  const update = useUpdateProfile();
  const theme = useUi((s) => s.theme);
  const setTheme = useUi((s) => s.setTheme);
  const showToast = useUi((s) => s.showToast);
  const [budgetInput, setBudgetInput] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  const budgetValue = budgetInput ?? (profile?.monthlyBudget ? String(profile.monthlyBudget) : '');

  const back = () => (window.history.length > 1 ? router.back() : router.push('/'));

  const saveBudget = async () => {
    const value = parseAmount(budgetValue);
    try {
      await update.mutateAsync({ monthlyBudget: value || null });
      setBudgetInput(null);
      showToast(value ? `每月預算已設為 ${formatMoney(value)}` : '已清除每月預算');
    } catch (e) {
      showToast(e instanceof Error ? e.message : '儲存失敗，請再試一次');
    }
  };

  const signOut = async () => {
    setSigningOut(true);
    await createClient().auth.signOut();
    queryClient.clear();
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
        <span aria-hidden className="flex h-14 w-14 flex-none items-center justify-center rounded-full bg-fill"><User size={24} strokeWidth={1.5} /></span>
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
          <label htmlFor="budget" className="caption leading-[1.8] tracking-[.04em]">設定後，首頁會算出每天能花多少，並顯示預算進度。</label>
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
                className="display min-w-0 flex-1 bg-transparent text-[26px] outline-none"
              />
            </div>
            <button type="button" onClick={saveBudget} disabled={update.isPending || budgetInput === null} className="btn-secondary press">
              {update.isPending ? '儲存中…' : '儲存'}
            </button>
          </div>
        </div>
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
          {[
            { icon: SheetIcon, label: '匯出到 Google Sheets' },
            { icon: CloudUpload, label: '資料備份' },
          ].map(({ icon: Icon, label }, i) => (
            <li key={label} className={`flex min-h-14 items-center gap-3.5 px-5 py-2 text-body text-muted ${i ? 'border-t border-line' : ''}`}>
              <span aria-hidden className="ico sm"><Icon size={16} strokeWidth={1.5} /></span>
              {label}<span className="caption ml-auto">即將推出</span>
            </li>
          ))}
        </ul>
      </section>

      {!isDemo && (
        <button type="button" onClick={signOut} disabled={signingOut} className="btn-secondary press w-full">
          <LogOut size={16} strokeWidth={1.5} aria-hidden />{signingOut ? '登出中…' : '登出'}
        </button>
      )}
      <p className="caption text-center">Monee 0.1.0・Phase 1</p>
    </>
  );
}
