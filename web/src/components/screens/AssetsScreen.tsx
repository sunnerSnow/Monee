'use client';

import { ArrowRight, ChevronRight, CreditCard, Info, Landmark, Plus, TrendingUp, Users, Wallet, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { activeAccounts } from '@/lib/accounts';
import { accountSummary } from '@/lib/budget';
import { useAccounts, useProfile, useSplitGroups } from '@/lib/data';
import { isSettled } from '@/lib/split';
import { formatMoney, money, signedBalance } from '@/lib/money';
import { ACCOUNT_COLORS } from '@/lib/palette';
import type { Account, PnlColor, SplitGroup } from '@/lib/types';
import { useUi } from '@/lib/ui-store';
import { GoalsSection } from '../Goals';
import { GroupRow } from '../split/parts';
import { BigMoney, EmptyBox, ErrorBox, LoadingBlocks, PageHeader, useHidden } from '../ui';

const ICONS: Record<Account['type'], LucideIcon> = {
  CASH: Wallet,
  BANK: Landmark,
  CREDIT_CARD: CreditCard,
  INVESTMENT_MIRROR: TrendingUp,
  FRIENDS: Users,
};

const reconciledLabel = (a: Account) => {
  if (!a.lastReconciledAt) return '尚未校準';
  const d = new Date(a.lastReconciledAt);
  return `上次校準 ${d.getMonth() + 1}/${d.getDate()}`;
};

export function AssetsScreen() {
  const accountsQ = useAccounts();
  const profileQ = useProfile();
  const splitQ = useSplitGroups();
  const hidden = useHidden();
  const openSheet = useUi((s) => s.openSheet);

  const header = <PageHeader title="資產" en="Assets" />;
  const addButton = (
    <button type="button" onClick={() => openSheet({ kind: 'account' })} className="press flex min-h-[52px] items-center justify-center gap-2 rounded-lg border border-dashed border-dash text-body-s tracking-[.08em]">
      <Plus size={18} strokeWidth={1.5} aria-hidden />新增帳戶
    </button>
  );
  if (accountsQ.isPending) return <>{header}<LoadingBlocks /></>;
  if (accountsQ.error) return <>{header}<ErrorBox message={accountsQ.error.message} onRetry={() => accountsQ.refetch()} /></>;

  const all = accountsQ.data ?? [];
  const accounts = activeAccounts(all);
  const archived = all.filter((a) => a.archived && a.type !== 'FRIENDS');
  if (!accounts.length && !archived.length) {
    return <>{header}<EmptyBox title="還沒有帳戶">新增現金、銀行或信用卡，Monee 就能幫你算出淨資產。</EmptyBox>{addButton}</>;
  }

  const s = accountSummary(accounts);
  const pnlColor: PnlColor = profileQ.data?.pnlColor ?? 'red_up';

  // 點帳戶打開帳戶設定：校準、改名、期初餘額、封存、刪除
  const row = (a: Account) => {
    const Icon = ICONS[a.type];
    return (
      <li key={a.id}>
        <button type="button" onClick={() => openSheet({ kind: 'account', accountId: a.id })} className="row press">
          <span aria-hidden className="ico" style={{ background: ACCOUNT_COLORS[a.type] }}><Icon size={20} strokeWidth={1.5} /></span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="truncate text-body">{a.name}</span>
            <span className="line-clamp-2 text-caption tracking-[.06em] text-muted">
              {a.archived ? '已封存' : a.type === 'INVESTMENT_MIRROR' ? (a.investmentSnapshot ? 'Monee Invest 同步' : '手動填寫・之後由 Monee Invest 同步') : `${a.type === 'CREDIT_CARD' ? '本期待繳・' : ''}${reconciledLabel(a)}`}
            </span>
          </span>
          <span className="flex flex-none flex-col items-end gap-1">
            <span className="num text-body">{signedBalance(a.currentBalance, hidden)}</span>
            {a.type === 'INVESTMENT_MIRROR' && a.investmentSnapshot && !a.archived && (
              <span className={`pnl ${pnlColor}`}>
                {hidden ? '▲ ••••' : `${a.investmentSnapshot.unrealizedPnl >= 0 ? '▲' : '▼'} ${formatMoney(a.investmentSnapshot.unrealizedPnl)} (${a.investmentSnapshot.pnlPercentage}%)`}
              </span>
            )}
          </span>
          <ChevronRight size={18} strokeWidth={1.5} aria-hidden className="-mr-1 flex-none text-muted" />
        </button>
      </li>
    );
  };

  const group = (id: string, title: string, list: Account[], total: number) => list.length > 0 && (
    <section aria-labelledby={id} className="flex flex-col gap-2">
      <h2 id={id} className="flex items-baseline justify-between px-1 text-body-s font-normal tracking-[.1em] text-muted">
        <span>{title}</span><span className="num">{signedBalance(total, hidden)}</span>
      </h2>
      <ul className="card py-1">{list.map(row)}</ul>
    </section>
  );

  return (
    <>
      {header}
      <section aria-labelledby="net-title" className="card flex flex-col gap-3 p-5">
        <span id="net-title" className="caption">淨資產</span>
        <BigMoney value={s.net} className="text-display-l leading-[1.15]" />
        <div className="grid grid-cols-2 gap-2.5">
          <div className="flex flex-col gap-1 rounded-sm border-2 border-ink bg-fill px-3.5 py-3">
            <span className="caption">資產</span><span className="num text-[16px]">{money(s.assets, hidden)}</span>
          </div>
          <div className="flex flex-col gap-1 rounded-sm border-2 border-ink bg-fill px-3.5 py-3">
            <span className="caption">負債</span><span className="num text-[16px]">{signedBalance(s.liabilities, hidden)}</span>
          </div>
        </div>
      </section>
      <GoalsSection />
      {group('g-liquid', '現金與銀行', s.liquid, s.liquidSum)}
      {group('g-cards', '信用卡待繳', s.cards, s.cardSum)}
      {group('g-invest', '投資帳戶', s.investments, s.investSum)}
      <FriendsSection groups={splitQ.data ?? []} balance={s.friendsSum} hidden={hidden} />
      {archived.length > 0 && (
        <details className="group flex flex-col gap-2">
          <summary className="press inline-flex min-h-11 cursor-pointer list-none items-center gap-1.5 px-1 text-body-s tracking-[.1em] text-muted [&::-webkit-details-marker]:hidden">
            已封存的帳戶（{archived.length}）<span aria-hidden className="group-open:hidden">＋</span><span aria-hidden className="hidden group-open:inline">－</span>
          </summary>
          <ul className="card mt-2 py-1 opacity-80">{archived.map(row)}</ul>
        </details>
      )}
      <p className="flex items-start gap-2 px-1 text-caption leading-[1.7] text-muted">
        <Info size={16} strokeWidth={1.5} aria-hidden className="mt-0.5 flex-none" />
        <span>點帳戶可以校準餘額、改名、封存或刪除。轉進投資帳戶的錢會記成「轉帳」，不會算進生活支出。</span>
      </p>
      {addButton}
    </>
  );
}

/** 朋友往來：分帳的入口。列出還沒結清的群組，結清和封存的收在分帳頁 */
function FriendsSection({ groups, balance, hidden }: { groups: SplitGroup[]; balance: number; hidden: boolean }) {
  const active = groups.filter((g) => !g.archivedAt);
  const open = active.filter((g) => !isSettled(g));
  const settled = active.length - open.length;
  return (
    <section aria-labelledby="g-friends" className="flex flex-col gap-2">
      {/* 「全部分帳」放在標題列右邊（跟首頁的「全部明細」一樣），不要藏在卡片下面 */}
      <div className="flex items-center justify-between gap-2 px-1">
        <h2 id="g-friends" className="flex items-baseline gap-2 text-body-s font-normal tracking-[.1em] text-muted">
          <span>朋友往來</span><span className="num">{signedBalance(balance, hidden)}</span>
        </h2>
        {groups.length > 0 && (
          <Link href="/split" className="press -my-3 inline-flex min-h-11 items-center gap-1 px-1 text-body-s tracking-[.08em]">
            全部分帳{settled ? `（已結清 ${settled}）` : ''}<ArrowRight size={16} strokeWidth={1.5} aria-hidden />
          </Link>
        )}
      </div>
      <ul className="card py-1">
        {open.length ? open.map((g) => (
          <li key={g.id}><GroupRow g={g} hidden={hidden} /></li>
        )) : (
          <li>
            <Link href="/split" className="row press">
              <span aria-hidden className="ico" style={{ background: ACCOUNT_COLORS.FRIENDS }}><Users size={20} strokeWidth={1.5} /></span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-body">{active.length ? '都結清了' : groups.length ? '沒有進行中的群組' : '跟朋友分帳'}</span>
                <span className="truncate text-caption tracking-[.06em] text-muted">{groups.length ? '有新的一起付的花費，到分帳頁記' : '誰先付都能記，你的帳只算你的部分'}</span>
              </span>
              <ArrowRight size={18} strokeWidth={1.5} aria-hidden className="text-muted" />
            </Link>
          </li>
        )}
      </ul>
    </section>
  );
}
