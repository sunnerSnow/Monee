'use client';

import { Info, Trash2, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { getCategory } from '@/lib/categories';
import { CURRENCIES, formatForeign } from '@/lib/currency';
import {
  useAccounts, useCreateSplitGroup, useDeleteSplitExpense, useDeleteSplitGroup, useReopenRound, useSettle, useSplitGroups, useUpdateSplitGroup,
} from '@/lib/data';
import { toISODate, toTime } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { initialOf, meOf, memberInvolved, memberName, modeText, myShare } from '@/lib/split';
import type { SplitGroup, SplitKind } from '@/lib/types';
import { useUi } from '@/lib/ui-store';
import { Sheet, SheetHeader } from '../Sheet';
import { EmptyBox } from '../ui';
import { EffectBox, Field, MemberAvatar, Pills, effectLines, memberLabel, payableAccounts, receivingAccounts, shortDate } from './parts';
import { RangeCalendar } from './RangeCalendar';
import { InboxSheet, ShareSheet } from './ShareSheets';
import { SplitExpenseForm } from './SplitExpenseForm';

const TITLE_ID = 'split-sheet-title';
const KINDS: { id: SplitKind; label: string }[] = [
  { id: 'daily', label: '日常（室友、午餐團）' },
  { id: 'event', label: '活動（出遊一天）' },
  { id: 'trip', label: '旅程（有日期、外幣）' },
];
const plusDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + n);
  return toISODate(d);
};

/** 分帳的所有底部面板：新增／編輯花費、花費明細、還款、群組設定、結清紀錄 */
export function SplitSheets() {
  const sheet = useUi((s) => s.sheet);
  const close = useUi((s) => s.closeSheet);
  const open = Boolean(sheet?.kind.startsWith('split'));
  return (
    <Sheet open={open} onClose={close} labelledBy={TITLE_ID}>
      {open && <SplitSheetBody key={JSON.stringify(sheet)} />}
    </Sheet>
  );
}

function SplitSheetBody() {
  const sheet = useUi((s) => s.sheet)!;
  const close = useUi((s) => s.closeSheet);
  const { data: groups, isPending } = useSplitGroups();

  if (sheet.kind === 'splitGroup') return <GroupForm groupId={sheet.groupId} initialKind={sheet.groupKind} />;
  if (isPending) return <div aria-busy="true" className="skeleton h-48" />;
  if (sheet.kind === 'splitInbox') return <InboxSheet groups={groups ?? []} groupId={sheet.groupId} />;
  const g = 'groupId' in sheet ? groups?.find((x) => x.id === sheet.groupId) : undefined;
  if (!g) {
    return (
      <>
        <SheetHeader id={TITLE_ID} title="找不到這個群組" en="Missing" onClose={close} />
        <EmptyBox title="可能已經刪除">回到分帳頁重新選一個群組。</EmptyBox>
      </>
    );
  }
  switch (sheet.kind) {
    case 'splitExpense': return <ExpenseSheet g={g} expenseId={sheet.expenseId} />;
    case 'splitDetail': return <DetailSheet g={g} expenseId={sheet.expenseId} />;
    case 'splitSettle': return <SettleSheet g={g} fromId={sheet.fromId} toId={sheet.toId} amount={sheet.amount} />;
    case 'splitRound': return <RoundSheet g={g} roundId={sheet.roundId} />;
    case 'splitShare': return <ShareSheet g={g} />;
    default: return null;
  }
}

function ExpenseSheet({ g, expenseId }: { g: SplitGroup; expenseId?: string }) {
  const close = useUi((s) => s.closeSheet);
  const showToast = useUi((s) => s.showToast);
  const editing = expenseId ? g.expenses.find((e) => e.id === expenseId) : undefined;
  return (
    <>
      <SheetHeader id={TITLE_ID} title={editing ? '編輯花費' : '新增花費'} en={editing ? 'Edit' : 'New'} sub={`${g.name}・${g.members.length} 人`} onClose={close} />
      <SplitExpenseForm group={g} editing={editing} onSaved={(msg, again) => { showToast(msg); if (!again) close(); }} />
    </>
  );
}

