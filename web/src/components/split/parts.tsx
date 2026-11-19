'use client';

import { Inbox, Plane, Plus } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { selectable } from '@/lib/accounts';
import { getCategory } from '@/lib/categories';
import { getCurrency } from '@/lib/currency';
import { formatMoney, money } from '@/lib/money';
import { initialOf, isEmptyGroup, meOf, myNet } from '@/lib/split';
import type { Account, SplitExpense, SplitGroup, SplitMember } from '@/lib/types';
import { useUi } from '@/lib/ui-store';

export const memberLabel = (m: SplitMember) => (m.isMe ? '我' : m.name);

export function MemberAvatar({ member }: { member: SplitMember }) {
  return <span aria-hidden className={`av ${member.isMe ? 'me' : ''}`}>{initialOf(memberLabel(member))}</span>;
}

export function Avatars({ members, max = 5 }: { members: SplitMember[]; max?: number }) {
  return <span aria-hidden className="avs">{members.slice(0, max).map((m) => <MemberAvatar key={m.id} member={m} />)}</span>;
}

/** 你應收／你應付／已結清；還沒有花費的群組顯示「還沒有花費」 */
export function OweText({ value, hidden, prefix = '你', empty = false }: { value: number; hidden: boolean; prefix?: string; empty?: boolean }) {
  if (empty) return <span className="flex-none text-caption text-muted">還沒有花費</span>;
  if (value === 0) return <span className="flex-none text-caption text-muted">已結清</span>;
  return (
    <span className={`num flex-none whitespace-nowrap text-body ${value < 0 ? 'text-alert' : ''}`}>
      <span className="mr-1.5 font-sans text-caption tracking-[.04em] text-muted">{prefix}{value > 0 ? '應收' : '應付'}</span>
      {money(Math.abs(value), hidden)}
    </span>
  );
}

/** 群組一列：朋友頭像、名稱、類型・人數、你應收／應付；點了到群組頁（資產頁、首頁共用） */
export function GroupRow({ g, hidden }: { g: SplitGroup; hidden: boolean }) {
  return (
    <Link href={`/split/${g.id}`} className="row press">
      <Avatars members={g.members.filter((m) => !m.isMe)} max={3} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-body">{g.name}</span>
        <span className="line-clamp-2 text-caption tracking-[.06em] text-muted">{kindLabel(g)}・{g.members.length} 人</span>
      </span>
      <OweText value={myNet(g)} hidden={hidden} empty={isEmptyGroup(g)} />
    </Link>
  );
}

/** 建立群組／建立旅程兩顆按鈕（分帳頁、首頁共用） */
export function NewGroupButtons() {
  const openSheet = useUi((s) => s.openSheet);
  const cls = 'press flex min-h-[52px] items-center justify-center gap-2 rounded-lg border border-dashed border-dash text-body-s tracking-[.08em]';
  return (
    <div className="grid grid-cols-2 gap-2.5">
      <button type="button" onClick={() => openSheet({ kind: 'splitGroup' })} aria-haspopup="dialog" className={cls}>
        <Plus size={18} strokeWidth={1.5} aria-hidden />建立群組
      </button>
      <button type="button" onClick={() => openSheet({ kind: 'splitGroup', groupKind: 'trip' })} aria-haspopup="dialog" className={cls}>
        <Plane size={18} strokeWidth={1.5} aria-hidden />建立旅程
      </button>
    </div>
  );
}

/** 付款用的帳戶：朋友往來由系統管理、投資帳戶只能轉入，都不能拿來付錢；封存的不列（keep 是編輯時原本用的帳戶） */
export const payableAccounts = (accounts: Account[], keep?: string | null) =>
  selectable(accounts, [keep]).filter((a) => a.type !== 'FRIENDS' && a.type !== 'INVESTMENT_MIRROR');
/** 收朋友還的錢：存進現金或銀行（封存的不列） */
export const receivingAccounts = (accounts: Account[]) => selectable(accounts).filter((a) => a.type === 'CASH' || a.type === 'BANK');

