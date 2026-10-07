'use client';

import { Inbox } from 'lucide-react';
import type { ReactNode } from 'react';
import { getCategory } from '@/lib/categories';
import { formatMoney, money } from '@/lib/money';
import { initialOf, meOf } from '@/lib/split';
import type { Account, SplitExpense, SplitGroup, SplitMember } from '@/lib/types';

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

/** 付款用的帳戶：朋友往來由系統管理、投資帳戶只能轉入，都不能拿來付錢 */
export const payableAccounts = (accounts: Account[]) => accounts.filter((a) => a.type !== 'FRIENDS' && a.type !== 'INVESTMENT_MIRROR');
/** 收朋友還的錢：存進現金或銀行 */
export const receivingAccounts = (accounts: Account[]) => accounts.filter((a) => a.type === 'CASH' || a.type === 'BANK');

/** 這筆花費怎麼記進你的個人帳（跟資料庫 split_save_expense 的規則一致） */
export function effectLines(group: SplitGroup, e: Pick<SplitExpense, 'amount' | 'amounts' | 'payerId' | 'accountId' | 'categoryId'>, accounts: Account[]): ReactNode[] {
  const me = meOf(group);
  const mine = me ? e.amounts[me.id] ?? 0 : 0;
  const cat = getCategory(e.categoryId).name;
  const b = (n: number) => <b className="num font-normal">{formatMoney(n)}</b>;
  if (me && e.payerId === me.id) {
    const lent = e.amount - mine;
    const acct = accounts.find((a) => a.id === e.accountId)?.name ?? '付款帳戶';
    return [
      <>{acct}實付 {b(e.amount)}</>,
      mine ? <>你的支出 {b(mine)}（{cat}），報表和預算只算這個</> : '你沒有參與，不算你的支出',
      ...(lent > 0 ? [<>代墊 {b(lent)} 記在朋友往來，等朋友還你</>] : []),
    ];
  }
  const payer = group.members.find((m) => m.id === e.payerId)?.name ?? '朋友';
  if (mine) return [<>{payer}先付，你這次不用掏錢</>, <>你的支出 {b(mine)}（{cat}）</>, <>欠 {payer} {b(mine)}，記在朋友往來</>];
  return ['你沒有參與，不影響你的帳'];
}

/** 朋友說已付款、等你確認的提示；點了打開待確認 */
export function InboxBanner({ count, onOpen }: { count: number; onOpen: () => void }) {
  if (!count) return null;
  return (
    <button type="button" onClick={onOpen} aria-haspopup="dialog" className="press flex min-h-14 w-full items-center gap-3 rounded-lg bg-brand px-4 py-3 text-left text-body-s tracking-[.06em] text-ink">
      <Inbox size={20} strokeWidth={1.5} aria-hidden />
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