function DetailSheet({ g, expenseId }: { g: SplitGroup; expenseId: string }) {
  const close = useUi((s) => s.closeSheet);
  const openSheet = useUi((s) => s.openSheet);
  const showToast = useUi((s) => s.showToast);
  const { data: accounts = [] } = useAccounts();
  const remove = useDeleteSplitExpense();
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState('');
  const e = g.expenses.find((x) => x.id === expenseId);
  if (!e) return <><SheetHeader id={TITLE_ID} title="找不到這筆花費" en="Missing" onClose={close} /><EmptyBox title="可能已經刪除">回到群組看看。</EmptyBox></>;

  const me = meOf(g)!;
  const mine = myShare(g, e);
  const Icon = getCategory(e.categoryId).icon;
  const payerAcct = e.payerId === me.id ? accounts.find((a) => a.id === e.accountId)?.name : null;

  const destroy = async () => {
    try {
      await remove.mutateAsync(e.id);
      close();
      showToast(`已刪除：${e.title}，結算重新計算了`);
    } catch (err) {
      setConfirm(false);
      setError(err instanceof Error ? err.message : '刪除失敗，請再試一次');
    }
  };

  return (
    <>
      <SheetHeader id={TITLE_ID} title={e.title} en="Expense" sub={`${shortDate(e.date)}${e.time ? ` ${e.time}` : ''}・${g.name}`} onClose={close} />
      {e.roundId && <p className="caption -mt-2 flex items-center gap-1.5"><Info size={14} strokeWidth={1.5} aria-hidden />這筆已經結清，只能查看。</p>}
      <div className="flex items-baseline justify-between gap-3 rounded-sm bg-fill px-4 py-3.5">
        <span className="caption">{memberName(g, e.payerId)}付{payerAcct ? `（${payerAcct}）` : ''}</span>
        <span className="flex flex-col items-end">
          <span className="num text-[18px] font-light">{e.currency !== 'TWD' && e.originalAmount ? formatForeign(e.originalAmount, e.currency) : formatMoney(e.amount)}</span>
          {e.currency !== 'TWD' && e.fxRate && <span className="num text-caption text-muted">≈ {formatMoney(e.amount)}・匯率 {e.fxRate}</span>}
        </span>
      </div>
      <Field label={modeText(e)}>
        <ul className="card py-1">
          {g.members.filter((m) => (e.amounts[m.id] ?? 0) > 0 || m.id === e.payerId).map((m) => (
            <li key={m.id} className="flex min-h-14 items-center gap-3 border-t border-line px-4 py-1.5 first:border-t-0">
              <MemberAvatar member={m} />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-body">{memberLabel(m)}{m.id === e.payerId && <span className="ml-1.5 rounded-full bg-fill px-2 py-px text-[11px] text-muted">付款</span>}</span>
                {e.mode === 'shares' && <span className="num text-caption text-muted">{e.weights[m.id] ?? 0} 份</span>}
              </span>
              <span className="num flex-none text-body">{e.amounts[m.id] ? formatMoney(e.amounts[m.id]) : '不分'}</span>
            </li>
          ))}
        </ul>
      </Field>
      <EffectBox lines={effectLines(g, e, accounts)} />
      {mine > 0 && (
        <Field label="在你的明細會顯示成">
          <div className="card py-1">
            <div className="row">
              <span aria-hidden className="ico"><Icon size={20} strokeWidth={1.5} /></span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-body">{e.title}</span>
                <span className="truncate text-caption tracking-[.06em] text-muted">分帳・{g.name}・{e.payerId === me.id ? `實付 ${formatMoney(e.amount)}` : `${memberName(g, e.payerId)}先付`}</span>
              </span>
              <span className="num flex-none text-body">−{formatMoney(mine)}</span>
            </div>
          </div>
        </Field>
      )}
      {error && <p role="alert" className="-my-2 text-caption text-alert">{error}</p>}
      {!e.roundId && (confirm ? (
        <div role="alertdialog" aria-labelledby="split-del-q" className="flex flex-col gap-3 rounded-sm bg-alert-tint p-4">
          <p id="split-del-q" className="text-body-s text-alert">確定刪除「{e.title}」？每個人的結算會重新計算，你帳上的對應交易也會一起刪除。</p>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setConfirm(false)} className="btn-secondary press" autoFocus>取消</button>
            <button type="button" onClick={destroy} disabled={remove.isPending} className="btn-secondary press border-alert text-alert">{remove.isPending ? '刪除中…' : '刪除'}</button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => setConfirm(true)} className="btn-secondary press min-h-[52px] text-alert"><Trash2 size={16} strokeWidth={1.5} aria-hidden />刪除</button>
          <button type="button" onClick={() => openSheet({ kind: 'splitExpense', groupId: g.id, expenseId: e.id })} className="btn-primary press">編輯</button>
        </div>
      ))}
    </>
  );
}

