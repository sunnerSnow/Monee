'use client';

import { ArrowLeftRight, ArrowRight, Check, ChevronRight, CircleCheck, CreditCard, Eye, EyeOff, Info, Landmark, Plane, TrendingUp, Users } from 'lucide-react';
import Link from 'next/link';
import { accountSummary, budgetFor, budgetPace, countsForBudget, dailyBudget, monthTotals, sortNewestFirst } from '@/lib/budget';
import { useAccounts, useBudgets, useSplitGroups, useTransactions } from '@/lib/data';
import { daysInMonth, greeting, longDate, monthKeyOf, toISODate } from '@/lib/dates';
import { money, signedBalance } from '@/lib/money';
import { inboxCount } from '@/lib/split';
import type { Account, Transaction } from '@/lib/types';
import { useUi } from '@/lib/ui-store';
import { useNow } from '@/lib/use-now';
import { TxGroups } from '../TxList';
import { InboxBanner } from '../split/parts';
import { Avatar, BigMoney, EmptyBox, ErrorBox, HeroCard, LoadingBlocks, SectionHeader, useHidden } from '../ui';

const MORE = 'press inline-flex min-h-11 items-center gap-1 px-1 text-body-s tracking-[.08em]';

export function HomeScreen() {
  const now = useNow();
  const accountsQ = useAccounts();
  const txQ = useTransactions();
  const budgetsQ = useBudgets();

  if (!now || accountsQ.isPending || txQ.isPending || budgetsQ.isPending) return <LoadingBlocks />;
  const error = accountsQ.error ?? txQ.error ?? budgetsQ.error;
  if (error) {
    return <ErrorBox message={error.message} onRetry={() => { accountsQ.refetch(); txQ.refetch(); budgetsQ.refetch(); }} />;
  }

  const accounts = accountsQ.data ?? [];
  const txs = txQ.data ?? [];
  // 本月的預算（預算紀錄是「從某月起生效」）
  const budget = budgetFor(budgetsQ.data ?? [], monthKeyOf(now));
  // 「開始設定」只在帳戶或預算還沒設好、也還沒記過帳時出現；設定完就收起來，直接顯示首頁
  const setupDone = accounts.length > 0 && budget !== null;
  if (!txs.length && !setupDone) return <Onboarding now={now} accounts={accounts} budget={budget} />;
  return <Dashboard now={now} accounts={accounts} txs={txs} budget={budget} />;
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

function Dashboard({ now, accounts, txs, budget }: { now: Date; accounts: Account[]; txs: Transaction[]; budget: number | null }) {
  const hidden = useHidden();
  const month = monthKeyOf(now);
  const today = toISODate(now);
  const totals = monthTotals(txs, month);
  // 今日額度只看算進每月預算的支出；旅程設定不算進預算的另外提示
  const todaySpent = txs.filter((t) => countsForBudget(t) && t.date === today).reduce((s, t) => s + t.amount, 0);
  const todayTrip = txs.filter((t) => t.type === 'EXPENSE' && t.excludeFromBudget && t.date === today).reduce((s, t) => s + t.amount, 0);
  const calendar = { day: now.getDate(), daysInMonth: daysInMonth(now) };
  const daily = budget ? dailyBudget({ budget, monthExpense: totals.budgetExpense, todaySpent, ...calendar }) : null;
  const pace = budget ? budgetPace({ budget, monthExpense: totals.budgetExpense, ...calendar }) : null;
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
          {todayTrip > 0 && <p className="caption leading-[1.7]">另有旅程花費 {money(todayTrip, hidden)}，不算進今日額度</p>}
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

      <SplitInbox />

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
              <span>本月預算 <span className="num">{money(budget, hidden)}</span></span>
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
        {totals.excluded > 0 && (
          <p className="flex items-center gap-2 border-t border-line pt-3.5 text-caption text-muted">
            <Plane size={16} strokeWidth={1.5} aria-hidden />
            <span>支出含旅程花費 <span className="num">{money(totals.excluded, hidden)}</span>，不算進每月預算</span>
          </p>
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
        {txs.length > 0
          ? <TxGroups txs={sortNewestFirst(txs).slice(0, 6)} accounts={accounts} today={now} variant="inline" />
          : <EmptyBox title="還沒有交易">點下方 ＋ 記下第一筆，這裡就會列出最近的花費。</EmptyBox>}
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
              {assets.friends.length > 0 && (
                <SummaryRow
                  href="/split"
                  icon={<Users size={20} strokeWidth={1.5} />}
                  title="朋友往來"
                  sub={assets.friendsSum > 0 ? '分帳・朋友欠你' : assets.friendsSum < 0 ? '分帳・你欠朋友' : '分帳・都結清了'}
                  amount={signedBalance(assets.friendsSum, hidden)}
                />
              )}
            </ul>
          </div>
        </section>
      )}
    </>
  );
}

function SummaryRow({ icon, title, sub, amount, href = '/assets' }: { icon: React.ReactNode; title: string; sub: string; amount: string; href?: string }) {
  return (
    <li>
      <Link href={href} className="row press">
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

function Onboarding({ now, accounts, budget }: { now: Date; accounts: Account[]; budget: number | null }) {
  const openSheet = useUi((s) => s.openSheet);
  const hasAccount = accounts.length > 0;
  const hasBudget = budget !== null;
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

/** 朋友在分享連結說已付款、新增了跟你有關的花費：首頁也提醒，點了直接確認 */
function SplitInbox() {
  const { data: groups = [] } = useSplitGroups();
  const openSheet = useUi((s) => s.openSheet);
  return <InboxBanner count={groups.reduce((s, g) => s + inboxCount(g), 0)} onOpen={() => openSheet({ kind: 'splitInbox' })} />;
}
