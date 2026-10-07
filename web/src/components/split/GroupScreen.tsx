'use client';

import { ArrowRight, Check, ChevronLeft, Ellipsis, Info, Plus, Share2 } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { getCategory } from '@/lib/categories';
import { useAccounts, useDeleteSettlement, useSplitGroups } from '@/lib/data';
import { dayLabel } from '@/lib/dates';
import { formatMoney, money } from '@/lib/money';
import { balances, isEmptyGroup, meOf, memberName, modeText, myShare, openExpenses, openSettlements, suggestTransfers, waitingClaims } from '@/lib/split';
import type { SplitGroup } from '@/lib/types';
import { useUi } from '@/lib/ui-store';
import { useNow } from '@/lib/use-now';
import { EmptyBox, ErrorBox, LoadingBlocks, useHidden } from '../ui';
import { Avatars, InboxBanner, MemberAvatar, memberLabel, shortDate } from './parts';

export function GroupScreen({ id }: { id: string }) {
  const groupsQ = useSplitGroups();
  const hidden = useHidden();
  const openSheet = useUi((s) => s.openSheet);
  const [tab, setTab] = useState<'expenses' | 'settle'>('expenses');
  const g = groupsQ.data?.find((x) => x.id === id);

  const header = (
    <header className="flex min-h-12 items-center gap-1">
      <Link href="/split" aria-label="返回分帳" className="icon-btn ghost press"><ChevronLeft size={20} strokeWidth={1.5} aria-hidden /></Link>
      <h1 className="h-page min-w-0 flex-1 truncate">{g?.name ?? '分帳'}</h1>
      {g && (
        <>
          <button type="button" onClick={() => openSheet({ kind: 'splitShare', groupId: g.id })} aria-label={g.shareToken ? '分享給朋友（分享中）' : '分享給朋友'} aria-haspopup="dialog" className={`icon-btn press ${g.shareToken ? 'border-transparent bg-brand text-ink' : ''}`}>
            <Share2 size={18} strokeWidth={1.5} aria-hidden />
          </button>
          <button type="button" onClick={() => openSheet({ kind: 'splitGroup', groupId: g.id })} aria-label="群組設定" aria-haspopup="dialog" className="icon-btn press">
            <Ellipsis size={20} strokeWidth={1.5} aria-hidden />
          </button>
        </>
      )}
    </header>
  );
  if (groupsQ.isPending) return <>{header}<LoadingBlocks /></>;
  if (groupsQ.error) return <>{header}<ErrorBox message={groupsQ.error.message} onRetry={() => groupsQ.refetch()} /></>;
  if (!g) return <>{header}<EmptyBox title="找不到這個群組">可能已經刪除，回到分帳頁看看。</EmptyBox></>;

  const net = balances(g);
  const me = meOf(g)!;
  const mine = net[me.id] ?? 0;
  const list = openExpenses(g);
  const total = list.reduce((s, e) => s + e.amount, 0);
  // 剛建好的群組還沒有花費，不是「已結清」
  const empty = isEmptyGroup(g);

  return (
    <>
      {header}
      <section aria-label="你在這個群組" className="card flex flex-col gap-3 p-5">
        <span className="caption">{mine > 0 ? '朋友總共欠你' : mine < 0 ? '你總共要付' : '你在這個群組'}</span>
        <p className={`display m-0 text-display-m leading-[1.2] ${mine < 0 ? 'text-alert' : ''}`}>
          {mine ? <><small>$</small>{hidden ? '••••' : Math.abs(mine).toLocaleString('en-US')}</> : empty ? '還沒有花費' : '已結清'}
        </p>
        <div className="flex items-center justify-between gap-3">
          <Avatars members={g.members} />
          <span className="caption truncate">
            {g.members.length} 人・{list.length ? `未結清 ${list.length} 筆・${money(total, hidden)}` : g.rounds.length ? `${shortDate(g.rounds[0].closedAt)} 結清` : '還沒有花費'}
          </span>
        </div>
      </section>

      <InboxBanner count={waitingClaims(g).length} onOpen={() => openSheet({ kind: 'splitInbox', groupId: g.id })} />

      <div role="tablist" aria-label="群組內容" className="seg-tabs">
        <button type="button" role="tab" id="tab-expenses" aria-selected={tab === 'expenses'} aria-controls="panel-expenses" onClick={() => setTab('expenses')} className="press">花費 {list.length}</button>
        <button type="button" role="tab" id="tab-settle" aria-selected={tab === 'settle'} aria-controls="panel-settle" onClick={() => setTab('settle')} className="press">結算</button>
      </div>

      {tab === 'expenses'
        ? <div role="tabpanel" id="panel-expenses" aria-labelledby="tab-expenses" className="flex flex-col gap-5"><Expenses g={g} /></div>
        : <div role="tabpanel" id="panel-settle" aria-labelledby="tab-settle" className="flex flex-col gap-5"><Settle g={g} net={net} /></div>}
    </>
  );
}

