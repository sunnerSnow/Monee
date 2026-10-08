'use client';

import { Check, ChevronLeft } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { categoriesFor } from '@/lib/categories';
import { cleanAmountInput, formatForeign, getCurrency, toMinor, toTwd, twdPerUnit } from '@/lib/currency';
import { useFxRates, usePublicAddExpense } from '@/lib/data';
import { toISODate } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { allocate, initialOf, involves, splitProblem } from '@/lib/split';
import type { SplitGroup, SplitMember } from '@/lib/types';
import { Field, Pills } from './parts';

const num = (s: string) => parseFloat(s || '0') || 0;

/**
 * 朋友在分享頁新增一筆：誰先付、跟誰平分（跟原型一樣只有平分，表單簡單）。
 * 跟分享的人有關的（他先付，或有分到他）送出後等他確認；朋友之間的直接記進群組。
 */
export function FriendExpenseForm({ g, token, me, ownerName, onDone, onCancel }: {
  g: SplitGroup;
  token: string;
  /** 正在用分享頁的這位朋友 */
  me: SplitMember;
  ownerName: string;
  onDone: (message: string) => void;
  onCancel: () => void;
}) {
  const fx = useFxRates();
  const add = usePublicAddExpense(token);
  const owner = g.members.find((m) => m.isMe)!;
  const ids = g.members.map((m) => m.id);
  const nameOf = (m: SplitMember) => (m.isMe ? ownerName : m.id === me.id ? '你' : m.name);
  const heading = useRef<HTMLHeadingElement>(null);

  const [currency, setCurrency] = useState(g.currency || 'TWD');
  const [rateInput, setRateInput] = useState('');
  const [amount, setAmount] = useState('');
  const [title, setTitle] = useState('');
  const [categoryId, setCategoryId] = useState('food');
  const [date, setDate] = useState(toISODate(new Date()));
  const [payerId, setPayerId] = useState(me.id);
  const [who, setWho] = useState<Set<string>>(() => new Set(ids));
  const [error, setError] = useState('');

  // 打開表單時把焦點移到標題，報讀器知道畫面換了
  useEffect(() => { heading.current?.focus(); }, []);

  const currencyChoices = [...new Set([g.currency || 'TWD', 'TWD'])];
  const cur = getCurrency(currency);
  const dec = cur.decimals;
  const foreign = currency !== 'TWD';
  const autoRate = twdPerUnit(fx.data, currency);
  const rate = foreign ? num(rateInput) || autoRate || 0 : 1;
  const totalOriginal = num(amount);
  const total = foreign ? toTwd(totalOriginal, rate) : Math.round(totalOriginal);
  // 照成員順序組 weights，平分的零頭才會固定給前面的人
  const weights: Record<string, number> = Object.fromEntries(ids.filter((k) => who.has(k)).map((k) => [k, 1]));
  const amounts = allocate(total, weights);
  const originals = allocate(toMinor(totalOriginal, dec), weights);
  const problem = (foreign && totalOriginal > 0 && !rate ? '請輸入匯率' : '') || splitProblem('equal', total, weights);
  const pending = involves({ payerId, amounts }, owner.id);
  const shareText = (k: string) => (foreign ? formatForeign((originals[k] ?? 0) / 10 ** dec, currency) : formatMoney(amounts[k] ?? 0));

  const toggle = (k: string) => setWho((prev) => {
    const next = new Set(prev);
    if (next.has(k)) next.delete(k);
    else next.add(k);
    return next;
  });
  const switchCurrency = (c: string) => {
    if (c === currency) return;
    setCurrency(c);
    setAmount(cleanAmountInput(amount, getCurrency(c).decimals));
    setRateInput('');
  };

  const submit = async () => {
    if (problem) return setError(problem);
    const finalTitle = title.trim() || categoriesFor('EXPENSE').find((c) => c.id === categoryId)?.name || '花費';
    try {
      const res = await add.mutateAsync({
        memberId: me.id, date, title: finalTitle, categoryId, amount: total, payerId, weights, amounts,
        currency, originalAmount: foreign ? totalOriginal : null, fxRate: foreign ? rate : null,
        originalShares: foreign ? Object.fromEntries(Object.entries(originals).map(([k, v]) => [k, v / 10 ** dec])) : null,
      });
      onDone(res.pending ? `已送出「${finalTitle}」，${ownerName} 確認後會算進結算` : `已記下「${finalTitle}」`);
    } catch (e) {
      setError(e instanceof Error ? e.message : '送出失敗，請再試一次');
    }
  };

  return (
    <>
      <header className="flex min-h-12 items-center gap-1">
        <button type="button" onClick={onCancel} aria-label="返回" className="icon-btn ghost press"><ChevronLeft size={20} strokeWidth={1.5} aria-hidden /></button>
        <h1 ref={heading} tabIndex={-1} className="h-page min-w-0 flex-1 truncate outline-none">新增一筆<span className="en">New</span></h1>
      </header>
      <p className="caption -mt-2 leading-[1.8]">記在「{g.name}」。跟 {ownerName} 有關的花費，{ownerName} 確認後才會算進結算。</p>

      {currencyChoices.length > 1 && (
        <Field label="幣別">
          <Pills items={currencyChoices.map((c) => ({ id: c, label: `${getCurrency(c).name} ${c}` }))} value={currency} onPick={switchCurrency} label="幣別" />
        </Field>
      )}

      <Field label="金額" htmlFor="friend-amount">
        <div className="flex items-baseline gap-1.5 border-b border-fg px-0.5 pb-2 focus-within:border-b-2 focus-within:pb-[7px]">
          <span className="display text-[22px]">{cur.symbol.trim()}</span>
          <input
            id="friend-amount"
            inputMode={dec ? 'decimal' : 'numeric'}
            value={amount}
            onChange={(e) => { setAmount(cleanAmountInput(e.target.value, dec)); setError(''); }}
            placeholder="0"
            autoComplete="off"
            className="display min-w-0 flex-1 bg-transparent text-[36px] outline-none"
          />
        </div>
        {foreign && (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-0.5 text-caption text-muted">
            <span className="num text-body-s text-fg">≈ {formatMoney(total)}</span>
            <label htmlFor="friend-rate" className="ml-auto">匯率 1 {currency} =</label>
            <input
              id="friend-rate"
              inputMode="decimal"
              value={rateInput || (autoRate ? String(autoRate) : '')}
              onChange={(e) => setRateInput(e.target.value.replace(/[^\d.]/g, '').slice(0, 12))}
              placeholder={fx.isPending ? '載入中' : '輸入匯率'}
              autoComplete="off"
              className="num h-9 w-24 rounded-xs border border-line bg-page px-2 text-right text-[14px] text-fg"
            />
            <span>元</span>
            <span className="w-full leading-[1.7]">
              {rateInput ? '用你輸入的匯率' : autoRate ? '參考今天的匯率，可以改成刷卡的實際匯率' : fx.isError ? '匯率暫時拿不到，請自己輸入' : ''}
            </span>
          </div>
        )}
      </Field>

      <Field label="品項與日期" htmlFor="friend-title">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
          <input id="friend-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={40} placeholder="例如：計程車" autoComplete="off" className="field-input" />
          <label className="sr-only" htmlFor="friend-date">日期</label>
          <input id="friend-date" type="date" value={date} max={toISODate(new Date())} onChange={(e) => setDate(e.target.value || toISODate(new Date()))} className="field-input w-[150px] px-3" />
        </div>
        <Pills items={categoriesFor('EXPENSE').map((c) => ({ id: c.id, label: c.name }))} value={categoryId} onPick={setCategoryId} label="分類" wrap />
      </Field>

      <Field label="誰先付的">
        <Pills items={g.members.map((m) => ({ id: m.id, label: nameOf(m) }))} value={payerId} onPick={setPayerId} label="誰先付的" wrap />
      </Field>

      <Field label="跟誰平分">
        <ul className="card py-1">
          {g.members.map((m) => {
            const on = who.has(m.id);
            const name = nameOf(m);
            return (
              <li key={m.id} className={`flex min-h-14 items-center border-t border-line pr-4 first:border-t-0 ${on ? '' : 'text-muted'}`}>
                <button
                  type="button"
                  aria-pressed={on}
                  aria-label={`${name}${on ? `有分這筆，${shareText(m.id)}` : '沒有分這筆'}`}
                  onClick={() => { toggle(m.id); setError(''); }}
                  className="press flex min-h-14 min-w-0 flex-1 items-center gap-3 py-1.5 pl-4 text-left"
                >
                  <span aria-hidden className={`check-btn ${on ? 'on' : ''}`}><Check size={18} strokeWidth={2} /></span>
                  <span aria-hidden className={`av ${m.id === me.id ? 'me' : ''}`}>{initialOf(m.isMe ? ownerName : m.name)}</span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-body">
                      {name}{m.id === payerId && <span className="ml-1.5 rounded-full bg-fill px-2 py-px text-[11px] text-muted">付款</span>}
                    </span>
                    {on && foreign && <span className="num text-caption text-muted">≈ {formatMoney(amounts[m.id] ?? 0)}</span>}
                  </span>
                  <span className="num flex-none text-body">{on ? shareText(m.id) : '不分'}</span>
                </button>
              </li>
            );
          })}
        </ul>
        <p className="-mt-1 px-1 text-caption leading-[1.8] tracking-[.06em] text-muted">除不盡的零頭由前面的人多付 $1</p>
      </Field>

      <div className="flex flex-col gap-1.5 rounded-sm bg-fill px-4 py-3.5">
        <span className="caption">送出之後</span>
        <p className="text-body-s leading-[1.8]">
          {problem ? '填好金額、選好跟誰分，這裡會說明怎麼記。'
            : pending ? `跟 ${ownerName} 有關，${ownerName} 確認後才會算進結算。確認前你可以撤回。`
              : '朋友之間的花費，直接記進群組，大家馬上看得到。記錯了可以撤回。'}
        </p>
      </div>

      {error && <p role="alert" className="-my-2 text-caption text-alert">{error}</p>}
      <button type="button" onClick={submit} disabled={!!problem || add.isPending} className="btn-primary press w-full">
        {add.isPending ? '送出中…' : `${pending ? '送出' : '記下'}${totalOriginal ? ` ${foreign ? formatForeign(totalOriginal, currency) : formatMoney(total)}` : ''}`}
      </button>
    </>
  );
}
