'use client';

import {
  ArrowRight, Car, Gift, GraduationCap, Headphones, Heart, House, PiggyBank, Pin, PinOff, Plane, Plus, Shield, Smartphone, Trash2,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { colorFor } from '@/lib/categories';
import { useAddDeposit, useDeleteDeposit, useDeleteGoal, useGoalDeposits, useGoals, usePinGoal, useSaveGoal } from '@/lib/data';
import { toISODate } from '@/lib/dates';
import { deadlineText, depositError, homeGoal, MAX_GOAL_NAME, progress, sortGoals, type SavingsGoal } from '@/lib/goals';
import { formatMoney, money, parseAmount } from '@/lib/money';
import { useUi } from '@/lib/ui-store';
import { Mascot } from './Mascot';
import { Sheet, SheetHeader } from './Sheet';
import { Field, Pills } from './split/parts';
import { SectionHeader, useHidden } from './ui';

/** 目標可以選的圖示，key 存進資料庫 */
export const GOAL_ICONS: Record<string, { icon: LucideIcon; label: string }> = {
  'piggy-bank': { icon: PiggyBank, label: '存錢' },
  plane: { icon: Plane, label: '旅行' },
  smartphone: { icon: Smartphone, label: '手機' },
  headphones: { icon: Headphones, label: '耳機' },
  house: { icon: House, label: '房子' },
  car: { icon: Car, label: '車' },
  gift: { icon: Gift, label: '禮物' },
  'graduation-cap': { icon: GraduationCap, label: '學習' },
  heart: { icon: Heart, label: '家人' },
  shield: { icon: Shield, label: '預備金' },
};

const MORE = 'press inline-flex min-h-11 items-center gap-1 px-1 text-body-s tracking-[.08em]';
const md = (iso: string) => `${Number(iso.slice(5, 7))}/${Number(iso.slice(8, 10))}`;

function GoalIcon({ goal, small = false }: { goal: Pick<SavingsGoal, 'id' | 'icon'>; small?: boolean }) {
  const Icon = (GOAL_ICONS[goal.icon] ?? GOAL_ICONS['piggy-bank']).icon;
  return (
    <span aria-hidden className={`ico ${small ? 'sm' : ''}`} style={{ background: colorFor(goal.id) }}>
      <Icon size={small ? 16 : 20} strokeWidth={1.5} />
    </span>
  );
}

function Bar({ ratio, achieved }: { ratio: number; achieved: boolean }) {
  return (
    <div aria-hidden className="h-[var(--bar-h)] overflow-hidden rounded-full border-2 border-ink bg-fill">
      <i className="block h-full border-r-2 border-ink" style={{ width: `${Math.round(ratio * 100)}%`, background: achieved ? 'var(--green)' : 'var(--pink)' }} />
    </div>
  );
}

// ---------- 面板：新增／編輯目標、目標詳細、存入／拿出來 ----------

type SheetState =
  | { mode: 'new' }
  | { mode: 'detail'; id: string }
  | { mode: 'edit'; id: string }
  | { mode: 'deposit'; id: string; withdraw: boolean };

function GoalSheets({ state, onChange }: { state: SheetState | null; onChange: (s: SheetState | null) => void }) {
  const { data: goals = [] } = useGoals();
  const close = () => onChange(null);
  const goal = state && state.mode !== 'new' ? goals.find((g) => g.id === state.id) ?? null : null;
  // 目標被刪掉（或還沒讀到）就關掉
  const open = state !== null && (state.mode === 'new' || goal !== null);
  return (
    <Sheet open={open} onClose={close} labelledBy="goal-sheet-title">
      {state?.mode === 'new' && <GoalForm onDone={(id) => onChange(id ? { mode: 'detail', id } : null)} onClose={close} />}
      {state?.mode === 'edit' && goal && <GoalForm key={goal.id} goal={goal} onDone={() => onChange({ mode: 'detail', id: goal.id })} onClose={close} />}
      {state?.mode === 'detail' && goal && <GoalDetail goal={goal} onChange={onChange} onClose={close} />}
      {state?.mode === 'deposit' && goal && (
        <DepositForm key={`${goal.id}-${state.withdraw}`} goal={goal} withdraw={state.withdraw} onDone={() => onChange({ mode: 'detail', id: goal.id })} onClose={close} />
      )}
    </Sheet>
  );
}

function GoalForm({ goal, onDone, onClose }: { goal?: SavingsGoal; onDone: (id?: string) => void; onClose: () => void }) {
  const save = useSaveGoal();
  const remove = useDeleteGoal();
  const showToast = useUi((s) => s.showToast);
  const today = toISODate(new Date());
  const [name, setName] = useState(goal?.name ?? '');
  const [target, setTarget] = useState(goal ? String(goal.target) : '');
  const [hasDate, setHasDate] = useState(Boolean(goal?.deadline));
  const [deadline, setDeadline] = useState(goal?.deadline ?? '');
  const [icon, setIcon] = useState(goal?.icon ?? 'piggy-bank');
  const [archived, setArchived] = useState(goal?.archived ?? false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    const value = parseAmount(target);
    if (!name.trim()) return setError('請輸入要存什麼');
    if (!value) return setError('請輸入目標金額');
    if (hasDate && !deadline) return setError('請選日期，或改成沒有日期');
    try {
      const id = await save.mutateAsync({ id: goal?.id, name: name.trim(), target: value, deadline: hasDate ? deadline : null, icon, archived });
      showToast(goal ? '已儲存目標' : `新增目標：${name.trim()}，豬撲滿陪你存！`);
      onDone(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : '儲存失敗，請再試一次');
    }
  };

  const destroy = async () => {
    if (!goal) return;
    try {
      await remove.mutateAsync(goal.id);
      showToast(`已刪除目標：${goal.name}`);
      onClose();
    } catch (e) {
      setConfirmDelete(false);
      setError(e instanceof Error ? e.message : '刪除失敗，請再試一次');
    }
  };

  return (
    <>
      <SheetHeader id="goal-sheet-title" title={goal ? '編輯目標' : '新增存錢目標'} en="Savings" onClose={onClose} />
      <Field label="要存什麼" htmlFor="goal-name">
        <input id="goal-name" data-autofocus value={name} onChange={(e) => { setName(e.target.value); setError(''); }} maxLength={MAX_GOAL_NAME} placeholder="例如：日本旅行、新手機" autoComplete="off" className="field-input" />
      </Field>
      <Field label="目標金額" htmlFor="goal-target">
        <div className="field-input flex items-center gap-1 px-3.5">
          <span aria-hidden className="num text-muted">$</span>
          <input id="goal-target" inputMode="numeric" value={target} onChange={(e) => { setTarget(e.target.value.replace(/\D/g, '').slice(0, 8)); setError(''); }} placeholder="0" autoComplete="off" className="num min-w-0 flex-1 bg-transparent text-[16px] outline-none" />
        </div>
      </Field>
      <Field label="想在哪天前存到">
        <Pills items={[{ id: 'none', label: '沒有日期' }, { id: 'date', label: '選日期' }]} value={hasDate ? 'date' : 'none'} onPick={(v) => setHasDate(v === 'date')} label="日期" />
        {hasDate && (
          <>
            <label htmlFor="goal-deadline" className="sr-only">日期</label>
            <input id="goal-deadline" type="date" value={deadline} min={today} onChange={(e) => { setDeadline(e.target.value); setError(''); }} className="field-input w-[180px] px-3" />
          </>
        )}
      </Field>
      <Field label="圖示">
        <div role="group" aria-label="圖示" className="grid grid-cols-5 gap-2">
          {Object.entries(GOAL_ICONS).map(([key, { icon: Icon, label }]) => (
            <button key={key} type="button" aria-pressed={icon === key} aria-label={label} onClick={() => setIcon(key)} className="pill press h-12 justify-center px-0">
              <Icon size={20} strokeWidth={1.5} aria-hidden />
            </button>
          ))}
        </div>
      </Field>
      {error && <p role="alert" className="-my-2 text-caption text-alert">{error}</p>}
      <button type="button" onClick={submit} disabled={save.isPending} className="btn-primary press w-full">{save.isPending ? '儲存中…' : goal ? '儲存' : '新增'}</button>

      {goal && (
        <section aria-labelledby="goal-manage" className="flex flex-col gap-2 border-t border-line pt-4">
          <h3 id="goal-manage" className="caption">管理</h3>
          <button type="button" onClick={() => setArchived(!archived)} aria-pressed={archived} className="btn-secondary press w-full">
            {archived ? '放回清單（按儲存後生效）' : '收起來（按儲存後生效，紀錄都還在）'}
          </button>
          {confirmDelete ? (
            <div role="alertdialog" aria-labelledby="goal-del-q" className="flex flex-col gap-3 rounded-sm bg-alert-tint p-4">
              <p id="goal-del-q" className="text-body-s leading-[1.8] text-alert">確定刪除「{goal.name}」？存入紀錄會一起刪掉（帳戶餘額不受影響）。</p>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setConfirmDelete(false)} className="btn-secondary press" autoFocus>取消</button>
                <button type="button" onClick={destroy} disabled={remove.isPending} className="btn-secondary press border-alert text-alert">{remove.isPending ? '刪除中…' : '刪除'}</button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setConfirmDelete(true)} className="btn-secondary press w-full text-alert">
              <Trash2 size={16} strokeWidth={1.5} aria-hidden />刪除這個目標
            </button>
          )}
        </section>
      )}
    </>
  );
}

