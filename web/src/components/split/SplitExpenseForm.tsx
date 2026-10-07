'use client';

import { Check, Minus, Plus } from 'lucide-react';
import { useState } from 'react';
import { categoriesFor, getCategory } from '@/lib/categories';
import { cleanAmountInput, formatForeign, getCurrency, toMinor, toTwd, twdPerUnit } from '@/lib/currency';
import { useAccounts, useFxRates, useSaveSplitExpense } from '@/lib/data';
import { toISODate, toTime } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { allocate, meOf, splitProblem } from '@/lib/split';
import type { SplitExpense, SplitGroup, SplitMode } from '@/lib/types';
import { EffectBox, Field, MemberAvatar, Pills, effectLines, memberLabel, payableAccounts } from './parts';

const MODES: { id: SplitMode; label: string }[] = [
  { id: 'equal', label: '平分' },
  { id: 'exact', label: '指定金額' },
  { id: 'shares', label: '份數' },
];
const MODE_HINT: Record<SplitMode, string> = {
  equal: '除不盡的零頭由前面的人多付 $1',
  exact: '',
  shares: '例如有人點兩杯，就給他 2 份',
};

export interface SplitInitial {
  amount?: string;
  title?: string;
  categoryId?: string;
  date?: string;
}

/** 輸入框裡的數字：整數不帶小數，有小數的幣別保留兩位 */
const inputValue = (n: number, decimals: number) => (Number.isInteger(n) || !decimals ? String(Math.round(n * 10 ** decimals) / 10 ** decimals) : n.toFixed(decimals));
const num = (s: string | undefined) => parseFloat(s || '0') || 0;

/**
 * 分帳花費的表單：誰先付、跟誰分、怎麼分，下面即時顯示怎麼記進你的帳。
 * 群組頁的新增／編輯、記一筆打開「分帳」都用這個。
 * 旅程可以輸入外幣：原幣金額 × 匯率換成台幣入帳，分攤、結算、個人帳都用台幣。
 */