function SettleSheet({ g, fromId, toId, amount: suggested }: { g: SplitGroup; fromId: string; toId: string; amount: number }) {
  const close = useUi((s) => s.closeSheet);
  const showToast = useUi((s) => s.showToast);
  const { data: accounts = [] } = useAccounts();
  const settle = useSettle();
  const me = meOf(g)!;
  const receiving = toId === me.id;
  const paying = fromId === me.id;
  const choices = receiving ? receivingAccounts(accounts) : paying ? payableAccounts(accounts) : [];
  const [amount, setAmount] = useState(String(suggested));
  const [accountId, setAccountId] = useState(choices.find((a) => a.type === 'BANK')?.id ?? choices[0]?.id ?? '');
  const [error, setError] = useState('');
  const value = parseInt(amount || '0', 10) || 0;
  const acctName = accounts.find((a) => a.id === accountId)?.name ?? '';
  const from = memberName(g, fromId);
  const to = memberName(g, toId);
  const title = receiving ? `${from} 還你錢` : paying ? `你還 ${to} 錢` : `${from} 還 ${to} 錢`;

  const submit = async () => {
    if (!value) return setError('請輸入金額');
    if ((receiving || paying) && !accountId) return setError('請先新增帳戶');
    const now = new Date();
    try {
      const closed = await settle.mutateAsync({
        groupId: g.id, fromId, toId, amount: value, accountId: receiving || paying ? accountId : null, date: toISODate(now), time: toTime(now),
      });
      close();
      showToast(closed ? `都結清了！「${g.name}」的花費收進已結清的紀錄` : receiving ? `已記錄：${from}還你 ${formatMoney(value)}` : paying ? `已記錄：你還 ${to} ${formatMoney(value)}` : `已標記：${from}付給${to} ${formatMoney(value)}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : '儲存失敗，請再試一次');
    }
  };

  return (
    <>
      <SheetHeader id={TITLE_ID} title={title} en="Settle" sub="可以只還一部分，剩下的會留在結算裡" onClose={close} />
      <Field label="金額" htmlFor="settle-amount">
        <div className="flex items-baseline gap-1.5 border-b border-fg px-0.5 pb-2 focus-within:border-b-2 focus-within:pb-[7px]">
          <span className="display text-[22px]">$</span>
          <input id="settle-amount" data-autofocus inputMode="numeric" value={amount} onChange={(e) => { setAmount(e.target.value.replace(/\D/g, '').slice(0, 8)); setError(''); }} autoComplete="off" className="display min-w-0 flex-1 bg-transparent text-[36px] outline-none" />
        </div>
      </Field>
      {(receiving || paying) && (
        <Field label={receiving ? '存進哪個帳戶' : '從哪個帳戶付'}>
          {choices.length
            ? <Pills items={choices.map((a) => ({ id: a.id, label: a.name }))} value={accountId} onPick={setAccountId} label="帳戶" wrap />
            : <p className="text-body-s text-muted">還沒有{receiving ? '現金或銀行' : ''}帳戶，請先到資產頁新增。</p>}
        </Field>
      )}
      <EffectBox lines={[
        receiving ? `記成一筆轉帳：朋友往來 → ${acctName}，不算收入也不算支出。`
          : paying ? `記成一筆轉帳：${acctName} → 朋友往來，不算支出。`
            : '朋友之間的還款，不影響你的帳。',
      ]} />
      {error && <p role="alert" className="-my-2 text-caption text-alert">{error}</p>}
      <button type="button" onClick={submit} disabled={!value || settle.isPending} className="btn-primary press w-full">{settle.isPending ? '儲存中…' : '確認'}</button>
    </>
  );
}

function RoundSheet({ g, roundId }: { g: SplitGroup; roundId: string }) {
  const close = useUi((s) => s.closeSheet);
  const showToast = useUi((s) => s.showToast);
  const reopen = useReopenRound();
  const { data: accounts = [] } = useAccounts();
  const [error, setError] = useState('');
  const round = g.rounds.find((r) => r.id === roundId);
  if (!round) return <><SheetHeader id={TITLE_ID} title="找不到這次結算" en="Missing" onClose={close} /><EmptyBox title="可能已經重新打開">回到群組看看。</EmptyBox></>;
  const expenses = g.expenses.filter((e) => e.roundId === roundId);
  const settlements = g.settlements.filter((s) => s.roundId === roundId);
  const total = expenses.reduce((s, e) => s + e.amount, 0);
  const mine = expenses.reduce((s, e) => s + myShare(g, e), 0);

  const doReopen = async () => {
    try {
      await reopen.mutateAsync(roundId);
      close();
      showToast(`已重新打開，這 ${expenses.length} 筆回到花費列表`);
    } catch (e) {
      setError(e instanceof Error ? e.message : '操作失敗，請再試一次');
    }
  };

  return (
    <>
      <SheetHeader id={TITLE_ID} title={`${shortDate(round.closedAt)} 結清`} en="Settled" sub={`${g.name}・${expenses.length} 筆・總花費 ${formatMoney(total)}`} onClose={close} />
      <div className="flex items-baseline justify-between gap-3 rounded-sm bg-fill px-4 py-3.5">
        <span className="caption">你這次的支出</span><span className="num text-[18px] font-light">{formatMoney(mine)}</span>
      </div>
      <Field label="花費">
        <ul className="card py-1">
          {expenses.map((e) => {
            const Icon = getCategory(e.categoryId).icon;
            const share = myShare(g, e);
            return (
              <li key={e.id} className="row">
                <span aria-hidden className="ico"><Icon size={20} strokeWidth={1.5} /></span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-body">{e.title}</span>
                  <span className="truncate text-caption tracking-[.06em] text-muted">{shortDate(e.date)}・{memberName(g, e.payerId)}付 {formatMoney(e.amount)}・{modeText(e)}</span>
                </span>
                <span className="flex flex-none flex-col items-end gap-0.5">
                  {share ? <><span className="num text-body">{formatMoney(share)}</span><span className="caption">你的部分</span></> : <span className="caption">沒參與</span>}
                </span>
              </li>
            );
          })}
        </ul>
      </Field>
      {settlements.length > 0 && (
        <Field label="還款">
          <ul className="flex flex-col gap-2">
            {settlements.map((s) => (
              <li key={s.id} className="flex items-center gap-2.5 rounded-md border border-dashed border-line px-4 py-3 text-body-s text-muted">
                <span className="flex-1">{memberName(g, s.fromId)} → {memberName(g, s.toId)}・{shortDate(s.date)}{s.accountId ? `・${accounts.find((a) => a.id === s.accountId)?.name ?? ''}` : ''}</span>
                <span className="num text-body text-fg">{formatMoney(s.amount)}</span>
              </li>
            ))}
          </ul>
        </Field>
      )}
      <p className="flex items-start gap-2 px-1 text-caption leading-[1.7] text-muted"><Info size={16} strokeWidth={1.5} aria-hidden className="mt-0.5 flex-none" />結算記錯了才需要重新打開，這些花費和還款會回到目前的帳。</p>
      {error && <p role="alert" className="-my-2 text-caption text-alert">{error}</p>}
      <button type="button" onClick={doReopen} disabled={reopen.isPending} className="btn-secondary press w-full">重新打開這次結算</button>
    </>
  );
}

/** 建立群組（沒有 groupId）或群組設定 */
function GroupForm({ groupId, initialKind }: { groupId?: string; initialKind?: SplitKind }) {
  const router = useRouter();
  const close = useUi((s) => s.closeSheet);
  const showToast = useUi((s) => s.showToast);
  const { data: groups } = useSplitGroups();
  const create = useCreateSplitGroup();
  const update = useUpdateSplitGroup();
  const remove = useDeleteSplitGroup();
  const g = groupId ? groups?.find((x) => x.id === groupId) : undefined;
  const [name, setName] = useState(g?.name ?? '');
  const [kind, setKind] = useState<SplitKind>(g?.kind ?? initialKind ?? 'daily');
  // 旅程：預設今天出發、五天四夜、日本
  const [startDate, setStartDate] = useState(g?.startDate ?? toISODate(new Date()));
  const [endDate, setEndDate] = useState<string | null>(g?.endDate ?? plusDays(toISODate(new Date()), 4));
  const [currency, setCurrency] = useState(g?.kind === 'trip' ? g.currency : 'JPY');
  const [budget, setBudget] = useState(g?.budget ? String(g.budget) : '');
  const [exclude, setExclude] = useState(g ? g.excludeFromBudget : true);
  const trip = kind === 'trip';
  const [rows, setRows] = useState(() => (g ? g.members.filter((m) => !m.isMe).map((m) => ({ id: m.id as string | null, name: m.name, locked: memberInvolved(g, m.id) })) : []));
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (groupId && !g) return <><SheetHeader id={TITLE_ID} title="找不到這個群組" en="Missing" onClose={close} /><EmptyBox title="可能已經刪除">回到分帳頁看看。</EmptyBox></>;

  const add = () => {
    const n = draft.trim().slice(0, 12);
    if (!n) return;
    if (n === '我' || rows.some((r) => r.name.trim() === n)) return setError('已經有這個名字了');
    setRows([...rows, { id: null, name: n, locked: false }]);
    setDraft('');
    setError('');
  };

  const save = async () => {
    const names = rows.map((r) => r.name.trim());
    const problem = !name.trim() ? (trip ? '旅程名稱不能空白' : '群組名稱不能空白')
      : trip && (!startDate || !endDate) ? '請在月曆上點回來的日期'
        : trip && endDate! < startDate ? '回來的日期不能早於出發日期'
          : !names.length && !trip ? '至少要有一位朋友'
        : names.some((n) => !n) ? '成員名字不能空白'
          : names.includes('我') || new Set(names).size !== names.length ? '成員名字重複了' : '';
    if (problem) return setError(problem);
    const input = {
      name: name.trim(), kind, startDate: trip ? startDate : null, endDate: trip ? endDate : null, currency: trip ? currency : 'TWD',
      budget: trip && parseInt(budget, 10) > 0 ? parseInt(budget, 10) : null, excludeFromBudget: trip && exclude,
    };
    try {
      if (g) {
        await update.mutateAsync({ ...input, groupId: g.id, members: rows.map((r) => ({ id: r.id, name: r.name.trim() })) });
        close();
        showToast('已儲存群組設定');
      } else {
        const id = await create.mutateAsync({ ...input, members: names });
        close();
        router.push(`/split/${id}`);
        showToast(`已建立「${name.trim()}」，可以開始記花費了`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '儲存失敗，請再試一次');
    }
  };

  const destroy = async () => {
    if (!g) return;
    try {
      await remove.mutateAsync(g.id);
      close();
      router.push('/split');
      showToast(`已刪除「${g.name}」`);
    } catch (e) {
      setConfirmDelete(false);
      setError(e instanceof Error ? e.message : '刪除失敗，請再試一次');
    }
  };

  const busy = create.isPending || update.isPending || remove.isPending;
  return (
    <>
      <SheetHeader
        id={TITLE_ID}
        title={g ? (trip ? '旅程設定' : '群組設定') : trip ? '建立旅程' : '建立群組'}
        en={g ? 'Settings' : trip ? 'New trip' : 'New group'}
        sub={g ? g.name : trip ? '有日期和外幣，一個人或跟朋友都可以' : '室友、午餐團、一起出遊的朋友都可以'}
        onClose={close}
      />
      <Field label={trip ? '旅程名稱' : '群組名稱'} htmlFor="group-name">
        <input id="group-name" data-autofocus value={name} onChange={(e) => { setName(e.target.value); setError(''); }} maxLength={30} placeholder={trip ? '例如：東京五日遊' : '例如：墾丁三天兩夜'} autoComplete="off" className="field-input" />
      </Field>
      <Field label="類型">
        <Pills items={KINDS} value={kind} onPick={setKind} label="類型" wrap />
      </Field>
      {trip && (
        <>
          <Field label="旅程日期">
            <RangeCalendar start={startDate} end={endDate} onChange={(s, e) => { setStartDate(s); setEndDate(e); setError(''); }} />
          </Field>
          <Field label="目的地與幣別" htmlFor="trip-currency">
            <select id="trip-currency" value={currency} onChange={(e) => setCurrency(e.target.value)} className="field-input appearance-none">
              {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.place}・{c.name} {c.code}</option>)}
            </select>
          </Field>
          <Field label="旅程預算（台幣，可不填）" htmlFor="trip-budget">
            <div className="flex items-baseline gap-1.5 rounded-full border border-line bg-surface px-4">
              <span className="num text-muted">$</span>
              <input id="trip-budget" inputMode="numeric" value={budget} onChange={(e) => setBudget(e.target.value.replace(/\D/g, '').slice(0, 8))} placeholder="例如 30000" autoComplete="off" className="num h-12 min-w-0 flex-1 bg-transparent text-[16px] outline-none" />
            </div>
          </Field>
          <div className="flex min-h-14 items-center justify-between gap-3 rounded-lg border border-line bg-surface px-4 py-2">
            <span className="flex flex-col gap-0.5">
              <span className="text-body">不算進每月預算</span>
              <span className="caption leading-[1.7]">旅程花費另外看旅程預算，首頁的今日額度不受影響；報表的總支出照樣會算</span>
            </span>
            <button type="button" role="switch" aria-checked={exclude} aria-label="不算進每月預算" onClick={() => setExclude(!exclude)} className="switch" />
          </div>
        </>
      )}
      <Field label={trip ? '一起去的朋友（一個人旅行就不用加）' : '成員（只要名字，不用帳號）'}>
        <ul className="card py-1">
          <li className="flex min-h-14 items-center gap-3 px-4 py-1.5">
            <span aria-hidden className="av me">我</span>
            <span className="flex flex-col"><span className="text-body">我</span><span className="caption">你自己</span></span>
          </li>
          {rows.map((r, i) => (
            <li key={r.id ?? `new-${i}`} className="flex min-h-14 items-center gap-3 border-t border-line px-4 py-1.5">
              <span aria-hidden className="av">{initialOf(r.name || '?')}</span>
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <label className="sr-only" htmlFor={`member-${i}`}>成員名字</label>
                <input
                  id={`member-${i}`}
                  value={r.name}
                  onChange={(e) => { setRows(rows.map((x, j) => (j === i ? { ...x, name: e.target.value.slice(0, 12) } : x))); setError(''); }}
                  autoComplete="off"
                  className="h-10 w-full rounded-xs border border-line bg-page px-3 text-[16px]"
                />
                {r.locked && <span className="caption">有花費紀錄，只能改名</span>}
              </span>
              <button type="button" onClick={() => setRows(rows.filter((_, j) => j !== i))} disabled={r.locked} aria-label={`移除${r.name}`} className="icon-btn ghost press">
                <X size={18} strokeWidth={1.5} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
          <label className="sr-only" htmlFor="member-new">朋友的名字</label>
          <input id="member-new" value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') add(); }} maxLength={12} placeholder="朋友的名字" autoComplete="off" className="field-input" />
          <button type="button" onClick={add} className="btn-secondary press">加入</button>
        </div>
        {g && <p className="caption leading-[1.8]">改名字會同步更新所有花費。中途加入的人不會被算進之前的花費。</p>}
      </Field>
      {error && <p role="alert" className="-my-2 text-caption text-alert">{error}</p>}
      <button type="button" onClick={save} disabled={busy} className="btn-primary press w-full">{busy ? '儲存中…' : g ? '儲存' : '建立'}</button>
      {g && (
        <section aria-labelledby="group-danger" className="flex flex-col gap-2 border-t border-line pt-4">
          <h3 id="group-danger" className="caption">管理</h3>
          {confirmDelete ? (
            <div role="alertdialog" aria-labelledby="group-del-q" className="flex flex-col gap-3 rounded-sm bg-alert-tint p-4">
              <p id="group-del-q" className="text-body-s text-alert">確定刪除「{g.name}」？</p>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setConfirmDelete(false)} className="btn-secondary press" autoFocus>取消</button>
                <button type="button" onClick={destroy} disabled={busy} className="btn-secondary press border-alert text-alert">刪除</button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setConfirmDelete(true)} disabled={g.expenses.length > 0} className="btn-secondary press w-full text-alert">刪除群組</button>
          )}
          <p className="caption px-1 leading-[1.8]">{g.expenses.length ? '有花費紀錄的群組不能刪除（會影響你的帳）。全部結清後會自動收到「已結清」，不會佔列表。' : '還沒有任何花費，可以直接刪除。'}</p>
        </section>
      )}
    </>
  );
}