function GoalDetail({ goal, onChange, onClose }: { goal: SavingsGoal; onChange: (s: SheetState) => void; onClose: () => void }) {
  const hidden = useHidden();
  const showToast = useUi((s) => s.showToast);
  const { data: deposits, isPending } = useGoalDeposits(goal.id);
  const removeDeposit = useDeleteDeposit();
  const pin = usePinGoal();
  const p = progress(goal);
  const due = deadlineText(goal.deadline, toISODate(new Date()));

  const togglePin = () => pin.mutate(goal.pinned ? null : goal.id, {
    onSuccess: () => showToast(goal.pinned ? '已取消釘選，首頁顯示最近到期的目標' : `首頁會顯示「${goal.name}」`),
    onError: (e) => showToast(e.message),
  });

  return (
    <>
      <SheetHeader id="goal-sheet-title" title={goal.name} en="Savings" sub={goal.archived ? '已收起來' : undefined} onClose={onClose} />
      <div className="card flex items-center gap-4 p-5">
        <Mascot kind="piggy" mood={p.achieved ? 'yay' : 'ok'} className="w-[84px] flex-none" />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <p className="flex flex-wrap items-baseline gap-x-1.5">
            <span className="num text-[26px] leading-tight">{money(p.saved, hidden)}</span>
            <span className="num text-body-s text-muted">/ {money(goal.target, hidden)}</span>
          </p>
          <Bar ratio={p.ratio} achieved={p.achieved} />
          <p className="caption leading-[1.7]">
            {p.achieved ? '存到了！' : `還差 ${money(p.remaining, hidden)}`}{due ? `・${due}` : ''}
          </p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => onChange({ mode: 'deposit', id: goal.id, withdraw: false })} className="btn-primary press min-h-12 text-[16px]">存入</button>
        <button type="button" onClick={() => onChange({ mode: 'deposit', id: goal.id, withdraw: true })} disabled={p.saved <= 0} className="btn-secondary press">拿出來</button>
      </div>

      <section aria-labelledby="goal-history" className="flex flex-col gap-2">
        <h3 id="goal-history" className="caption px-1">存入紀錄</h3>
        {isPending ? <div aria-busy="true" className="skeleton h-24" /> : deposits?.length ? (
          <ul className="card py-1">
            {deposits.map((d) => (
              <li key={d.id} className="flex min-h-14 items-center gap-3 border-t border-line px-4 py-2 first:border-t-0">
                <span className="num w-12 flex-none text-body-s text-muted">{md(d.date)}</span>
                <span className="min-w-0 flex-1 truncate text-body-s">{d.note || (d.amount > 0 ? '存入' : '拿出來')}</span>
                <span className={`num flex-none text-body ${d.amount < 0 ? 'text-muted' : ''}`}>{hidden ? money(d.amount, true) : `${d.amount > 0 ? '+' : '−'}${formatMoney(d.amount)}`}</span>
                <button
                  type="button"
                  onClick={() => removeDeposit.mutate(d.id, { onSuccess: () => showToast('已刪除一筆紀錄'), onError: (e) => showToast(e.message) })}
                  disabled={removeDeposit.isPending}
                  aria-label={`刪除 ${md(d.date)} 這筆紀錄`}
                  className="icon-btn ghost press -mr-2 flex-none text-muted"
                >
                  <Trash2 size={16} strokeWidth={1.5} aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="caption px-1 leading-[1.7]">還沒有存入紀錄。按「存入」記下第一筆吧！</p>
        )}
        <p className="caption px-1 leading-[1.7]">存入只是記在這個目標裡，不會動到帳戶餘額，也不算支出。</p>
      </section>

      <div className="grid grid-cols-2 gap-2 border-t border-line pt-4">
        <button type="button" onClick={togglePin} disabled={pin.isPending} aria-pressed={goal.pinned} className="btn-secondary press">
          {goal.pinned ? <><PinOff size={16} strokeWidth={1.5} aria-hidden />取消釘選</> : <><Pin size={16} strokeWidth={1.5} aria-hidden />釘在首頁</>}
        </button>
        <button type="button" onClick={() => onChange({ mode: 'edit', id: goal.id })} className="btn-secondary press">編輯目標</button>
      </div>
    </>
  );
}

const QUICK = [500, 1000, 3000, 5000];

function DepositForm({ goal, withdraw, onDone, onClose }: { goal: SavingsGoal; withdraw: boolean; onDone: () => void; onClose: () => void }) {
  const add = useAddDeposit();
  const showToast = useUi((s) => s.showToast);
  const today = toISODate(new Date());
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(today);
  const [error, setError] = useState('');
  const p = progress(goal);
  const value = parseAmount(amount);

  const submit = async () => {
    const err = depositError(value, withdraw, p.saved);
    if (err) return setError(err);
    try {
      await add.mutateAsync({ goalId: goal.id, amount: withdraw ? -value : value, date, note: note.trim() || null });
      const after = progress({ target: goal.target, saved: p.saved + (withdraw ? -value : value) });
      showToast(withdraw ? `拿出 ${formatMoney(value)}，「${goal.name}」還差 ${formatMoney(after.remaining)}`
        : after.achieved && !p.achieved ? `存到了！「${goal.name}」達成目標`
          : `存入 ${formatMoney(value)}，${after.achieved ? '目標已經達成' : `還差 ${formatMoney(after.remaining)}`}`);
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : '儲存失敗，請再試一次');
    }
  };

  return (
    <>
      <SheetHeader id="goal-sheet-title" title={withdraw ? `從「${goal.name}」拿出來` : `存入「${goal.name}」`} en={withdraw ? 'Withdraw' : 'Deposit'} onBack={onDone} onClose={onClose} />
      <Field label="金額" htmlFor="deposit-amount">
        <div className="field-input flex items-center gap-1 px-3.5">
          <span aria-hidden className="num text-muted">$</span>
          <input id="deposit-amount" data-autofocus inputMode="numeric" value={amount} onChange={(e) => { setAmount(e.target.value.replace(/\D/g, '').slice(0, 8)); setError(''); }} placeholder="0" autoComplete="off" className="num min-w-0 flex-1 bg-transparent text-[16px] outline-none" />
        </div>
        {!withdraw && <Pills items={QUICK.map((q) => ({ id: String(q), label: formatMoney(q) }))} value={amount} onPick={(v) => { setAmount(v); setError(''); }} label="常用金額" />}
        {withdraw && <p className="caption px-1">目前存了 {formatMoney(p.saved)}</p>}
      </Field>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
        <label htmlFor="deposit-note" className="sr-only">備註</label>
        <input id="deposit-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={60} placeholder={withdraw ? '拿去做什麼（選填）' : '備註（選填），例如：薪水先存'} autoComplete="off" className="field-input" />
        <label htmlFor="deposit-date" className="sr-only">日期</label>
        <input id="deposit-date" type="date" value={date} max={today} onChange={(e) => setDate(e.target.value || today)} className="field-input w-[150px] px-3" />
      </div>
      {error && <p role="alert" className="-my-2 text-caption text-alert">{error}</p>}
      <button type="button" onClick={submit} disabled={add.isPending} className="btn-primary press w-full">
        {add.isPending ? '儲存中…' : `${withdraw ? '拿出' : '存入'}${value ? ` ${formatMoney(value)}` : ''}`}
      </button>
    </>
  );
}

// ---------- 首頁小卡 ----------

/** 首頁：豬撲滿陪你存。顯示釘選的目標，沒有就是最近到期的；沒有目標時提示新增 */
export function GoalCard({ today }: { today: string }) {
  const hidden = useHidden();
  const { data: goals, isPending, isError } = useGoals();
  const [sheet, setSheet] = useState<SheetState | null>(null);
  // 讀不到（例如資料庫還沒更新）就不顯示，不影響首頁其他東西
  if (isPending || isError || !goals) return null;
  const goal = homeGoal(goals);

  const header = (
    <SectionHeader
      id="goal-title"
      title="存錢目標"
      en="Savings"
      action={goals.some((g) => !g.archived) ? <Link href="/assets#goals" className={MORE}>全部<ArrowRight size={16} strokeWidth={1.5} aria-hidden /></Link> : undefined}
    />
  );

  if (!goal) {
    return (
      <section aria-labelledby="goal-title" className="flex flex-col gap-2.5">
        {header}
        <div className="card flex items-center gap-3.5 px-5 py-4">
          <Mascot kind="piggy" className="w-14 flex-none" />
          <p className="min-w-0 flex-1 text-body-s leading-[1.7]">想存一筆錢嗎？設一個目標，豬撲滿陪你存。</p>
          <button type="button" onClick={() => setSheet({ mode: 'new' })} aria-haspopup="dialog" className="btn-secondary press flex-none">新增目標</button>
        </div>
        <GoalSheets state={sheet} onChange={setSheet} />
      </section>
    );
  }

  const p = progress(goal);
  const due = deadlineText(goal.deadline, today);
  return (
    <section aria-labelledby="goal-title" className="flex flex-col gap-2.5">
      {header}
      <div className="card flex items-center gap-4 p-5">
        <Mascot kind="piggy" mood={p.achieved ? 'yay' : 'ok'} className="w-[76px] flex-none" />
        <div className="flex min-w-0 flex-1 flex-col gap-2.5">
          <button type="button" onClick={() => setSheet({ mode: 'detail', id: goal.id })} aria-haspopup="dialog" className="press flex min-w-0 flex-col gap-1 text-left">
            <span className="flex min-w-0 items-center gap-2"><GoalIcon goal={goal} small /><span className="truncate text-body">{goal.name}</span></span>
            <span className="flex flex-wrap items-baseline gap-x-1.5"><span className="num text-body">{money(p.saved, hidden)}</span><span className="num text-caption text-muted">/ {money(goal.target, hidden)}</span></span>
          </button>
          <Bar ratio={p.ratio} achieved={p.achieved} />
          <div className="flex items-center justify-between gap-2">
            <span className="caption leading-[1.6]">{p.achieved ? '存到了！' : `還差 ${money(p.remaining, hidden)}`}{due ? `・${due}` : ''}</span>
            <button type="button" onClick={() => setSheet({ mode: 'deposit', id: goal.id, withdraw: false })} aria-haspopup="dialog" className="btn-secondary press flex-none">存入</button>
          </div>
        </div>
      </div>
      <GoalSheets state={sheet} onChange={setSheet} />
    </section>
  );
}

// ---------- 資產頁 ----------

/** 資產頁：全部的存錢目標、新增、收起來的 */
export function GoalsSection() {
  const hidden = useHidden();
  const { data: goals = [], isPending } = useGoals();
  const [sheet, setSheet] = useState<SheetState | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const list = sortGoals(goals);
  const archived = goals.filter((g) => g.archived);
  const total = list.reduce((n, g) => n + progress(g).saved, 0);

  const row = (g: SavingsGoal) => {
    const p = progress(g);
    return (
      <li key={g.id} className="border-t border-line first:border-t-0">
        <button type="button" onClick={() => setSheet({ mode: 'detail', id: g.id })} aria-haspopup="dialog" className="row press">
          <GoalIcon goal={g} />
          <span className="flex min-w-0 flex-1 flex-col gap-1.5">
            <span className="flex items-baseline justify-between gap-2">
              <span className="truncate text-body">{g.name}{g.pinned && <Pin size={12} strokeWidth={2} aria-label="釘在首頁" className="ml-1.5 inline align-[-1px] text-muted" />}</span>
              <span className="num flex-none text-body-s">{money(p.saved, hidden)}<span className="text-muted"> / {money(g.target, hidden)}</span></span>
            </span>
            <Bar ratio={p.ratio} achieved={p.achieved} />
            <span className="caption">{p.achieved ? '存到了！' : `還差 ${money(p.remaining, hidden)}`}{g.deadline ? `・${deadlineText(g.deadline, toISODate(new Date()))}` : ''}</span>
          </span>
        </button>
      </li>
    );
  };

  return (
    <section id="goals" aria-labelledby="g-goals" className="flex scroll-mt-4 flex-col gap-2">
      <h2 id="g-goals" className="flex items-baseline justify-between px-1 text-body-s font-normal tracking-[.1em] text-muted">
        <span>存錢目標</span>{list.length > 0 && <span className="num">已存 {money(total, hidden)}</span>}
      </h2>
      {isPending ? <div aria-busy="true" className="skeleton h-28" /> : list.length > 0 && <ul className="card py-1">{list.map(row)}</ul>}
      <button type="button" onClick={() => setSheet({ mode: 'new' })} aria-haspopup="dialog" className="press flex min-h-[52px] items-center justify-center gap-2 rounded-lg border border-dashed border-dash text-body-s tracking-[.08em]">
        <Plus size={18} strokeWidth={1.5} aria-hidden />新增存錢目標
      </button>
      {archived.length > 0 && (
        <>
          <button type="button" onClick={() => setShowArchived(!showArchived)} aria-expanded={showArchived} className="press min-h-11 self-start px-1 text-body-s text-muted underline underline-offset-4">
            {showArchived ? '隱藏收起來的目標' : `收起來的目標（${archived.length}）`}
          </button>
          {showArchived && <ul className="card py-1 opacity-80">{archived.map(row)}</ul>}
        </>
      )}
      <GoalSheets state={sheet} onChange={setSheet} />
    </section>
  );
}
