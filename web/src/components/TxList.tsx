'use client';

import { groupByDay } from '@/lib/budget';
import { getCategory } from '@/lib/categories';
import { dayLabel } from '@/lib/dates';
import { money, transactionAmount } from '@/lib/money';
import type { Account, Transaction } from '@/lib/types';
import { useUi } from '@/lib/ui-store';

export function TxRow({ t, accounts }: { t: Transaction; accounts: Map<string, Account> }) {
  const hidden = useUi((s) => s.hidden);
  const flashId = useUi((s) => s.flashId);
  const openSheet = useUi((s) => s.openSheet);
  const category = getCategory(t.categoryId);
  const Icon = category.icon;
  const from = accounts.get(t.sourceAccountId)?.name ?? '已刪除的帳戶';
  const to = t.targetAccountId ? accounts.get(t.targetAccountId)?.name ?? '已刪除的帳戶' : '';
  const title = t.note || category.name;
  // 最重要的資訊放副標題最前面，太長時被省略的是後面
  const sub = t.type === 'TRANSFER'
    ? `不算支出 · ${from} → ${to}`
    : [category.name, from, t.time].filter(Boolean).join(' · ');
  const tone = t.type === 'INCOME' ? 'in' : t.type === 'TRANSFER' ? 'tr' : '';

  return (
    <li>
      <button
        type="button"
        onClick={() => openSheet({ kind: 'transaction', id: t.id })}
        aria-haspopup="dialog"
        className={`row press ${t.id === flashId ? 'flash' : ''}`}
      >
        <span aria-hidden className={`ico ${tone}`}><Icon size={20} strokeWidth={1.5} /></span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate text-body">{title}</span>
          <span className="truncate text-caption tracking-[.06em] text-muted">{sub}</span>
        </span>
        <span className={`num flex-none text-body ${t.type === 'TRANSFER' ? 'text-muted' : ''}`}>{transactionAmount(t, hidden)}</span>
      </button>
    </li>
  );
}

/** 依日期分組的交易列表；variant="cards" 每天一張卡片（明細頁），"inline" 全部放一張卡片（首頁） */
export function TxGroups({ txs, accounts, today, variant }: {
  txs: Transaction[];
  accounts: Account[];
  today: Date;
  variant: 'cards' | 'inline';
}) {
  const hidden = useUi((s) => s.hidden);
  const byId = new Map(accounts.map((a) => [a.id, a]));
  const groups = groupByDay(txs);

  if (variant === 'inline') {
    return (
      <div className="card py-1">
        {groups.map((g) => (
          <div key={g.date}>
            <div className="flex justify-between gap-2 px-5 pt-3.5 pb-1 text-caption tracking-[.08em] text-muted">
              <span>{dayLabel(g.date, today)}</span>
              <span className="num">{g.spent ? money(g.spent, hidden) : ''}</span>
            </div>
            <ul>{g.items.map((t) => <TxRow key={t.id} t={t} accounts={byId} />)}</ul>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {groups.map((g) => (
        <section key={g.date} aria-label={dayLabel(g.date, today)} className="flex flex-col gap-1.5">
          <div className="sticky top-0 z-[2] flex justify-between gap-2 bg-page px-1 pt-2.5 pb-1.5 text-caption tracking-[.08em] text-muted">
            <span>{dayLabel(g.date, today)}</span>
            <span className="num">{g.spent ? `支出 ${money(g.spent, hidden)}` : ''}</span>
          </div>
          <ul className="card py-1">{g.items.map((t) => <TxRow key={t.id} t={t} accounts={byId} />)}</ul>
        </section>
      ))}
    </div>
  );
}