/** 這筆花費怎麼記進你的個人帳（跟資料庫 split_save_expense 的規則一致）；original 是外幣原額，例如「¥3,000」 */
export function effectLines(
  group: SplitGroup,
  e: Pick<SplitExpense, 'amount' | 'amounts' | 'payerId' | 'accountId' | 'categoryId'>,
  accounts: Account[],
  original?: string,
): ReactNode[] {
  const me = meOf(group);
  const mine = me ? e.amounts[me.id] ?? 0 : 0;
  const cat = getCategory(e.categoryId).name;
  const b = (n: number) => <b className="num font-normal">{formatMoney(n)}</b>;
  const solo = group.members.length === 1;
  // 旅程設定不算進每月預算時，提醒這筆不會吃掉今日額度
  const budgetNote = mine && group.kind === 'trip' && group.excludeFromBudget ? ['旅程花費，不算進每月預算'] : [];
  if (me && e.payerId === me.id) {
    const lent = e.amount - mine;
    const acct = accounts.find((a) => a.id === e.accountId)?.name ?? '付款帳戶';
    return [
      <>{acct}實付 {b(e.amount)}{original ? `（${original}）` : ''}</>,
      mine ? <>你的支出 {b(mine)}（{cat}）{solo ? '' : '，報表和預算只算你的部分'}</> : '你沒有參與，不算你的支出',
      ...(lent > 0 ? [<>代墊 {b(lent)} 記在朋友往來，等朋友還你</>] : []),
      ...budgetNote,
    ];
  }
  const payer = group.members.find((m) => m.id === e.payerId)?.name ?? '朋友';
  if (mine) return [<>{payer}先付{original ? ` ${original}` : ''}，你這次不用掏錢</>, <>你的支出 {b(mine)}（{cat}）</>, <>欠 {payer} {b(mine)}，記在朋友往來</>, ...budgetNote];
  return ['你沒有參與，不影響你的帳'];
}

/** 朋友說已付款、等你確認的提示；點了打開待確認 */
export function InboxBanner({ count, onOpen }: { count: number; onOpen: () => void }) {
  if (!count) return null;
  return (
    <button type="button" onClick={onOpen} aria-haspopup="dialog" className="sticker press flex min-h-14 w-full rotate-[.8deg] items-center gap-3 rounded-[var(--radius-panel)] border-[2.5px] border-ink bg-brand px-4 py-3 text-left font-display text-[15px] tracking-[.06em] shadow-[var(--pop)]">
      <Inbox size={20} strokeWidth={2} aria-hidden />
      <span className="flex-1">有 {count} 件分帳等你確認</span>
      <span className="num inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-ink px-1.5 text-[12px] text-brand">{count}</span>
    </button>
  );
}

export function EffectBox({ lines }: { lines: ReactNode[] }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-sm bg-fill px-4 py-3.5">
      <span className="caption">記進你的帳</span>
      {lines.map((l, i) => <p key={i} className="text-body-s leading-[1.8]">{l}</p>)}
    </div>
  );
}

/** 單選的按鈕列（pills） */
export function Pills<T extends string>({ items, value, onPick, label, wrap = false }: {
  items: { id: T; label: ReactNode }[];
  value: T | null;
  onPick: (id: T) => void;
  label: string;
  wrap?: boolean;
}) {
  return (
    <div role="group" aria-label={label} className={`pills ${wrap ? 'flex-wrap' : ''}`}>
      {items.map((it) => (
        <button key={it.id} type="button" aria-pressed={value === it.id} onClick={() => onPick(it.id)} className="pill press">
          {it.label}
        </button>
      ))}
    </div>
  );
}

export function Field({ label, children, htmlFor }: { label: string; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="flex flex-col gap-2">
      {htmlFor ? <label htmlFor={htmlFor} className="caption">{label}</label> : <span className="caption">{label}</span>}
      {children}
    </div>
  );
}

const md = (iso: string) => `${Number(iso.slice(5, 7))}/${Number(iso.slice(8, 10))}`;
export const shortDate = md;

/** 群組類型的說明：旅程顯示日期與幣別 */
export function kindLabel(g: Pick<SplitGroup, 'kind' | 'startDate' | 'endDate' | 'currency'>) {
  if (g.kind === 'trip') {
    const dates = g.startDate && g.endDate ? `${md(g.startDate)}–${md(g.endDate)}・` : '';
    return `旅程・${dates}${getCurrency(g.currency).name}`;
  }
  return g.kind === 'event' ? '活動' : '日常';
}
