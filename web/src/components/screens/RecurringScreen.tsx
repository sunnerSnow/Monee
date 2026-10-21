'use client';

import { ChevronLeft, Pause, Play, Plus, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { categoriesFor, defaultCategory, getCategory, useCategories } from '@/lib/categories';
import { useAccounts, useDeleteRecurring, useRecurringRules, useSaveRecurring } from '@/lib/data';
import { toISODate } from '@/lib/dates';
import { parseAmount } from '@/lib/money';
import { describe, onOrAfter, shortDue, type Frequency, type RecurringRule } from '@/lib/recurring';
import type { TransactionType } from '@/lib/types';
import { useUi } from '@/lib/ui-store';
import { ruleMoney, ruleTitle } from '../Recurring';
import { Sheet, SheetHeader } from '../Sheet';
import { Field, Pills } from '../split/parts';
import { EmptyBox, useHidden } from '../ui';

const TYPES: { id: TransactionType; label: string }[] = [{ id: 'EXPENSE', label: '支出' }, { id: 'INCOME', label: '收入' }, { id: 'TRANSFER', label: '轉帳' }];
const FREQS: { id: Frequency; label: string }[] = [{ id: 'monthly', label: '每月' }, { id: 'weekly', label: '每週' }, { id: 'yearly', label: '每年' }];
const MODES: { id: 'ask' | 'auto'; label: string }[] = [{ id: 'ask', label: '到時候問我' }, { id: 'auto', label: '自動記下' }];
const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

/** 我的 → 固定收支：全部的固定收支，點一下可以改金額、週期、暫停或刪除 */
export function RecurringScreen() {
  useCategories(); // 分類改名、換顏色時重畫
  const router = useRouter();
  const hidden = useHidden();
  const { data: rules = [], isPending } = useRecurringRules();
  const [editing, setEditing] = useState<{ rule?: RecurringRule } | null>(null);
  const sorted = [...rules].sort((a, b) => Number(a.paused) - Number(b.paused) || a.nextDate.localeCompare(b.nextDate));
  const back = () => (window.history.length > 1 ? router.back() : router.push('/settings'));

  return (
    <>
      <header className="flex min-h-12 items-center gap-1">
        <button type="button" onClick={back} aria-label="返回" className="icon-btn ghost press">
          <ChevronLeft size={20} strokeWidth={1.5} aria-hidden />
        </button>
        <h1 className="h-page">固定收支<span className="en">Recurring</span></h1>
      </header>
      <p className="caption -mt-2 px-1 leading-[1.8]">房租、訂閱、薪水這種每期一樣的帳。到了日子，選「自動記下」的打開 App 就記好；選「到時候問我」的會出現在首頁，金額可以改了再記。</p>

      {isPending ? <div aria-busy="true" className="skeleton h-40" /> : sorted.length ? (
        <ul className="card py-1">
          {sorted.map((r) => {
            const cat = getCategory(r.type === 'TRANSFER' ? 'transfer' : r.categoryId);
            const Icon = cat.icon;
            return (
              <li key={r.id} className="border-t border-line first:border-t-0">
                <button type="button" onClick={() => setEditing({ rule: r })} aria-haspopup="dialog" className={`row press ${r.paused ? 'text-muted' : ''}`}>
                  <span aria-hidden className={`ico ${r.type === 'TRANSFER' ? 'tr' : ''}`} style={r.type === 'TRANSFER' ? undefined : { background: cat.color }}><Icon size={20} strokeWidth={1.5} /></span>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-body">{ruleTitle(r)}</span>
                    <span className="text-caption tracking-[.06em] text-muted">
                      {r.paused ? '暫停中' : <><span className="inline-block">{describe(r)}・</span><span className="inline-block">下次 {shortDue(r.nextDate)}</span></>}
                    </span>
                  </span>
                  <span className="flex flex-none flex-col items-end gap-1">
                    <span className="num text-body">{ruleMoney(r, r.amount, hidden)}</span>
                    <span className="caption">{r.auto ? '自動記下' : '到時候問你'}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyBox title="還沒有固定收支">記一筆時打開「設成固定收支」，或按下面新增。</EmptyBox>
      )}

      <button type="button" onClick={() => setEditing({})} aria-haspopup="dialog" className="press flex min-h-[52px] items-center justify-center gap-2 rounded-lg border-[2.5px] border-dashed border-dash text-body-s tracking-[.08em]">
        <Plus size={18} strokeWidth={1.5} aria-hidden />新增固定收支
      </button>

      <Sheet open={editing !== null} onClose={() => setEditing(null)} labelledBy="recurring-title">
        {editing && <RecurringForm key={editing.rule?.id ?? 'new'} rule={editing.rule} onClose={() => setEditing(null)} />}
      </Sheet>
    </>
  );
}

function RecurringForm({ rule, onClose }: { rule?: RecurringRule; onClose: () => void }) {
  const { data: accounts = [] } = useAccounts();
  const save = useSaveRecurring();
  const remove = useDeleteRecurring();
  const showToast = useUi((s) => s.showToast);
  const today = toISODate(new Date());
  const [ty, tm, td] = today.split('-').map(Number);
  const weekday = new Date(ty, tm - 1, td).getDay();

  const [type, setType] = useState<TransactionType>(rule?.type ?? 'EXPENSE');
  const [amount, setAmount] = useState(rule ? String(rule.amount) : '');
  const [note, setNote] = useState(rule?.note ?? '');
  const [categoryId, setCategoryId] = useState(rule && rule.type !== 'TRANSFER' ? rule.categoryId : defaultCategory('EXPENSE'));
  const usable = accounts.filter((a) => a.type !== 'FRIENDS');
  const payable = usable.filter((a) => a.type !== 'INVESTMENT_MIRROR' || a.id === rule?.sourceAccountId);
  const [source, setSource] = useState(rule?.sourceAccountId ?? '');
  const [target, setTarget] = useState(rule?.targetAccountId ?? '');
  const [frequency, setFrequency] = useState<Frequency>(rule?.frequency ?? 'monthly');
  const [day, setDay] = useState(rule?.day ?? td);
  const [month, setMonth] = useState(rule?.month ?? tm);
  const [auto, setAuto] = useState(rule?.auto ?? false);
  const [paused, setPaused] = useState(rule?.paused ?? false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState('');

  const sourceId = source || payable[0]?.id || '';
  const schedule = { frequency, day, month: frequency === 'yearly' ? month : null };
  const sameSchedule = rule && rule.frequency === frequency && rule.day === day && (frequency !== 'yearly' || rule.month === month);
  // 週期沒改就照原本的下次日期；改了就從今天算起。暫停後恢復，暫停期間過掉的不補記
  const skipPaused = rule?.paused && !paused && rule.nextDate < today;
  const nextDate = sameSchedule && !skipPaused ? rule.nextDate : onOrAfter(schedule, today);
  const busy = save.isPending || remove.isPending;

  const switchType = (t: TransactionType) => {
    setType(t);
    if (t !== 'TRANSFER') setCategoryId(defaultCategory(t));
    setError('');
  };
  const switchFrequency = (f: Frequency) => {
    setFrequency(f);
    setDay(f === 'weekly' ? weekday : td);
    setMonth(tm);
  };

  const submit = async () => {
    const value = parseAmount(amount);
    if (!value) return setError('請輸入金額');
    if (!sourceId) return setError('請先新增帳戶');
    if (type === 'TRANSFER' && !target) return setError('請選擇轉入帳戶');
    try {
      await save.mutateAsync({
        id: rule?.id, type, amount: value, categoryId: type === 'TRANSFER' ? 'transfer' : categoryId, sourceAccountId: sourceId,
        targetAccountId: type === 'TRANSFER' ? target : null, note: note.trim() || null, ...schedule, auto, nextDate, paused,
      });
      onClose();
      showToast(rule ? '已儲存固定收支' : `已新增固定收支，下次 ${shortDue(nextDate)}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : '儲存失敗，請再試一次');
    }
  };

  const destroy = async () => {
    if (!rule) return;
    try {
      await remove.mutateAsync(rule.id);
      onClose();
      showToast(`已刪除固定收支：${ruleTitle(rule)}，已經記的帳都還在`);
    } catch (e) {
      setConfirmDelete(false);
      setError(e instanceof Error ? e.message : '刪除失敗，請再試一次');
    }
  };

  const select = 'field-input appearance-none bg-surface px-4';

  return (
    <>
      <SheetHeader id="recurring-title" title={rule ? '編輯固定收支' : '新增固定收支'} en="Recurring" onClose={onClose} />

      <Pills items={TYPES} value={type} onPick={switchType} label="類型" />

      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-2">
        <Field label="金額" htmlFor="recurring-amount">
          <div className="field-input flex items-center gap-1 px-3.5">
            <span aria-hidden className="num text-muted">$</span>
            <input id="recurring-amount" data-autofocus inputMode="numeric" value={amount} onChange={(e) => { setAmount(e.target.value.replace(/\D/g, '').slice(0, 8)); setError(''); }} placeholder="0" autoComplete="off" className="num min-w-0 flex-1 bg-transparent text-[16px] outline-none" />
          </div>
        </Field>
        <Field label="品項" htmlFor="recurring-note">
          <input id="recurring-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={100} placeholder="例如：房租" autoComplete="off" className="field-input" />
        </Field>
      </div>

      {type !== 'TRANSFER' && (
        <Field label="分類">
          <Pills items={categoriesFor(type, categoryId).map((c) => ({ id: c.id, label: c.name }))} value={categoryId} onPick={setCategoryId} label="分類" wrap />
        </Field>
      )}

      <Field label={type === 'TRANSFER' ? '轉出帳戶' : type === 'INCOME' ? '存入帳戶' : '付款帳戶'}>
        <Pills items={payable.map((a) => ({ id: a.id, label: a.name }))} value={sourceId} onPick={(id) => { setSource(id); if (id === target) setTarget(''); }} label="帳戶" wrap />
      </Field>
      {type === 'TRANSFER' && (
        <Field label="轉入帳戶">
          <Pills items={usable.filter((a) => a.id !== sourceId).map((a) => ({ id: a.id, label: a.name }))} value={target} onPick={setTarget} label="轉入帳戶" wrap />
        </Field>
      )}

      <Field label="多久一次">
        <Pills items={FREQS} value={frequency} onPick={switchFrequency} label="週期" />
        {frequency === 'weekly' ? (
          <Pills items={WEEKDAYS.map((w, i) => ({ id: String(i), label: `週${w}` }))} value={String(day)} onPick={(v) => setDay(Number(v))} label="星期幾" wrap />
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {frequency === 'yearly' && (
              <select aria-label="幾月" value={month} onChange={(e) => setMonth(Number(e.target.value))} className={select}>
                {Array.from({ length: 12 }, (_, i) => <option key={i} value={i + 1}>{i + 1} 月</option>)}
              </select>
            )}
            <select aria-label="幾號" value={day} onChange={(e) => setDay(Number(e.target.value))} className={select}>
              {Array.from({ length: 31 }, (_, i) => <option key={i} value={i + 1}>{i + 1} 號</option>)}
            </select>
          </div>
        )}
        <p className="caption px-1 leading-[1.8]">{describe(schedule)}・下次 {shortDue(nextDate)}</p>
      </Field>

      <Field label="到了日子">
        <Pills items={MODES} value={auto ? 'auto' : 'ask'} onPick={(v) => setAuto(v === 'auto')} label="到了日子怎麼記" />
        <p className="caption px-1 leading-[1.8]">{auto ? '打開 App 就幫你記好，首頁會提示記了什麼。適合金額固定的，例如房租、訂閱。' : '出現在首頁，金額可以改了再記，也可以略過。適合每期不一樣的，例如電費。'}</p>
      </Field>

      {error && <p role="alert" className="-my-2 text-caption text-alert">{error}</p>}
      <button type="button" onClick={submit} disabled={busy} className="btn-primary press w-full">{save.isPending ? '儲存中…' : rule ? '儲存' : '新增'}</button>

      {rule && (
        <section aria-labelledby="recurring-manage" className="flex flex-col gap-2 border-t border-line pt-4">
          <h3 id="recurring-manage" className="caption">管理</h3>
          <button type="button" onClick={() => setPaused(!paused)} aria-pressed={paused} className="btn-secondary press w-full">
            {paused ? <><Play size={16} strokeWidth={1.5} aria-hidden />恢復（按儲存後生效）</> : <><Pause size={16} strokeWidth={1.5} aria-hidden />暫停（按儲存後生效）</>}
          </button>
          {confirmDelete ? (
            <div role="alertdialog" aria-labelledby="recurring-del-q" className="flex flex-col gap-3 rounded-sm bg-alert-tint p-4">
              <p id="recurring-del-q" className="text-body-s leading-[1.8] text-alert">確定刪除「{ruleTitle(rule)}」？之後不會再記，已經記的帳都還在。</p>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setConfirmDelete(false)} className="btn-secondary press" autoFocus>取消</button>
                <button type="button" onClick={destroy} disabled={busy} className="btn-secondary press border-alert text-alert">{remove.isPending ? '刪除中…' : '刪除'}</button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setConfirmDelete(true)} disabled={busy} className="btn-secondary press w-full text-alert">
              <Trash2 size={16} strokeWidth={1.5} aria-hidden />刪除這筆固定收支
            </button>
          )}
        </section>
      )}
    </>
  );
}
