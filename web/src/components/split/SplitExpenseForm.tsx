'use client';

import { Check, Minus, Plus } from 'lucide-react';
import { useState } from 'react';
import { categoriesFor, getCategory } from '@/lib/categories';
import { useAccounts, useSaveSplitExpense } from '@/lib/data';
import { toISODate, toTime } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { meOf, splitAmounts, splitProblem } from '@/lib/split';
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

/**
 * 分帳花費的表單：誰先付、跟誰分、怎麼分，下面即時顯示怎麼記進你的帳。
 * 群組頁的新增／編輯、記一筆打開「分帳」都用這個。
 */
export function SplitExpenseForm({ group, editing, initial, onSaved }: {
  group: SplitGroup;
  editing?: SplitExpense;
  initial?: SplitInitial;
  /** again：使用者按了「記下並再記一筆」 */
  onSaved: (message: string, again: boolean) => void;
}) {
  const { data: accounts = [] } = useAccounts();
  const save = useSaveSplitExpense();
  const me = meOf(group)!;
  const payable = payableAccounts(accounts);
  const ids = group.members.map((m) => m.id);

  const [amount, setAmount] = useState(editing ? String(editing.amount) : initial?.amount ?? '');
  const [title, setTitle] = useState(editing?.title ?? initial?.title ?? '');
  const [categoryId, setCategoryId] = useState(editing?.categoryId ?? (initial?.categoryId && getCategory(initial.categoryId).type === 'EXPENSE' ? initial.categoryId : 'food'));
  const [payerId, setPayerId] = useState(editing?.payerId ?? me.id);
  const [accountId, setAccountId] = useState(editing?.accountId ?? '');
  const [mode, setMode] = useState<SplitMode>(editing?.mode ?? 'equal');
  const [who, setWho] = useState<Set<string>>(() => new Set(editing ? Object.keys(editing.amounts).filter((k) => editing.amounts[k] > 0) : ids));
  const [shares, setShares] = useState<Record<string, number>>(() => (editing?.mode === 'shares' ? { ...editing.weights } : Object.fromEntries(ids.map((k) => [k, 1]))));
  const [exact, setExact] = useState<Record<string, string>>(() => (editing?.mode === 'exact' ? Object.fromEntries(Object.entries(editing.weights).map(([k, v]) => [k, String(v)])) : {}));
  const [date] = useState(editing?.date ?? initial?.date ?? toISODate(new Date()));
  const [error, setError] = useState('');

  const total = Math.max(0, parseInt(amount || '0', 10) || 0);
  const acct = accountId || payable[0]?.id || '';
  // 照成員順序組 weights，平分的零頭才會固定給前面的人
  const weights: Record<string, number> = Object.fromEntries(ids.flatMap((k) => {
    if (mode === 'exact') { const v = parseInt(exact[k] || '0', 10) || 0; return v > 0 ? [[k, v]] : []; }
    if (!who.has(k)) return [];
    const w = mode === 'shares' ? shares[k] ?? 0 : 1;
    return w > 0 ? [[k, w]] : [];
  }));
  const amounts = splitAmounts(mode, total, weights);
  const problem = splitProblem(mode, total, weights) || (payerId === me.id && !acct ? '請先新增付款帳戶' : '');
  const lines = effectLines(group, { amount: total, amounts, payerId, accountId: acct, categoryId }, accounts);

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
  const exactValue = (k: string) => parseInt(exact[k] || '0', 10) || 0;
  const switchMode = (m: SplitMode) => {
    if (m === mode) return;
    // 從指定金額切回平分／份數：沿用有填金額的人，填 0 的人就是不分
    if (mode === 'exact') {
      const picked = ids.filter((k) => exactValue(k) > 0);
      if (picked.length) setWho(new Set(picked));
    }
    // 切到指定金額：先帶入目前勾選的人平分的結果，改幾個數字就好（分的人變了就重帶）
    if (m === 'exact' && total) {
      const current = ids.filter((k) => exactValue(k) > 0);
      const same = current.length === who.size && current.every((k) => who.has(k));
      if (!same) {
        const equal = splitAmounts('equal', total, Object.fromEntries(ids.filter((k) => who.has(k)).map((k) => [k, 1])));
        setExact(Object.fromEntries(Object.entries(equal).map(([k, v]) => [k, String(v)])));
      }
    }
    setMode(m);
  };

  const submit = async (again: boolean) => {
    if (problem) return setError(problem);
    const now = new Date();
    const finalTitle = title.trim() || getCategory(categoryId).name;
    try {
      await save.mutateAsync({
        id: editing?.id, groupId: group.id, date,
        time: editing ? editing.time : date === toISODate(now) ? toTime(now) : null,
        title: finalTitle, categoryId, amount: total, payerId, accountId: payerId === me.id ? acct : null, mode, weights, amounts,
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

  const remain = mode === 'exact' ? (problem && problem !== '請輸入金額' ? problem : total ? '剛好分完' : '') : MODE_HINT[mode];

  return (
    <>
      <Field label="金額" htmlFor="split-amount">
        <div className="flex items-baseline gap-1.5 border-b border-fg px-0.5 pb-2 focus-within:border-b-2 focus-within:pb-[7px]">
          <span className="display text-[22px]">$</span>
          <input
            id="split-amount"
            data-autofocus
            inputMode="numeric"
            value={amount}
            onChange={(e) => { setAmount(e.target.value.replace(/\D/g, '').slice(0, 8)); setError(''); }}
            placeholder="0"
            autoComplete="off"
            className="display min-w-0 flex-1 bg-transparent text-[36px] outline-none"
          />
        </div>
      </Field>

      <Field label="品項" htmlFor="split-title">
        <input id="split-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={40} placeholder="例如：午餐・野菜鍋" autoComplete="off" className="field-input" />
        <Pills items={categoriesFor('EXPENSE').map((c) => ({ id: c.id, label: c.name }))} value={categoryId} onPick={setCategoryId} label="分類" wrap />
      </Field>

      <Field label="誰先付的">
        <Pills items={group.members.map((m) => ({ id: m.id, label: memberLabel(m) }))} value={payerId} onPick={setPayerId} label="誰先付的" wrap />
      </Field>
      {payerId === me.id && (
        <Field label="從哪個帳戶付">
          {payable.length
            ? <Pills items={payable.map((a) => ({ id: a.id, label: a.name }))} value={acct} onPick={setAccountId} label="付款帳戶" wrap />
            : <p className="text-body-s text-muted">還沒有帳戶，請先到資產頁新增。</p>}
        </Field>
      )}

      <Field label="怎麼分">
        <Pills items={MODES} value={mode} onPick={switchMode} label="怎麼分" />
        <ul className="card py-1">
          {group.members.map((m) => {
            const on = mode === 'exact' ? (parseInt(exact[m.id] || '0', 10) || 0) > 0 : who.has(m.id);
            const name = memberLabel(m);
            return (
              <li key={m.id} className={`flex min-h-14 items-center gap-3 border-t border-line pr-4 first:border-t-0 ${on ? '' : 'text-muted'}`}>
                {mode === 'exact' ? (
                  <span className="flex min-w-0 flex-1 items-center gap-3 py-1.5 pl-4">
                    <MemberAvatar member={m} />
                    <span className="truncate text-body">
                      {name}{m.id === payerId && <span className="ml-1.5 rounded-full bg-fill px-2 py-px text-[11px] text-muted">付款</span>}
                    </span>
                  </span>
                ) : (
                  // 整列都能點（不只左邊的圓圈），手機上比較好按
                  <button
                    type="button"
                    aria-pressed={on}
                    aria-label={`${name}${on ? '有' : '沒有'}分這筆${mode === 'equal' && on ? `，${formatMoney(amounts[m.id] ?? 0)}` : ''}`}
                    onClick={() => toggle(m.id)}
                    className="press flex min-h-14 min-w-0 flex-1 items-center gap-3 py-1.5 pl-4 text-left"
                  >
                    <span aria-hidden className={`check-btn ${on ? 'on' : ''}`}><Check size={18} strokeWidth={2} /></span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-body">
                        {name}{m.id === payerId && <span className="ml-1.5 rounded-full bg-fill px-2 py-px text-[11px] text-muted">付款</span>}
                      </span>
                      {mode === 'shares' && on && <span className="num text-caption text-muted">{formatMoney(amounts[m.id] ?? 0)}</span>}
                    </span>
                    {mode === 'equal' && <span className="num flex-none text-body">{on ? formatMoney(amounts[m.id] ?? 0) : '不分'}</span>}
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
                      inputMode="numeric"
                      value={exact[m.id] ?? ''}
                      onChange={(e) => { setExact({ ...exact, [m.id]: e.target.value.replace(/\D/g, '').slice(0, 8) }); setError(''); }}
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
        {remain && <p aria-live="polite" className={`-mt-1 px-1 text-caption tracking-[.06em] ${mode === 'exact' && problem ? 'text-alert' : 'text-muted'}`}>{remain}</p>}
      </Field>

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
            {save.isPending ? '儲存中…' : `記下${total ? ` ${formatMoney(total)}` : ''}`}
          </button>
        </div>
      )}
    </>
  );
}
