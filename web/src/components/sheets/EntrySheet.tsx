'use client';

import { Delete, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { AiDraftTransaction } from '@/lib/ai-draft';
import { frequentEntries } from '@/lib/budget';
import { categoriesFor, getCategory } from '@/lib/categories';
import { useAccounts, useAddTransaction, useDeleteTransaction, useTransactions, useUpdateTransaction } from '@/lib/data';
import { toISODate, toTime } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import type { Transaction, TransactionType } from '@/lib/types';
import { useUi } from '@/lib/ui-store';
import { Sheet, SheetHeader } from '../Sheet';
import { EmptyBox } from '../ui';
import { AiEntryBar } from './AiEntryBar';

const TYPES: [TransactionType, string][] = [['EXPENSE', '支出'], ['INCOME', '收入'], ['TRANSFER', '轉帳']];
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '00', '0', 'del'] as const;

/** 記一筆（新增）與點交易列打開的編輯共用同一個表單 */
export function EntrySheet() {
  const sheet = useUi((s) => s.sheet);
  const close = useUi((s) => s.closeSheet);
  const { data: txs, isSuccess } = useTransactions();
  const editId = sheet?.kind === 'transaction' ? sheet.id : null;
  const editing = editId ? txs?.find((t) => t.id === editId) : undefined;
  const open = sheet?.kind === 'entry' || Boolean(editing);

  // 要編輯的交易已經不在了（例如在別的分頁刪掉），就關掉面板，避免背景一直保持不可操作
  useEffect(() => {
    if (editId && isSuccess && !editing) close();
  }, [editId, isSuccess, editing, close]);

  return (
    <Sheet open={open} onClose={close} labelledBy="entry-title">
      {open && <EntryForm key={editing?.id ?? 'new'} editing={editing} onClose={close} />}
    </Sheet>
  );
}

function EntryForm({ editing, onClose }: { editing?: Transaction; onClose: () => void }) {
  const { data: accounts = [], isPending } = useAccounts();
  const { data: txs = [] } = useTransactions();
  const add = useAddTransaction();
  const update = useUpdateTransaction();
  const remove = useDeleteTransaction();
  const openSheet = useUi((s) => s.openSheet);
  const showToast = useUi((s) => s.showToast);
  const flash = useUi((s) => s.flash);

  const [type, setType] = useState<TransactionType>(editing?.type ?? 'EXPENSE');
  const [amount, setAmount] = useState(editing ? String(Math.round(editing.amount)) : '');
  const [categoryId, setCategoryId] = useState(editing?.categoryId ?? 'food');
  const [source, setSource] = useState(editing?.sourceAccountId ?? '');
  const [target, setTarget] = useState(editing?.targetAccountId ?? '');
  const [note, setNote] = useState(editing?.note ?? '');
  const [date, setDate] = useState(() => editing?.date ?? toISODate(new Date()));
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  // 投資帳戶由 Monee Invest 同步，只能當轉入對象；編輯舊交易時保留它原本的帳戶
  const payable = accounts.filter((a) => a.type !== 'INVESTMENT_MIRROR' || a.id === editing?.sourceAccountId);
  const sourceId = source || payable[0]?.id || '';
  const targets = accounts.filter((a) => a.id !== sourceId);
  const value = Number(amount) || 0;
  const quick = editing ? [] : frequentEntries(txs);
  const busy = add.isPending || update.isPending || remove.isPending;
  const title = note.trim() || getCategory(type === 'TRANSFER' ? 'transfer' : categoryId).name;

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

  // AI 草稿只是先幫忙填欄位；沒提到的帳戶沿用目前選的，使用者檢查後按「記下」才寫入
  const applyDraft = (d: AiDraftTransaction) => {
    const from = d.suggestedAccountId ?? sourceId;
    setType(d.suggestedType);
    setAmount(d.suggestedAmount ? String(d.suggestedAmount) : '');
    setCategoryId(d.suggestedCategoryId);
    if (d.suggestedAccountId) setSource(d.suggestedAccountId);
    setTarget(d.suggestedTargetAccountId && d.suggestedTargetAccountId !== from ? d.suggestedTargetAccountId : '');
    setNote(d.suggestedNote);
    setDate(d.suggestedDate);
    setError('');
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
    const payload = {
      date,
      time: editing ? editing.time : date === toISODate(now) ? toTime(now) : null,
      type,
      amount: value,
      categoryId: type === 'TRANSFER' ? 'transfer' : categoryId,
      sourceAccountId: sourceId,
      targetAccountId: type === 'TRANSFER' ? target : null,
      note: note.trim() || null,
    };
    try {
      const id = editing ? await update.mutateAsync({ id: editing.id, ...payload }) : await add.mutateAsync(payload);
      flash(id);
      onClose();
      showToast(`${editing ? '已更新' : '已記下'}：${title} ${formatMoney(value)}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : '儲存失敗，請再試一次');
    }
  };

  const destroy = async () => {
    if (!editing) return;
    try {
      await remove.mutateAsync(editing.id);
      onClose();
      showToast(`已刪除：${editing.note || getCategory(editing.categoryId).name} ${formatMoney(editing.amount)}`);
    } catch (e) {
      setConfirmDelete(false);
      setError(e instanceof Error ? e.message : '刪除失敗，請再試一次');
    }
  };

  const header = editing
    ? <SheetHeader id="entry-title" title="編輯交易" en="Edit" onClose={onClose} />
    : <SheetHeader id="entry-title" title="記一筆" en="New entry" onClose={onClose} />;

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
      {!editing && <AiEntryBar accounts={accounts} onDraft={applyDraft} />}

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

      <button type="button" onClick={save} disabled={!value || busy} className="btn-primary press w-full">
        {add.isPending || update.isPending ? '儲存中…' : editing ? '儲存變更' : `記下${value ? ` ${formatMoney(value)}` : ''}`}
      </button>

      {editing && (confirmDelete ? (
        <div role="alertdialog" aria-labelledby="delete-question" className="flex flex-col gap-3 rounded-sm bg-alert-tint p-4">
          <p id="delete-question" className="text-body-s text-alert">確定要刪除「{title}」嗎？刪除後無法復原。</p>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setConfirmDelete(false)} className="btn-secondary press" autoFocus>取消</button>
            <button type="button" onClick={destroy} disabled={busy} className="btn-secondary press border-alert text-alert">
              {remove.isPending ? '刪除中…' : '刪除'}
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setConfirmDelete(true)} disabled={busy} className="btn-secondary press w-full text-alert">
          <Trash2 size={16} strokeWidth={1.5} aria-hidden />刪除這筆交易
        </button>
      ))}
    </>
  );
}