function Expenses({ g }: { g: SplitGroup }) {
  const now = useNow();
  const hidden = useHidden();
  const openSheet = useUi((s) => s.openSheet);
  const list = openExpenses(g);
  const days = new Map<string, typeof list>();
  for (const e of list) days.set(e.date, [...(days.get(e.date) ?? []), e]);

  return (
    <>
      <button type="button" onClick={() => openSheet({ kind: 'splitExpense', groupId: g.id })} aria-haspopup="dialog" className="press flex min-h-[52px] items-center justify-center gap-2 rounded-lg border border-dashed border-dash text-body-s tracking-[.08em]">
        <Plus size={18} strokeWidth={1.5} aria-hidden />新增花費
      </button>
      {list.length === 0 && (g.rounds.length
        ? <EmptyBox title="目前沒有未結清的花費">{shortDate(g.rounds[0].closedAt)} 全部結清了。新的花費記在這裡，之前的收在下面。</EmptyBox>
        : <EmptyBox title="還沒有花費">出去玩的一整天可以一筆一筆記，每筆可以是不同人先付，最後再一起結算。</EmptyBox>)}
      {[...days].map(([date, items]) => (
        <section key={date} aria-label={now ? dayLabel(date, now) : date} className="flex flex-col gap-1.5">
          <div className="flex justify-between gap-2 px-1 text-caption tracking-[.08em] text-muted">
            <span>{now ? dayLabel(date, now) : date}</span>
            <span className="num">{money(items.reduce((s, e) => s + e.amount, 0), hidden)}</span>
          </div>
          <ul className="card py-1">
            {items.map((e) => {
              const Icon = getCategory(e.categoryId).icon;
              const share = myShare(g, e);
              return (
                <li key={e.id}>
                  <button type="button" onClick={() => openSheet({ kind: 'splitDetail', groupId: g.id, expenseId: e.id })} aria-haspopup="dialog" className="row press">
                    <span aria-hidden className="ico"><Icon size={20} strokeWidth={1.5} /></span>
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="truncate text-body">{e.title}</span>
                      <span className="truncate text-caption tracking-[.06em] text-muted">{memberName(g, e.payerId)}付 {money(e.amount, hidden)}・{modeText(e)}</span>
                    </span>
                    <span className="flex flex-none flex-col items-end gap-0.5">
                      {share ? <><span className="num text-body">{money(share, hidden)}</span><span className="caption">你的部分</span></> : <span className="caption">沒參與</span>}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      {g.rounds.length > 0 && (
        <section aria-labelledby="rounds-title" className="flex flex-col gap-2.5">
          <h2 id="rounds-title" className="h-sec px-1">已結清的紀錄<span className="en">History</span></h2>
          <ul className="card py-1">
            {g.rounds.map((r) => {
              const items = g.expenses.filter((e) => e.roundId === r.id);
              const dates = items.map((e) => e.date).sort();
              const share = items.reduce((s, e) => s + myShare(g, e), 0);
              return (
                <li key={r.id}>
                  <button type="button" onClick={() => openSheet({ kind: 'splitRound', groupId: g.id, roundId: r.id })} aria-haspopup="dialog" className="row press">
                    <span aria-hidden className="ico tr"><Check size={20} strokeWidth={1.5} /></span>
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="truncate text-body">{shortDate(r.closedAt)} 結清</span>
                      <span className="truncate text-caption tracking-[.06em] text-muted">
                        {dates.length ? `${shortDate(dates[0])}${dates[0] !== dates.at(-1) ? `–${shortDate(dates.at(-1)!)}` : ''}・` : ''}{items.length} 筆・總花費 {money(items.reduce((s, e) => s + e.amount, 0), hidden)}
                      </span>
                    </span>
                    <span className="flex flex-none flex-col items-end gap-0.5"><span className="num text-body">{money(share, hidden)}</span><span className="caption">你的部分</span></span>
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="flex items-start gap-2 px-1 text-caption leading-[1.7] text-muted">
            <Info size={16} strokeWidth={1.5} aria-hidden className="mt-0.5 flex-none" />
            <span>全部還清時，那段期間的花費會自動收到這裡。你的明細裡每一筆都還在。</span>
          </p>
        </section>
      )}
    </>
  );
}

function Settle({ g, net }: { g: SplitGroup; net: Record<string, number> }) {
  const hidden = useHidden();
  const openSheet = useUi((s) => s.openSheet);
  const showToast = useUi((s) => s.showToast);
  const { data: accounts = [] } = useAccounts();
  const removeSettlement = useDeleteSettlement();
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const me = meOf(g)!;
  const transfers = suggestTransfers(net);
  const paid = openSettlements(g);
  const max = Math.max(1, ...Object.values(net).map(Math.abs));

  const undo = async (sid: string) => {
    try {
      await removeSettlement.mutateAsync(sid);
      setConfirmId(null);
      showToast('已刪除這筆還款，結算重新計算了');
    } catch (e) {
      showToast(e instanceof Error ? e.message : '刪除失敗，請再試一次');
    }
  };

  const history = paid.length > 0 && (
    <section aria-labelledby="paid-title" className="flex flex-col gap-2.5">
      <h2 id="paid-title" className="h-sec px-1">已還款<span className="en">Paid</span></h2>
      <ul className="flex flex-col gap-2">
        {paid.map((s) => (
          <li key={s.id} className="flex flex-col gap-2 rounded-md border border-dashed border-line px-4 py-3">
            <div className="flex items-center gap-2.5 text-body-s text-muted">
              <span className="min-w-0 flex-1">{memberName(g, s.fromId)} → {memberName(g, s.toId)}・{shortDate(s.date)}{s.accountId ? `・${accounts.find((a) => a.id === s.accountId)?.name ?? ''}` : ''}</span>
              <span className="num text-body text-fg">{money(s.amount, hidden)}</span>
              {confirmId !== s.id && <button type="button" onClick={() => setConfirmId(s.id)} className="caption press min-h-11 px-1 underline">記錯了</button>}
            </div>
            {confirmId === s.id && (
              <div role="alertdialog" aria-label="刪除這筆還款" className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setConfirmId(null)} className="btn-secondary press" autoFocus>取消</button>
                <button type="button" onClick={() => undo(s.id)} disabled={removeSettlement.isPending} className="btn-secondary press border-alert text-alert">刪除這筆還款</button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );

  if (!transfers.length && isEmptyGroup(g)) {
    return (
      <div className="card flex flex-col items-center gap-2 p-5 text-center">
        <Image src="/monee.png" alt="" width={110} height={80} className="h-auto w-[110px]" />
        <p className="h-sec">還沒有花費</p>
        <p className="caption leading-[1.8]">到「花費」分頁記第一筆。記了之後，這裡會算出每個人該付多少、怎麼還最省事。</p>
      </div>
    );
  }

  if (!transfers.length) {
    return (
      <>
        <div className="card flex flex-col items-center gap-2 p-5 text-center">
          <Image src="/monee.png" alt="" width={110} height={80} className="h-auto w-[110px]" />
          <p className="h-sec">都結清了</p>
          <p className="caption leading-[1.8]">這個群組沒有人欠錢。{g.rounds.length ? '之前的花費收在「花費」分頁下面的已結清紀錄，' : ''}之後有新花費繼續記在這裡就好。</p>
        </div>
        {history}
      </>
    );
  }

  return (
    <>
      <section aria-label="每個人的淨額" className="card py-1">
        <ul>
          {g.members.map((m) => {
            const v = net[m.id] ?? 0;
            return (
              <li key={m.id} className="grid grid-cols-[32px_minmax(0,1fr)_auto] items-center gap-3 px-5 py-2.5">
                <MemberAvatar member={m} />
                <span className="flex min-w-0 flex-col">
                  <span className="text-body-s">{memberLabel(m)}</span>
                  <span aria-hidden className="relative mt-1.5 h-1.5 overflow-hidden rounded-full bg-fill">
                    <span className="absolute inset-y-0 left-1/2 w-px bg-line-strong" />
                    {v !== 0 && <i className={`absolute inset-y-0 rounded-full ${v > 0 ? 'left-1/2 bg-fg' : 'right-1/2 bg-alert'}`} style={{ width: `${(Math.abs(v) / max) * 50}%` }} />}
                  </span>
                </span>
                {v === 0
                  ? <span className="caption">已結清</span>
                  : <span className={`num whitespace-nowrap text-body ${v < 0 ? 'text-alert' : ''}`}><span className="mr-1.5 font-sans text-caption text-muted">{v > 0 ? '應收' : '應付'}</span>{money(Math.abs(v), hidden)}</span>}
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="suggest-title" className="flex flex-col gap-2.5">
        <h2 id="suggest-title" className="h-sec px-1">建議怎麼還<span className="en">Settle up</span></h2>
        <p className="caption -mt-1 px-1">{transfers.length} 筆轉帳就能全部結清（不用每筆花費各自還）</p>
        <ul className="flex flex-col gap-2">
          {transfers.map((t) => {
            // 朋友已經在分享頁說付了：直接去待確認
            const claimed = waitingClaims(g).find((c) => c.fromId === t.fromId && c.toId === t.toId);
            const label = claimed ? '確認' : t.toId === me.id ? '記錄已收款' : t.fromId === me.id ? '我已付款' : '標記已付';
            return (
              <li key={`${t.fromId}-${t.toId}`} className="flex items-center gap-2.5 rounded-md border border-line bg-surface px-4 py-3">
                <span className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5 text-body-s">
                  {memberName(g, t.fromId)}<ArrowRight size={14} strokeWidth={1.5} aria-label="付給" className="text-muted" />{memberName(g, t.toId)}
                  {claimed && <span className="rounded-full bg-warn-tint px-2 py-px text-[11px] text-warn-fg">說已付 {money(claimed.amount, hidden)}</span>}
                </span>
                <span className="num text-body">{money(t.amount, hidden)}</span>
                <button
                  type="button"
                  onClick={() => openSheet(claimed ? { kind: 'splitInbox', groupId: g.id } : { kind: 'splitSettle', groupId: g.id, fromId: t.fromId, toId: t.toId, amount: t.amount })}
                  aria-haspopup="dialog"
                  className="btn-secondary press min-h-10 px-3 text-caption"
                >
                  {label}
                </button>
              </li>
            );
          })}
        </ul>
        <p className="flex items-start gap-2 px-1 text-caption leading-[1.7] text-muted">
          <Info size={16} strokeWidth={1.5} aria-hidden className="mt-0.5 flex-none" />
          <span>朋友之間的還款不影響你的帳，他們自己處理就好，任何人都可以幫忙標記已付。總共還 {formatMoney(transfers.reduce((s, t) => s + t.amount, 0))}。</span>
        </p>
      </section>
      {history}
    </>
  );
}
