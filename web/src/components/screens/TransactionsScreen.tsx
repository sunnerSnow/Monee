'use client';

import { Search } from 'lucide-react';
import { useState } from 'react';
import { getCategory } from '@/lib/categories';
import { HISTORY_MONTHS, useAccounts, useTransactions } from '@/lib/data';
import { monthKey, monthKeyOf, shiftMonth } from '@/lib/dates';
import { money } from '@/lib/money';
import type { TransactionType } from '@/lib/types';
import { useNow } from '@/lib/use-now';
import { TxGroups } from '../TxList';
import { EmptyBox, ErrorBox, LoadingBlocks, MonthSwitch, PageHeader, useHidden } from '../ui';

type Filter = 'ALL' | TransactionType;
const FILTERS: [Filter, string][] = [['ALL', '全部'], ['EXPENSE', '支出'], ['INCOME', '收入'], ['TRANSFER', '轉帳']];

export function TransactionsScreen() {
  const now = useNow();
  const accountsQ = useAccounts();
  const txQ = useTransactions();
  const hidden = useHidden();
  const [offset, setOffset] = useState(0);
  const [filter, setFilter] = useState<Filter>('ALL');
  const [query, setQuery] = useState('');

  const header = <PageHeader title="明細" en="Transactions" />;
  if (!now || accountsQ.isPending || txQ.isPending) return <>{header}<LoadingBlocks /></>;
  const error = accountsQ.error ?? txQ.error;
  if (error) return <>{header}<ErrorBox message={error.message} onRetry={() => { accountsQ.refetch(); txQ.refetch(); }} /></>;

  const accounts = accountsQ.data ?? [];
  const names = new Map(accounts.map((a) => [a.id, a.name]));
  const month = shiftMonth(monthKeyOf(now), offset);
  const q = query.trim();
  const list = (txQ.data ?? []).filter((t) => {
    if (monthKey(t.date) !== month) return false;
    if (filter !== 'ALL' && t.type !== filter) return false;
    if (!q) return true;
    const haystack = [t.note, getCategory(t.categoryId).name, names.get(t.sourceAccountId), t.targetAccountId && names.get(t.targetAccountId)].join(' ');
    return haystack.includes(q);
  });
  const expense = list.filter((t) => t.type === 'EXPENSE').reduce((s, t) => s + t.amount, 0);
  const income = list.filter((t) => t.type === 'INCOME').reduce((s, t) => s + t.amount, 0);
  const oldest = offset <= -(HISTORY_MONTHS - 1);

  return (
    <>
      {header}
      <MonthSwitch month={month} onPrev={() => setOffset((o) => o - 1)} onNext={() => setOffset((o) => o + 1)} canPrev={!oldest} canNext={offset < 0} />
      <div className="relative">
        <label htmlFor="tx-search" className="sr-only">搜尋交易</label>
        <Search size={18} strokeWidth={1.5} aria-hidden className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-muted" />
        <input id="tx-search" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜尋品項、分類或帳戶" autoComplete="off" className="field-input pl-11" />
      </div>
      <div role="group" aria-label="交易類型" className="pills">
        {FILTERS.map(([id, label]) => (
          <button key={id} type="button" aria-pressed={filter === id} onClick={() => setFilter(id)} className="pill press">{label}</button>
        ))}
      </div>

      {list.length === 0 ? (
        <EmptyBox title={q ? `找不到「${q}」` : '這個月還沒有交易'}>
          {q || filter !== 'ALL' ? '換個關鍵字，或切回「全部」看看。' : '點下方 ＋ 記下一筆，這裡就會依日期列出來。'}
        </EmptyBox>
      ) : (
        <>
          <p aria-live="polite" className="mx-1 flex gap-4 text-caption tracking-[.06em] text-muted">
            <span>{list.length} 筆</span>
            <span>支出 <span className="num">{money(expense, hidden)}</span></span>
            <span>收入 <span className="num">{money(income, hidden)}</span></span>
          </p>
          <TxGroups txs={list} accounts={accounts} today={now} variant="cards" />
        </>
      )}
      {oldest && <p className="caption text-center">目前只顯示最近 {HISTORY_MONTHS} 個月的紀錄</p>}
    </>
  );
}
