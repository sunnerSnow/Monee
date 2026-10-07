'use client';

import { ArrowRight, CreditCard, Info, Landmark, Plus, TrendingUp, Users, Wallet, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { accountSummary } from '@/lib/budget';
import { useAccounts, useProfile, useSplitGroups } from '@/lib/data';
import { isEmptyGroup, isSettled, myNet } from '@/lib/split';
import { formatMoney, money, signedBalance } from '@/lib/money';
import type { Account, PnlColor, SplitGroup } from '@/lib/types';
import { useUi } from '@/lib/ui-store';
import { Avatars, OweText, kindLabel } from '../split/parts';
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

  const accounts = accountsQ.data ?? [];
  if (!accounts.length) {
    return <>{header}<EmptyBox title="還沒有帳戶">新增現金、銀行或信用卡，Monee 就能幫你算出淨資產。</EmptyBox>{addButton}</>;
  }

  const s = accountSummary(accounts);
  const pnlColor: PnlColor = profileQ.data?.pnlColor ?? 'red_up';

  const row = (a: Account) => {
    const Icon = ICONS[a.type];
    const body = (
      <>
        <span aria-hidden className="ico"><Icon size={20} strokeWidth={1.5} /></span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate text-body">{a.name}</span>
          <span className="truncate text-caption tracking-[.06em] text-muted">
            {a.type === 'INVESTMENT_MIRROR' ? (a.investmentSnapshot ? 'Monee Invest 同步' : '手動填寫・之後由 Monee Invest 同步') : `${a.type === 'CREDIT_CARD' ? '本期待繳・' : ''}${reconciledLabel(a)}`}
          </span>
        </span>
        <span className="flex flex-none flex-col items-end gap-1">
          <span className="num text-body">{signedBalance(a.currentBalance, hidden)}</span>
          {a.type === 'INVESTMENT_MIRROR'
            ? a.investmentSnapshot && (
              <span className={`pnl ${pnlColor}`}>
                {hidden ? '▲ ••••' : `${a.investmentSnapshot.unrealizedPnl >= 0 ? '▲' : '▼'} ${formatMoney(a.investmentSnapshot.unrealizedPnl)} (${a.investmentSnapshot.pnlPercentage}%)`}
              </span>
            )
            : <span className="caption">校準餘額</span>}
        </span>
      </>
    );
    // 投資帳戶的市值變動不是收入或支出，不提供校準，避免汙染生活報表
    return (
      <li key={a.id}>
        {a.type === 'INVESTMENT_MIRROR'
          ? <div className="row">{body}</div>
          : <button type="button" onClick={() => openSheet({ kind: 'reconcile', accountId: a.id })} className="row press">{body}</button>}
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
          <div className="flex flex-col gap-1 rounded-sm bg-fill px-3.5 py-3">
            <span className="caption">資產</span><span className="num text-[16px]">{money(s.assets, hidden)}</span>
          </div>
          <div className="flex flex-col gap-1 rounded-sm bg-fill px-3.5 py-3">
            <span className="caption">負債</span><span className="num text-[16px]">{signedBalance(s.liabilities, hidden)}</span>
          </div>
        </div>
      </section>
      {group('g-liquid', '現金與銀行', s.liquid, s.liquidSum)}
      {group('g-cards', '信用卡待繳', s.cards, s.cardSum)}
      {group('g-invest', '投資帳戶', s.investments, s.investSum)}
      <FriendsSection groups={splitQ.data ?? []} balance={s.friendsSum} hidden={hidden} />
      <p className="flex items-start gap-2 px-1 text-caption leading-[1.7] text-muted">
        <Info size={16} strokeWidth={1.5} aria-hidden className="mt-0.5 flex-none" />
        <span>點帳戶可以校準餘額。轉進投資帳戶的錢會記成「轉帳」，不會算進生活支出。</span>
      </p>
      {addButton}
    </>
  );
}

/** 朋友往來：分帳的入口。列出還沒結清的群組，結清的收在分帳頁 */
function FriendsSection({ groups, balance, hidden }: { groups: SplitGroup[]; balance: number; hidden: boolean }) {
  const open = groups.filter((g) => !isSettled(g));
  const settled = groups.length - open.length;
  return (
    <section aria-labelledby="g-friends" className="flex flex-col gap-2">
      <h2 id="g-friends" className="flex items-baseline justify-between px-1 text-body-s font-normal tracking-[.1em] text-muted">
        <span>朋友往來</span><span className="num">{signedBalance(balance, hidden)}</span>
      </h2>
      <ul className="card py-1">
        {open.length ? open.map((g) => (
          <li key={g.id}>
            <Link href={`/split/${g.id}`} className="row press">
              <Avatars members={g.members.filter((m) => !m.isMe)} max={3} />
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-body">{g.name}</span>
                <span className="truncate text-caption tracking-[.06em] text-muted">{kindLabel(g)}・{g.members.length} 人</span>
              </span>
              <OweText value={myNet(g)} hidden={hidden} empty={isEmptyGroup(g)} />
            </Link>
          </li>
        )) : (
          <li>
            <Link href="/split" className="row press">
              <span aria-hidden className="ico"><Users size={20} strokeWidth={1.5} /></span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-body">{groups.length ? '都結清了' : '跟朋友分帳'}</span>
                <span className="truncate text-caption tracking-[.06em] text-muted">{groups.length ? '有新的一起付的花費，到分帳頁記' : '誰先付都能記，你的帳只算你的部分'}</span>
              </span>
              <ArrowRight size={18} strokeWidth={1.5} aria-hidden className="text-muted" />
            </Link>
          </li>
        )}
      </ul>
      {groups.length > 0 && (
        <Link href="/split" className="press inline-flex min-h-11 items-center gap-1 self-end px-1 text-body-s tracking-[.08em]">
          {settled ? `已結清 ${settled} 個・` : ''}全部分帳<ArrowRight size={16} strokeWidth={1.5} aria-hidden />
        </Link>
      )}
    </section>
  );
}
