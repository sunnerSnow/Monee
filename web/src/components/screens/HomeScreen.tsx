'use client';

import { ArrowLeftRight, ArrowRight, Check, ChevronRight, CircleCheck, Eye, EyeOff, Info, Landmark, CreditCard, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { accountSummary, budgetPace, dailyBudget, monthTotals, sortNewestFirst } from '@/lib/budget';
import { useAccounts, useProfile, useTransactions } from '@/lib/data';
import { daysInMonth, greeting, longDate, monthKeyOf, toISODate } from '@/lib/dates';
import { money, signedBalance } from '@/lib/money';
import type { Account, Profile, Transaction } from '@/lib/types';
import { useUi } from '@/lib/ui-store';
import { useNow } from '@/lib/use-now';
import { TxGroups } from '../TxList';
import { Avatar, BigMoney, EmptyBox, ErrorBox, HeroCard, LoadingBlocks, SectionHeader, useHidden } from '../ui';

const MORE = 'press inline-flex min-h-11 items-center gap-1 px-1 text-body-s tracking-[.08em]';

export function HomeScreen() {
  const now = useNow();
  const accountsQ = useAccounts();
  const txQ = useTransactions();
  const profileQ = useProfile();

  if (!now || accountsQ.isPending || txQ.isPending || profileQ.isPending) return <LoadingBlocks />;
  const error = accountsQ.error ?? txQ.error ?? profileQ.error;
  if (error) {
    return <ErrorBox message={error.message} onRetry={() => { accountsQ.refetch(); txQ.refetch(); profileQ.refetch(); }} />;
  }

  const accounts = accountsQ.data ?? [];
  const txs = txQ.data ?? [];
  const profile = profileQ.data!;
  if (!txs.length) return <Onboarding now={now} accounts={accounts} profile={profile} />;
  return <Dashboard now={now} accounts={accounts} txs={txs} profile={profile} />;
}

function TopBar({ now, showEye = true }: { now: Date; showEye?: boolean }) {
  const hidden = useHidden();
  const toggleHidden = useUi((s) => s.toggleHidden);
  return (
    <header className="flex min-h-12 items-center justify-between gap-3">
      <div className="flex min-w-0 flex-col gap-1">
        <span className="caption">{longDate(now)}</span>
        <h1 className="h-page">{greeting(now)}</h1>
      </div>
      <div className="flex gap-2">
        {showEye && (
          <button type="button" onClick={toggleHidden} aria-pressed={hidden} aria-label="隱藏金額" className="icon-btn press">
            {hidden ? <EyeOff size={20} strokeWidth={1.5} aria-hidden /> : <Eye size={20} strokeWidth={1.5} aria-hidden />}
          </button>
        )}
        <Link href="/settings" aria-label="我的・設定" className="press flex-none rounded-full">
          <Avatar size={44} />
        </Link>
      </div>
    </header>
  );
}

function Dashboard({ now, accounts, txs, profile }: { now: Date; accounts: Account[]; txs: Transaction[]; profile: Profile }) {
  const hidden = useHidden();
  const month = monthKeyOf(now);
  const today = toISODate(now);
  const totals = monthTotals(txs, month);
  const todaySpent = txs.filter((t) => t.type === 'EXPENSE' && t.date === today).reduce((s, t) => s + t.amount, 0);
  const budget = profile.monthlyBudget;
  const calendar = { day: now.getDate(), daysInMonth: daysInMonth(now) };
  const daily = budget ? dailyBudget({ budget, monthExpense: totals.expense, todaySpent, ...calendar }) : null;
  const pace = budget ? budgetPace({ budget, monthExpense: totals.expense, ...calendar }) : null;
  const assets = accountSummary(accounts);
  const monthName = new Intl.DateTimeFormat('en', { month: 'long' }).format(now);

  const mood = !daily
    ? '設定每月預算，Monee 會算出你每天能花多少'
    : daily.status === 'over'
      ? `沒關係，明天起每天可花 ${money(daily.nextDaily, hidden)}`
      : daily.status === 'tight' ? '今天再省一點點就達標' : '節奏剛剛好，繼續保持';
  const chip = daily && (daily.status === 'over'
    ? { tone: 'over', text: `超出 ${money(-daily.left, hidden)}` }
    : daily.status === 'tight'
      ? { tone: 'tight', text: `只剩 ${money(daily.left, hidden)}` }
      : { tone: '', text: `還能花 ${money(daily.left, hidden)}` });
  const barColor = daily?.status === 'over' ? 'var(--alert)' : daily?.status === 'tight' ? 'var(--warn)' : 'var(--text)';

  return (
    <>
      <TopBar now={now} />

      <HeroCard
        labelledBy="today-title"
        top={<>
          <h2 id="today-title" className="m-0 text-body-s tracking-[.18em] text-muted">今天花了</h2>
          <BigMoney value={todaySpent} className="text-display-xl leading-[1.15]" />
          <p className="text-body-s leading-[1.8]">{mood}</p>
        </>}
        bottom={daily && chip ? <>
          <div aria-hidden className="h-[var(--bar-h)] overflow-hidden rounded-full bg-fill">
            <i className="block h-full rounded-full" style={{ width: `${daily.allowance ? Math.min(100, Math.round((todaySpent / daily.allowance) * 100)) : 100}%`, background: barColor }} />
          </div>
          <div className="flex items-center justify-between gap-2 text-body-s text-muted">
            <span>今日額度 <span className="num">{money(daily.allowance, hidden)}</span></span>
            <span className={`chip ${chip.tone}`}>{chip.text}</span>
          </div>
        </> : (
          <Link href="/settings" className="btn-secondary press self-start">設定每月預算<ArrowRight size={16} strokeWidth={1.5} aria-hidden /></Link>
        )}
      />

      <section aria-labelledby="month-title" className="card flex flex-col gap-4 p-5">
        <div className="flex items-baseline justify-between gap-2">
          <h2 id="month-title" className="h-sec">{now.getMonth() + 1} 月結餘<span className="en">{monthName}</span></h2>
          <span className="caption">第 {calendar.day} 天・共 {calendar.daysInMonth} 天</span>
        </div>
        <BigMoney value={totals.income - totals.expense} className="text-display-l leading-[1.15]" />
        <div className="grid grid-cols-2 gap-2.5">
          <div className="flex flex-col gap-1 rounded-sm bg-cream px-3.5 py-3">
            <span className="caption">收入</span>
            <span className="num text-[16px]">{hidden ? money(0, true) : `+${money(totals.income, false)}`}</span>
          </div>
          <div className="flex flex-col gap-1 rounded-sm bg-fill px-3.5 py-3">
            <span className="caption">支出</span>
            <span className="num text-[16px]">{money(totals.expense, hidden)}</span>
          </div>
        </div>
        {budget && pace && (
          <div className="flex flex-col gap-2">
            <div className="flex justify-between gap-2 text-caption tracking-[.08em] text-muted">
              <span>每月預算 <span className="num">{money(budget, hidden)}</span></span>
              <span>已用 <span className="num">{pace.usedPct}%</span></span>
            </div>
            <div aria-hidden className="relative mt-5 h-[var(--bar-h)] rounded-full bg-fill">
              <i className="block h-full rounded-full bg-fg" style={{ width: `${Math.min(100, pace.usedPct)}%` }} />
              <span className="absolute -top-[5px] h-4 w-0.5 rounded-sm bg-fg shadow-[0_0_0_2px_var(--surface)]" style={{ left: `${pace.timePct}%` }}>
                <span className="absolute bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap text-caption">今天</span>
              </span>
            </div>
            <p className={`mt-0.5 flex items-center gap-1.5 text-body-s font-medium ${pace.onTrack ? '' : 'text-alert'}`}>
              {pace.onTrack ? <CircleCheck size={16} strokeWidth={1.5} aria-hidden /> : <Info size={16} strokeWidth={1.5} aria-hidden />}
              {pace.onTrack ? '跟時間進度差不多，剛剛好' : `比時間進度快 ${pace.diff}%，留意一下就好`}
            </p>
          </div>
        )}
        {totals.transfer > 0 && (
          <p className="flex items-center gap-2 border-t border-line pt-3.5 text-caption text-muted">
            <ArrowLeftRight size={16} strokeWidth={1.5} aria-hidden />
            <span>已排除內部轉帳 <span className="num">{money(totals.transfer, hidden)}</span>，不算進支出</span>
          </p>
        )}
      </section>

      <section aria-labelledby="recent-title" className="flex flex-col gap-2.5">
        <SectionHeader id="recent-title" title="最近交易" en="Recent" action={
          <Link href="/transactions" className={MORE}>全部明細<ArrowRight size={16} strokeWidth={1.5} aria-hidden /></Link>
        } />
        <TxGroups txs={sortNewestFirst(txs).slice(0, 6)} accounts={accounts} today={now} variant="inline" />
      </section>

      {accounts.length > 0 && (
        <section aria-labelledby="assets-title" className="flex flex-col gap-2.5">
          <SectionHeader id="assets-title" title="資產" en="Assets" action={
            <Link href="/assets" className={MORE}>全部資產<ArrowRight size={16} strokeWidth={1.5} aria-hidden /></Link>
          } />
          <div className="card py-1">
            <div className="flex flex-col gap-1 px-5 pt-4 pb-2">
              <span className="caption">淨資產</span>
              <BigMoney value={assets.net} className="text-display-m leading-[1.2]" />
            </div>
            <ul>
              {assets.liquid.length > 0 && <SummaryRow icon={<Landmark size={20} strokeWidth={1.5} />} title="現金與存款" sub={assets.liquid.map((a) => a.name).join('・')} amount={money(assets.liquidSum, hidden)} />}
              {assets.cards.length > 0 && <SummaryRow icon={<CreditCard size={20} strokeWidth={1.5} />} title="信用卡待繳" sub={assets.cards.map((a) => a.name).join('・')} amount={signedBalance(assets.cardSum, hidden)} />}
              {assets.investments.length > 0 && <SummaryRow icon={<TrendingUp size={20} strokeWidth={1.5} />} title="投資帳戶" sub={assets.investments.map((a) => a.name).join('・')} amount={money(assets.investSum, hidden)} />}
            </ul>
          </div>
        </section>
      )}
    </>
  );
}

function SummaryRow({ icon, title, sub, amount }: { icon: React.ReactNode; title: string; sub: string; amount: string }) {
  return (
    <li>
      <Link href="/assets" className="row press">
        <span aria-hidden className="ico">{icon}</span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate text-body">{title}</span>
          <span className="truncate text-caption tracking-[.06em] text-muted">{sub}</span>
        </span>
        <span className="num flex-none text-body">{amount}</span>
      </Link>
    </li>
  );
}

function Onboarding({ now, accounts, profile }: { now: Date; accounts: Account[]; profile: Profile }) {
  const openSheet = useUi((s) => s.openSheet);
  const hasAccount = accounts.length > 0;
  const hasBudget = profile.monthlyBudget !== null;
  const steps = [
    { done: true, title: '建立帳號', sub: '已完成' },
    { done: hasAccount, title: '新增帳戶', sub: hasAccount ? `已新增 ${accounts.length} 個` : '現金、銀行、信用卡都可以加', action: () => openSheet({ kind: 'account' }) },
    { done: hasBudget, title: '設定每月預算', sub: hasBudget ? '已設定' : 'Monee 會算出你每天能花多少', href: '/settings' },
  ];
  const doneCount = steps.filter((s) => s.done).length;

  return (
    <>
      <TopBar now={now} showEye={false} />
      <HeroCard
        labelledBy="first-title"
        top={<>
          <h2 id="first-title" className="m-0 text-title-m font-medium leading-normal tracking-[.12em]">今天還沒記帳</h2>
          <p className="text-body-s leading-[1.8]">記下第一筆，Monee 就開始幫你看懂錢花去哪。</p>
        </>}
        bottom={
          <button type="button" onClick={() => openSheet({ kind: hasAccount ? 'entry' : 'account' })} className="btn-primary press w-full">
            {hasAccount ? '記下第一筆' : '先新增帳戶'}<ArrowRight size={18} strokeWidth={1.5} aria-hidden />
          </button>
        }
      />
      <section aria-labelledby="setup-title" className="card pt-[18px] pb-1.5">
        <div className="flex items-baseline justify-between gap-2 px-5 pb-1.5">
          <h2 id="setup-title" className="h-sec">開始設定<span className="en">Setup</span></h2>
          <span className="caption num">{doneCount} / {steps.length}</span>
        </div>
        <ol>
          {steps.map((s, i) => {
            const body = (
              <>
                <span aria-hidden className={`num flex h-7 w-7 flex-none items-center justify-center rounded-full text-caption ${s.done ? 'bg-brand text-ink' : 'border border-fg'}`}>
                  {s.done ? <Check size={14} strokeWidth={2} /> : i + 1}
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className={`truncate text-body ${s.done ? 'text-muted line-through' : ''}`}>{s.title}</span>
                  <span className="truncate text-caption tracking-[.06em] text-muted">{s.sub}</span>
                </span>
                {!s.done && <ChevronRight size={18} strokeWidth={1.5} aria-hidden className="flex-none text-muted" />}
              </>
            );
            return (
              <li key={s.title}>
                {s.done ? <div className="row min-h-[60px] py-2">{body}</div>
                  : s.href ? <Link href={s.href} className="row press min-h-[60px] py-2">{body}</Link>
                    : <button type="button" onClick={s.action} className="row press min-h-[60px] py-2">{body}</button>}
              </li>
            );
          })}
        </ol>
      </section>
      <section aria-labelledby="recent-empty-title" className="flex flex-col gap-2.5">
        <SectionHeader id="recent-empty-title" title="最近交易" en="Recent" />
        <EmptyBox title="還沒有交易">點下方 ＋ 就能記帳；語音和拍收據記帳之後會推出。</EmptyBox>
      </section>
    </>
  );
}
