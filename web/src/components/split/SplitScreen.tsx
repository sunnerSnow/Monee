'use client';

import { ChevronLeft, Info, Plane, Plus } from 'lucide-react';
import Link from 'next/link';
import { useSplitGroups } from '@/lib/data';
import { money } from '@/lib/money';
import { friendTotals, inboxCount, isEmptyGroup, isSettled, myNet, openExpenses } from '@/lib/split';
import { useUi } from '@/lib/ui-store';
import { EmptyBox, ErrorBox, LoadingBlocks, useHidden } from '../ui';
import { Avatars, InboxBanner, OweText, kindLabel, shortDate } from './parts';


export function SplitScreen() {
  const groupsQ = useSplitGroups();
  const hidden = useHidden();
  const openSheet = useUi((s) => s.openSheet);

  const header = (
    <header className="flex min-h-12 items-center gap-1">
      <Link href="/assets" aria-label="返回資產" className="icon-btn ghost press"><ChevronLeft size={20} strokeWidth={1.5} aria-hidden /></Link>
      <h1 className="h-page">分帳<span className="en">Split</span></h1>
    </header>
  );
  const addButton = (
    <div className="grid grid-cols-2 gap-2.5">
      <button type="button" onClick={() => openSheet({ kind: 'splitGroup' })} className="press flex min-h-[52px] items-center justify-center gap-2 rounded-lg border border-dashed border-dash text-body-s tracking-[.08em]">
        <Plus size={18} strokeWidth={1.5} aria-hidden />建立群組
      </button>
      <button type="button" onClick={() => openSheet({ kind: 'splitGroup', groupKind: 'trip' })} className="press flex min-h-[52px] items-center justify-center gap-2 rounded-lg border border-dashed border-dash text-body-s tracking-[.08em]">
        <Plane size={18} strokeWidth={1.5} aria-hidden />建立旅程
      </button>
    </div>
  );
  if (groupsQ.isPending) return <>{header}<LoadingBlocks /></>;
  if (groupsQ.error) return <>{header}<ErrorBox message={groupsQ.error.message} onRetry={() => groupsQ.refetch()} /></>;

  const groups = groupsQ.data ?? [];
  if (!groups.length) {
    return (
      <>
        {header}
        <EmptyBox title="還沒有分帳群組">室友、午餐團、一起出遊的朋友都可以建一個群組。誰先付都能記，你的帳只算你的部分，最後一起結算。</EmptyBox>
        {addButton}
      </>
    );
  }

  const open = groups.filter((g) => !isSettled(g));
  const settled = groups.filter(isSettled);
  const totals = friendTotals(groups);

  return (
    <>
      {header}
      <div className="grid grid-cols-2 gap-2.5">
        <div className="flex flex-col gap-1 rounded-sm bg-cream px-3.5 py-3"><span className="caption">朋友欠你</span><span className="num text-[16px]">{money(totals.recv, hidden)}</span></div>
        <div className="flex flex-col gap-1 rounded-sm bg-fill px-3.5 py-3"><span className="caption">你欠朋友</span><span className="num text-[16px]">{money(totals.pay, hidden)}</span></div>
      </div>

      <InboxBanner count={groups.reduce((s, g) => s + inboxCount(g), 0)} onOpen={() => openSheet({ kind: 'splitInbox' })} />

      <section aria-labelledby="groups-title" className="flex flex-col gap-2.5">
        <h2 id="groups-title" className="h-sec px-1">群組<span className="en">Groups</span></h2>
        {addButton}
        {open.map((g) => {
          const list = openExpenses(g);
          const total = list.reduce((s, e) => s + e.amount, 0);
          return (
            <Link key={g.id} href={`/split/${g.id}`} className="card press flex flex-col gap-3 px-5 py-4">
              <span className="flex items-center justify-between gap-3">
                <span className="truncate text-body font-medium tracking-[.08em]">{g.name}</span>
                <span className="flex-none rounded-full bg-fill px-2.5 py-0.5 text-caption text-muted">{kindLabel(g)}</span>
              </span>
              <span className="flex items-center justify-between gap-3">
                <span className="flex min-w-0 items-center gap-2.5">
                  <Avatars members={g.members} />
                  <span className="caption truncate">{list.length ? `未結清 ${list.length} 筆・${money(total, hidden)}` : '還沒有花費'}</span>
                </span>
                {!isEmptyGroup(g) && <OweText value={myNet(g)} hidden={hidden} />}
              </span>
            </Link>
          );
        })}
      </section>

      {settled.length > 0 && (
        <details className="group">
          <summary className="press inline-flex min-h-11 cursor-pointer list-none items-center gap-1.5 px-1 text-body-s tracking-[.08em] [&::-webkit-details-marker]:hidden">
            已結清 {settled.length} 個群組<span aria-hidden className="text-muted group-open:hidden">＋</span><span aria-hidden className="hidden text-muted group-open:inline">－</span>
          </summary>
          <ul className="card py-1">
            {settled.map((g) => (
              <li key={g.id}>
                <Link href={`/split/${g.id}`} className="row press">
                  <Avatars members={g.members.filter((m) => !m.isMe)} max={3} />
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-body">{g.name}</span>
                    <span className="truncate text-caption tracking-[.06em] text-muted">{shortDate(g.rounds[0].closedAt)} 結清・共 {g.expenses.length} 筆</span>
                  </span>
                  <span className="flex-none text-caption text-muted">已結清</span>
                </Link>
              </li>
            ))}
          </ul>
        </details>
      )}

      <p className="flex items-start gap-2 px-1 text-caption leading-[1.7] text-muted">
        <Info size={16} strokeWidth={1.5} aria-hidden className="mt-0.5 flex-none" />
        <span>朋友只要名字，不用註冊。全部還清的群組會自動收到「已結清」，有新花費就會回到上面。</span>
      </p>
    </>
  );
}
