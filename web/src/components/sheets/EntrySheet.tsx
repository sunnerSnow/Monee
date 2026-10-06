'use client';

import { Delete, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { frequentEntries } from '@/lib/budget';
import { categoriesFor, getCategory } from '@/lib/categories';
import { useAccounts, useAddTransaction, useTransactions } from '@/lib/data';
import { toISODate, toTime } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import type { Transaction, TransactionType } from '@/lib/types';
import { useUi } from '@/lib/ui-store';
import { Sheet, SheetHeader } from '../Sheet';
import { EmptyBox } from '../ui';

const TYPES: [TransactionType, string][] = [['EXPENSE', '支出'], ['INCOME', '收入'], ['TRANSFER', '轉帳']];
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '00', '0', 'del'] as const;

export function EntrySheet() {
  const open = useUi((s) => s.sheet?.kind === 'entry');
  const close = useUi((s) => s.closeSheet);
  return (
    <Sheet open={open} onClose={close} labelledBy="entry-title">
      {open && <EntryForm onClose={close} />}
    </Sheet>
  );
}

function EntryForm({ onClose }: { onClose: () => void }) {
  const { data: accounts = [], isPending } = useAccounts();
  const { data: txs = [] } = useTransactions();
  const add = useAddTransaction();
  const openSheet = useUi((s) => s.openSheet);
  const showToast = useUi((s) => s.showToast);
  const flash = useUi((s) => s.flash);

  const [type, setType] = useState<TransactionType>('EXPENSE');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('food');
  const [source, setSource] = useState('');
  const [target, setTarget] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(() => toISODate(new Date()));
  const [error, setError] = useState('');

  // 投資帳戶由 Monee Invest 同步，只能當轉入對象
  const payable = accounts.filter((a) => a.type !== 'INVESTMENT_MIRROR');
  const sourceId = source || payable[0]?.id || '';
  const targets = accounts.filter((a) => a.id !== sourceId);
  const value = Number(amount) || 0;
  const quick = frequentEntries(txs);

  const switchType = (next: TransactionType) => {
    setType(next);
    setCategoryId(categoriesFor(next)[0].id);
    setError('');
  };

  const press = (key: (typeof KEYS)[number]) => {
    setError('');
    if (key === 'del') return setAmount((a) => a.slice(0, -1));
    setAmount((a) => (a.length >= 8 || (a === '' && key.startsWith('0')) ? a : a + key));
  };

  const applyQuick = (t: Transaction) => {
    setType('EXPENSE');
    setAmount(String(t.amount));
    setCategoryId(t.categoryId);
    setSource(t.sourceAccountId);
    setNote(t.note ?? '');
    setError('');
  };

  const save = async () => {
    if (!value) return setError('請輸入金額');
    if (!sourceId) return setError('請先新增帳戶');
    if (type === 'TRANSFER' && !target) return setError('請選擇轉入帳戶');
    const now = new Date();
    const title = note.trim() || getCategory(type === 'TRANSFER' ? 'transfer' : categoryId).name;
    try {
      const id = await add.mutateAsync({
        date,
        time: date === toISODate(now) ? toTime(now) : null,
        type,
        amount: value,
        categoryId: type === 'TRANSFER' ? 'transfer' : categoryId,
        sourceAccountId: sourceId,
        targetAccountId: type === 'TRANSFER' ? target : null,
        note: note.trim() || null,
      });
      flash(id);
      onClose();
      showToast(`已記下：${title} ${formatMoney(value)}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : '儲存失敗，請再試一次');
    }
  };

  const header = <SheetHeader id="entry-title" title="記一筆" en="New entry" onClose={onClose} />;

  if (!isPending && payable.length === 0) {
    return (
      <>
        {header}
        <EmptyBox title="先新增一個帳戶">記帳時要選錢從哪裡出去，例如現金、銀行或信用卡。</EmptyBox>
        <button type="button" data-autofocus onClick={() => openSheet({ kind: 'account' })} className="btn-primary press w-full">
          新增帳戶
        </button>
      </>
    );
  }

  const chips = (items: { id: string; label: string }[], current: string, onPick: (id: string) => void, label: string) => (
    <div role="group" aria-label={label} className="pills">
      {items.map((it) => (
        <button key={it.id} type="button" aria-pressed={current === it.id} onClick={() => onPick(it.id)} className="pill press">
          {it.label}
        </button>
      ))}
    </div>
  );

  return (
    <>
      {header}
      <p className="caption -mt-2.5 flex items-center gap-1.5">
        <Sparkles size={14} strokeWidth={1.5} aria-hidden />語音與拍收據記帳即將推出
      </p>

      {chips(TYPES.map(([id, label]) => ({ id, label })), type, (id) => switchType(id as TransactionType), '類型')}

      <p aria-live="polite" className={`display m-0 flex min-h-[60px] items-baseline justify-center gap-1.5 text-[44px] ${value ? '' : 'text-muted'}`}>
        <small className="!m-0 !align-baseline text-[20px]">$</small>{value ? value.toLocaleString('en-US') : '0'}
      </p>

      {type === 'EXPENSE' && quick.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="caption">最近常用</span>
          <div className="pills">
            {quick.map((t) => (
              <button key={t.id} type="button" onClick={() => applyQuick(t)} className="pill press">
                {t.note} <span className="num">{formatMoney(t.amount)}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {type !== 'TRANSFER' && (
        <div className="flex flex-col gap-2">
          <span className="caption">分類</span>
          {chips(categoriesFor(type).map((c) => ({ id: c.id, label: c.name })), categoryId, setCategoryId, '分類')}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <span className="caption">{type === 'TRANSFER' ? '轉出帳戶' : type === 'INCOME' ? '存入帳戶' : '付款帳戶'}</span>
        {chips(payable.map((a) => ({ id: a.id, label: a.name })), sourceId, (id) => { setSource(id); if (id === target) setTarget(''); }, '帳戶')}
      </div>

      {type === 'TRANSFER' && (
        <div className="flex flex-col gap-2">
          <span className="caption">轉入帳戶（轉帳不算進支出）</span>
          {targets.length
            ? chips(targets.map((a) => ({ id: a.id, label: a.name })), target, setTarget, '轉入帳戶')
            : <p className="text-body-s text-muted">需要至少兩個帳戶才能轉帳。</p>}
        </div>
      )}

      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
        <label className="sr-only" htmlFor="entry-note">品項或備註</label>
        <input id="entry-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={100} placeholder="品項或備註（選填）" autoComplete="off" className="field-input" />
        <label className="sr-only" htmlFor="entry-date">日期</label>
        <input id="entry-date" type="date" value={date} max={toISODate(new Date())} onChange={(e) => setDate(e.target.value || toISODate(new Date()))} className="field-input w-[150px] px-3" />
      </div>

      <div role="group" aria-label="數字鍵盤" className="grid grid-cols-3 gap-2">
        {KEYS.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => press(k)}
            aria-label={k === 'del' ? '刪除一位' : undefined}
            className="press num flex h-[52px] items-center justify-center rounded-sm border border-line bg-surface text-[20px] font-light"
          >
            {k === 'del' ? <Delete size={22} strokeWidth={1.5} aria-hidden /> : k}
          </button>
        ))}
      </div>

      {error && <p role="alert" className="-my-2 text-caption text-alert">{error}</p>}

      <button type="button" onClick={save} disabled={!value || add.isPending} className="btn-primary press w-full">
        {add.isPending ? '儲存中…' : `記下${value ? ` ${formatMoney(value)}` : ''}`}
      </button>
    </>
  );
}