export function SplitExpenseForm({ group, editing, initial, onSaved }: {
  group: SplitGroup;
  editing?: SplitExpense;
  initial?: SplitInitial;
  /** again：使用者按了「記下並再記一筆」 */
  onSaved: (message: string, again: boolean) => void;
}) {
  const { data: accounts = [] } = useAccounts();
  const fx = useFxRates();
  const save = useSaveSplitExpense();
  const me = meOf(group)!;
  const payable = payableAccounts(accounts);
  const ids = group.members.map((m) => m.id);
  // 旅程的幣別可以切換：旅程幣別或台幣；一般群組只有台幣
  const currencyChoices = [...new Set([editing?.currency, group.currency, 'TWD'].filter((c): c is string => Boolean(c)))];

  const [currency, setCurrency] = useState(editing?.currency ?? group.currency ?? 'TWD');
  const [rateInput, setRateInput] = useState(editing?.fxRate ? String(editing.fxRate) : '');
  const [amount, setAmount] = useState(editing ? String(editing.currency !== 'TWD' && editing.originalAmount ? editing.originalAmount : editing.amount) : initial?.amount ?? '');
  const [title, setTitle] = useState(editing?.title ?? initial?.title ?? '');
  const [categoryId, setCategoryId] = useState(editing?.categoryId ?? (initial?.categoryId && getCategory(initial.categoryId).type === 'EXPENSE' ? initial.categoryId : 'food'));
  const [payerId, setPayerId] = useState(editing?.payerId ?? me.id);
  const [accountId, setAccountId] = useState(editing?.accountId ?? '');
  const [mode, setMode] = useState<SplitMode>(editing?.mode ?? 'equal');
  const [who, setWho] = useState<Set<string>>(() => new Set(editing ? Object.keys(editing.amounts).filter((k) => editing.amounts[k] > 0) : ids));
  const [shares, setShares] = useState<Record<string, number>>(() => (editing?.mode === 'shares' ? { ...editing.weights } : Object.fromEntries(ids.map((k) => [k, 1]))));
  const [exact, setExact] = useState<Record<string, string>>(() => (editing?.mode === 'exact' ? Object.fromEntries(Object.entries(editing.weights).map(([k, v]) => [k, String(v)])) : {}));
  // 指定金額裡使用者親手改過的人；沒改過的人會自動分掉剩下的金額（編輯舊的指定金額時全部視為改過）
  const [touched, setTouched] = useState<Set<string>>(() => new Set(editing?.mode === 'exact' ? Object.keys(editing.weights) : []));
  const [date] = useState(editing?.date ?? initial?.date ?? toISODate(new Date()));
  const [error, setError] = useState('');

  const cur = getCurrency(currency);
  const dec = cur.decimals;
  const foreign = currency !== 'TWD';
  const autoRate = twdPerUnit(fx.data, currency);
  const rate = foreign ? num(rateInput) || autoRate || 0 : 1;
  const totalOriginal = num(amount);
  const totalMinor = toMinor(totalOriginal, dec);
  const total = foreign ? toTwd(totalOriginal, rate) : Math.round(totalOriginal);
  const acct = accountId || payable[0]?.id || '';

  // 照成員順序組 weights，平分的零頭才會固定給前面的人；指定金額用最小單位（日圓 1、美元 0.01）
  const weights: Record<string, number> = Object.fromEntries(ids.flatMap((k) => {
    if (mode === 'exact') { const v = toMinor(num(exact[k]), dec); return v > 0 ? [[k, v]] : []; }
    if (!who.has(k)) return [];
    const w = mode === 'shares' ? shares[k] ?? 0 : 1;
    return w > 0 ? [[k, w]] : [];
  }));
  // 台幣的指定金額直接用；外幣的指定金額照比例換成台幣，加總一定等於換算後的總額
  const amounts = mode === 'exact' && !foreign ? weights : allocate(total, weights);
  // 每個人的原幣金額（顯示用）
  const originals = mode === 'exact' ? weights : allocate(totalMinor, weights);
  const exactDiff = totalMinor - Object.values(weights).reduce((s, v) => s + v, 0);
  const problem = (foreign && totalOriginal > 0 && !rate ? '請輸入匯率' : '')
    || (mode === 'exact'
      ? (!totalOriginal ? '請輸入金額' : !Object.keys(weights).length ? '至少選一個人分' : exactDiff > 0 ? `還有 ${formatForeign(exactDiff / 10 ** dec, currency)} 沒分到` : exactDiff < 0 ? `多分了 ${formatForeign(-exactDiff / 10 ** dec, currency)}` : '')
      : splitProblem(mode, total, weights))
    || (payerId === me.id && !acct ? '請先新增付款帳戶' : '');
  const lines = effectLines(group, { amount: total, amounts, payerId, accountId: acct, categoryId }, accounts, foreign && totalOriginal ? formatForeign(totalOriginal, currency) : undefined);
  const shareText = (k: string) => (foreign ? formatForeign((originals[k] ?? 0) / 10 ** dec, currency) : formatMoney(amounts[k] ?? 0));

  const toggle = (k: string) => setWho((prev) => {
    const next = new Set(prev);
    if (next.has(k)) next.delete(k);
    else next.add(k);
    return next;
  });
  const step = (k: string, d: number) => {
    const n = Math.max(0, (shares[k] ?? 0) + d);
    setShares({ ...shares, [k]: n });
    if (!n) setWho((prev) => { const next = new Set(prev); next.delete(k); return next; });
  };
  /** 指定金額：總額扣掉改過的人，剩下的由沒改過、而且有勾選的人平分 */
  const rebalance = (values: Record<string, string>, fixed: Set<string>, sum: number, decimals = dec) => {
    const next = { ...values };
    const free = ids.filter((k) => who.has(k) && !fixed.has(k));
    if (!free.length) return next;
    const rest = toMinor(sum, decimals) - ids.filter((k) => fixed.has(k)).reduce((s, k) => s + toMinor(num(next[k]), decimals), 0);
    const share = rest > 0 ? allocate(rest, Object.fromEntries(free.map((k) => [k, 1]))) : {};
    for (const k of free) next[k] = inputValue((share[k] ?? 0) / 10 ** decimals, decimals);
    return next;
  };
  const resetExact = (sum = totalOriginal, decimals = dec) => {
    setTouched(new Set());
    setExact(rebalance({}, new Set(), sum, decimals));
  };
  const changeAmount = (raw: string) => {
    const v = cleanAmountInput(raw, dec);
    setAmount(v);
    setError('');
    if (mode === 'exact') setExact(rebalance(exact, touched, num(v)));
  };
  const changeExact = (k: string, raw: string) => {
    const nextTouched = new Set(touched).add(k);
    setTouched(nextTouched);
    setExact(rebalance({ ...exact, [k]: cleanAmountInput(raw, dec) }, nextTouched, totalOriginal));
    setError('');
  };
  const switchMode = (m: SplitMode) => {
    if (m === mode) return;
    // 從指定金額切回平分／份數：沿用有填金額的人，填 0 的人就是不分
    if (mode === 'exact') {
      const picked = ids.filter((k) => num(exact[k]) > 0);
      if (picked.length) setWho(new Set(picked));
    }
    // 切到指定金額：先帶入目前勾選的人平分的結果，改幾個數字就好
    if (m === 'exact') resetExact();
    setMode(m);
  };
  const switchCurrency = (c: string) => {
    if (c === currency) return;
    const d = getCurrency(c).decimals;
    const v = cleanAmountInput(amount, d);
    setCurrency(c);
    setAmount(v);
    setRateInput('');
    if (mode === 'exact') resetExact(num(v), d);
  };

  const submit = async (again: boolean) => {
    if (problem) return setError(problem);
    const now = new Date();
    const finalTitle = title.trim() || getCategory(categoryId).name;
    // 指定金額存使用者輸入的原幣金額，編輯時才能原樣帶回
    const storedWeights = mode === 'exact' ? Object.fromEntries(Object.entries(weights).map(([k, v]) => [k, v / 10 ** dec])) : weights;
    try {
      await save.mutateAsync({
        id: editing?.id, groupId: group.id, date,
        time: editing ? editing.time : date === toISODate(now) ? toTime(now) : null,
        title: finalTitle, categoryId, amount: total, payerId, accountId: payerId === me.id ? acct : null, mode, weights: storedWeights, amounts,
        currency, originalAmount: foreign ? totalOriginal : null, fxRate: foreign ? rate : null,
        originalShares: foreign ? Object.fromEntries(Object.entries(originals).map(([k, v]) => [k, v / 10 ** dec])) : null,
      });
      const mine = amounts[me.id] ?? 0;
      onSaved(editing ? `已更新：${finalTitle}，結算重新計算了` : `已記下：${finalTitle}${mine ? `，你的部分 ${formatMoney(mine)}` : ''}`, again);
      if (again) {
        setAmount('');
        setTitle('');
        setExact({});
        setError('');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '儲存失敗，請再試一次');
    }
  };

  const remain = mode === 'exact'
    ? (problem && problem !== '請輸入金額' ? problem : totalOriginal ? '剛好分完・改一個人的金額，其他沒改過的人會自動分剩下的' : '')
    : MODE_HINT[mode];

  return (
    <>
      {currencyChoices.length > 1 && (
        <Field label="幣別">
          <Pills items={currencyChoices.map((c) => ({ id: c, label: `${getCurrency(c).name} ${c}` }))} value={currency} onPick={switchCurrency} label="幣別" />
        </Field>
      )}

      <Field label="金額" htmlFor="split-amount">
        <div className="flex items-baseline gap-1.5 border-b border-fg px-0.5 pb-2 focus-within:border-b-2 focus-within:pb-[7px]">
          <span className="display text-[22px]">{cur.symbol.trim()}</span>
          <input
            id="split-amount"
            data-autofocus
            inputMode={dec ? 'decimal' : 'numeric'}
            value={amount}
            onChange={(e) => changeAmount(e.target.value)}
            placeholder="0"
            autoComplete="off"
            className="display min-w-0 flex-1 bg-transparent text-[36px] outline-none"
          />
        </div>
        {foreign && (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-0.5 text-caption text-muted">
            <span className="num text-body-s text-fg">≈ {formatMoney(total)}</span>
            <label htmlFor="split-rate" className="ml-auto">匯率 1 {currency} =</label>
            <input
              id="split-rate"
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

      <Field label="品項" htmlFor="split-title">
        <input id="split-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={40} placeholder="例如：午餐・野菜鍋" autoComplete="off" className="field-input" />
        <Pills items={categoriesFor('EXPENSE').map((c) => ({ id: c.id, label: c.name }))} value={categoryId} onPick={setCategoryId} label="分類" wrap />
      </Field>

      {group.members.length > 1 && (
        <Field label="誰先付的">
          <Pills items={group.members.map((m) => ({ id: m.id, label: memberLabel(m) }))} value={payerId} onPick={setPayerId} label="誰先付的" wrap />
        </Field>
      )}
      {payerId === me.id && (
        <Field label="從哪個帳戶付">
          {payable.length
            ? <Pills items={payable.map((a) => ({ id: a.id, label: a.name }))} value={acct} onPick={setAccountId} label="付款帳戶" wrap />
            : <p className="text-body-s text-muted">還沒有帳戶，請先到資產頁新增。</p>}
        </Field>
      )}

      {group.members.length > 1 && (
        <Field label="怎麼分">
          <Pills items={MODES} value={mode} onPick={switchMode} label="怎麼分" />
          <ul className="card py-1">
            {group.members.map((m) => {
              const on = mode === 'exact' ? num(exact[m.id]) > 0 : who.has(m.id);
              const name = memberLabel(m);
              return (
                <li key={m.id} className={`flex min-h-14 items-center gap-3 border-t border-line pr-4 first:border-t-0 ${on ? '' : 'text-muted'}`}>
                  {mode === 'exact' ? (
                    <span className="flex min-w-0 flex-1 items-center gap-3 py-1.5 pl-4">
                      <MemberAvatar member={m} />
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate text-body">
                          {name}{m.id === payerId && <span className="ml-1.5 rounded-full bg-fill px-2 py-px text-[11px] text-muted">付款</span>}
                        </span>
                        {foreign && on && <span className="num text-caption text-muted">≈ {formatMoney(amounts[m.id] ?? 0)}</span>}
                      </span>
                    </span>
                  ) : (
                    // 整列都能點（不只左邊的圓圈），手機上比較好按
                    <button
                      type="button"
                      aria-pressed={on}
                      aria-label={`${name}${on ? '有' : '沒有'}分這筆${mode === 'equal' && on ? `，${shareText(m.id)}` : ''}`}
                      onClick={() => toggle(m.id)}
                      className="press flex min-h-14 min-w-0 flex-1 items-center gap-3 py-1.5 pl-4 text-left"
                    >
                      <span aria-hidden className={`check-btn ${on ? 'on' : ''}`}><Check size={18} strokeWidth={2} /></span>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-body">
                          {name}{m.id === payerId && <span className="ml-1.5 rounded-full bg-fill px-2 py-px text-[11px] text-muted">付款</span>}
                        </span>
                        {on && (mode === 'shares' || foreign) && (
                          <span className="num text-caption text-muted">{mode === 'shares' ? shareText(m.id) : ''}{foreign ? `${mode === 'shares' ? '・' : ''}≈ ${formatMoney(amounts[m.id] ?? 0)}` : ''}</span>
                        )}
                      </span>
                      {mode === 'equal' && <span className="num flex-none text-body">{on ? shareText(m.id) : '不分'}</span>}
                    </button>
                  )}
                  {mode === 'shares' && on && (
                    <span role="group" aria-label={`${name}的份數`} className="flex flex-none items-center gap-1">
                      <button type="button" onClick={() => step(m.id, -1)} aria-label="少一份" className="icon-btn press h-9 w-9"><Minus size={16} strokeWidth={1.5} aria-hidden /></button>
                      <output aria-live="polite" className="num w-7 text-center text-body">{shares[m.id] ?? 0}</output>
                      <button type="button" onClick={() => step(m.id, 1)} aria-label="多一份" className="icon-btn press h-9 w-9"><Plus size={16} strokeWidth={1.5} aria-hidden /></button>
                    </span>
                  )}
                  {mode === 'exact' && (
                    <>
                      <label className="sr-only" htmlFor={`exact-${m.id}`}>{name}要付多少</label>
                      <input
                        id={`exact-${m.id}`}
                        inputMode={dec ? 'decimal' : 'numeric'}
                        value={exact[m.id] ?? ''}
                        onChange={(e) => changeExact(m.id, e.target.value)}
                        placeholder="0"
                        autoComplete="off"
                        className="num h-10 w-24 flex-none rounded-xs border border-line bg-page px-2.5 text-right text-[16px]"
                      />
                    </>
                  )}
                </li>
              );
            })}
          </ul>
          {remain && <p aria-live="polite" className={`-mt-1 px-1 text-caption leading-[1.8] tracking-[.06em] ${mode === 'exact' && problem ? 'text-alert' : 'text-muted'}`}>{remain}</p>}
          {mode === 'exact' && totalOriginal > 0 && touched.size > 0 && (
            <button type="button" onClick={() => resetExact()} className="press -mt-1 self-start px-1 text-caption underline">重新平分</button>
          )}
        </Field>
      )}

      <EffectBox lines={mode === 'exact' && problem ? ['分配好金額後，這裡會顯示怎麼記進你的帳'] : lines} />

      {error && <p role="alert" className="-my-2 text-caption text-alert">{error}</p>}

      {editing ? (
        <button type="button" onClick={() => submit(false)} disabled={!!problem || save.isPending} className="btn-primary press w-full">
          {save.isPending ? '儲存中…' : '儲存變更'}
        </button>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => submit(true)} disabled={!!problem || save.isPending} className="btn-secondary press min-h-[52px]">記下並再記一筆</button>
          <button type="button" onClick={() => submit(false)} disabled={!!problem || save.isPending} className="btn-primary press px-3">
            {save.isPending ? '儲存中…' : `記下${totalOriginal ? ` ${foreign ? formatForeign(totalOriginal, currency) : formatMoney(total)}` : ''}`}
          </button>
        </div>
      )}
    </>
  );
}
