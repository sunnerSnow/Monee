'use client';

import { ArrowRight, ChevronRight, Plane } from 'lucide-react';
import Link from 'next/link';
import { useSplitGroups } from '@/lib/data';
import { money } from '@/lib/money';
import { activeTrip, isSettled, myNet, myTripSpend, tripDay, tripLength } from '@/lib/split';
import { SectionHeader, useHidden } from '../ui';
import { GroupRow, NewGroupButtons } from './parts';

const MORE = 'press inline-flex min-h-11 items-center gap-1 px-1 text-body-s tracking-[.08em]';
/** 首頁最多列幾個還沒結清的群組，其他的到分帳頁看 */
const MAX_ROWS = 3;

/** 旅程期間放在首頁上面：第幾天、你花了多少、預算還剩多少，點了到旅程頁。旅程結束就不顯示 */
export function TripNowCard({ today }: { today: string }) {
  const { data: groups = [] } = useSplitGroups();
  const hidden = useHidden();
  const g = activeTrip(groups, today);
  if (!g) return null;
  const spent = myTripSpend(g);
  const left = g.budget ? g.budget - spent : null;
  const mine = g.members.length > 1 ? myNet(g) : 0;
  const detail = [
    `你花了 ${money(spent, hidden)}`,
    left === null ? '' : left < 0 ? `超出預算 ${money(-left, hidden)}` : `預算還剩 ${money(left, hidden)}`,
    mine < 0 ? `你要付 ${money(-mine, hidden)}` : mine > 0 ? `朋友欠你 ${money(mine, hidden)}` : '',
  ].filter(Boolean).join('・');
  return (
    <Link href={`/split/${g.id}`} className="card press flex items-center gap-3 px-5 py-4">
      <span aria-hidden className="ico" style={{ background: 'var(--teal)' }}><Plane size={20} strokeWidth={1.5} /></span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex min-w-0 items-baseline gap-2">
          <span className="truncate text-body font-medium tracking-[.06em]">{g.name}</span>
          <span className="caption flex-none">第 {tripDay(g, today)} 天・共 {tripLength(g)} 天</span>
        </span>
        <span className="line-clamp-2 text-caption tracking-[.04em] text-muted">{detail}</span>
      </span>
      <ChevronRight size={18} strokeWidth={1.5} aria-hidden className="-mr-1 flex-none text-muted" />
    </Link>
  );
}

/** 首頁的分帳區塊：還沒結清的群組（最多三個）、建立群組／旅程，右上角到全部分帳 */
export function SplitHomeSection() {
  const { data: groups, isPending } = useSplitGroups();
  const hidden = useHidden();
  if (isPending || !groups) return null;
  const active = groups.filter((g) => !g.archivedAt);
  const open = active.filter((g) => !isSettled(g));
  const more = open.length - MAX_ROWS;
  return (
    <section aria-labelledby="split-title" className="flex flex-col gap-2.5">
      <SectionHeader id="split-title" title="分帳" en="Split" action={
        <Link href="/split" className={MORE}>全部分帳<ArrowRight size={16} strokeWidth={1.5} aria-hidden /></Link>
      } />
      {open.length > 0 ? (
        <ul className="card py-1">
          {open.slice(0, MAX_ROWS).map((g) => <li key={g.id}><GroupRow g={g} hidden={hidden} /></li>)}
          {more > 0 && (
            <li>
              <Link href="/split" className="row press min-h-12 justify-center text-body-s text-muted">還有 {more} 個群組</Link>
            </li>
          )}
        </ul>
      ) : (
        <p className="px-1 text-body-s leading-[1.8] text-muted">
          {active.length ? '都結清了。有新的一起付的花費，按 ＋ 打開「分帳」就能記。' : '室友、午餐團、一起出遊都能建群組。誰先付都能記，你的帳只算你的部分。'}
        </p>
      )}
      <NewGroupButtons />
    </section>
  );
}
