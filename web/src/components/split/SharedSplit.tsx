'use client';

import { Check, Copy, Info, Plus } from 'lucide-react';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { getCategory } from '@/lib/categories';
import { copyText } from '@/lib/clipboard';
import { formatForeign } from '@/lib/currency';
import { usePublicClaim, usePublicRemove, usePublicSplit } from '@/lib/data';
import { formatMoney } from '@/lib/money';
import {
  balances, initialOf, involves, modeText, openExpenses, originalShareOf, publicAsGroup, suggestTransfers, waitingProposals, type Transfer,
} from '@/lib/split';
import type { PublicSplit, SplitGroup, SplitMember } from '@/lib/types';
import { FriendExpenseForm } from './FriendExpenseForm';
import { kindLabel, shortDate } from './parts';

const whoKey = (token: string) => `monee-share-${token}`;

/**
 * 朋友點分享連結看到的頁面：不用登入，選「我是誰」之後看要付誰多少，付完按「我已付款」。
 * 這支手機會記住選了誰（localStorage），下次打開直接顯示。
 */
export function SharedSplit({ token }: { token: string }) {
  const q = usePublicSplit(token);
  // 伺服器上沒有 localStorage；資料載入前兩邊都只顯示骨架，不會對不上
  const [who, setWho] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      return localStorage.getItem(whoKey(token));
    } catch {
      return null; // 無痕模式讀不到，就每次重選
    }
  });

  const pick = (id: string | null) => {
    setWho(id);
    try {
      if (id) localStorage.setItem(whoKey(token), id);
      else localStorage.removeItem(whoKey(token));
    } catch {
      // 存不了也沒關係，只是下次要重選
    }
  };

  if (q.isPending) return <div aria-busy="true" aria-label="載入中" className="flex flex-col gap-5"><div className="skeleton h-24" /><div className="skeleton h-56" /></div>;
  if (q.error) {
    return (
      <div role="alert" className="empty-box">
        <p className="text-body font-medium">載入失敗</p>
        <p className="text-body-s leading-[1.8] text-muted">{q.error.message}</p>
        <button type="button" onClick={() => q.refetch()} className="btn-secondary press mt-2 self-start">再試一次</button>
      </div>
    );
  }
  if (!q.data) {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <Image src="/monee.png" alt="" width={124} height={90} className="h-auto w-[124px]" />
        <h1 className="text-title-m font-medium tracking-[.14em]">連結已失效</h1>
        <p className="text-body-s leading-[1.8] text-muted">分享的人可能重設或停止了分享，請跟對方要新的連結。</p>
      </div>
    );
  }

  const view = q.data;
  const friend = view.members.find((m) => m.id === who && !m.isMe);
  return friend
    ? <FriendView view={view} token={token} me={friend} onSwitch={() => pick(null)} />
    : <PickWho view={view} onPick={pick} />;
}

function Footer() {
  return (
    <p className="flex items-center justify-center gap-2 pt-2 text-caption tracking-[.06em] text-muted">
      <Image src="/monee.png" alt="" width={28} height={20} className="h-auto w-7" />Monee 分帳・只看得到這個群組
    </p>
  );
}

function Header({ view, children }: { view: PublicSplit; children?: React.ReactNode }) {
  return (
    <header className="flex flex-col gap-1.5">
      <span className="caption">{view.owner.name} 分享給你的分帳</span>
      <h1 tabIndex={-1} className="text-title-l font-medium leading-[1.35] tracking-[.14em] outline-none">{view.group.name}</h1>
      {children}
    </header>
  );
}

function PickWho({ view, onPick }: { view: PublicSplit; onPick: (id: string) => void }) {
  const open = openExpenses(publicAsGroup(view)).length;
  return (
    <>
      <Header view={view}>
        <span className="caption">{kindLabel(view.group)}・{view.members.length} 人・{open ? `未結清 ${open} 筆` : '都結清了'}</span>
      </Header>
      <section aria-labelledby="who-title" className="flex flex-col gap-3">
        <h2 id="who-title" className="h-sec">你是誰？</h2>
        <div className="grid grid-cols-2 gap-2.5">
          {view.members.filter((m) => !m.isMe).map((m) => (
            <button key={m.id} type="button" onClick={() => onPick(m.id)} className="card press flex min-h-[72px] items-center gap-3 px-3 text-body tracking-[.08em]">
              <span aria-hidden className="av h-10 w-10 text-[15px]">{initialOf(m.name)}</span>{m.name}
            </button>
          ))}
        </div>
        <p className="flex items-start gap-2 px-1 text-caption leading-[1.7] text-muted">
          <Info size={16} strokeWidth={1.5} aria-hidden className="mt-0.5 flex-none" />
          <span>不用下載 App、不用註冊。選了之後這支手機會記住你是誰。</span>
        </p>
      </section>
      <Footer />
    </>
  );
}

function FriendView({ view, token, me, onSwitch }: { view: PublicSplit; token: string; me: SplitMember; onSwitch: () => void }) {
  const g = publicAsGroup(view);
  const owner = view.members.find((m) => m.isMe)!;
  const transfers = suggestTransfers(balances(g));
  const pays = transfers.filter((t) => t.fromId === me.id);
  const gets = transfers.filter((t) => t.toId === me.id);
  const nameOf = (id: string) => (id === owner.id ? view.owner.name : id === me.id ? '你' : view.members.find((m) => m.id === id)?.name ?? '');
  const list = openExpenses(g);
  const mine = list.filter((e) => (e.amounts[me.id] ?? 0) > 0);
  const past = g.expenses.filter((e) => e.roundId);
  const rejected = view.claims.filter((c) => c.fromId === me.id && c.status === 'rejected');
  const [toast, setToast] = useState('');
  const [adding, setAdding] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const heading = useRef<HTMLDivElement>(null);

  // 選完名字、或從新增表單回來，把焦點移到標題，報讀器知道畫面換了
  useEffect(() => { if (!adding) heading.current?.querySelector('h1')?.focus(); }, [adding]);

  const notify = (msg: string) => {
    setToast(msg);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(''), 2400);
  };
  const toastBox = (
    <div role="status" aria-live="polite" className={`fixed bottom-8 left-1/2 z-30 max-w-[calc(100%-40px)] -translate-x-1/2 truncate rounded-full bg-fg px-[18px] py-2.5 text-body-s text-surface transition-opacity ${toast ? 'opacity-100' : 'pointer-events-none opacity-0'}`}>
      {toast}
    </div>
  );
  const openForm = (open: boolean) => {
    setAdding(open);
    window.scrollTo({ top: 0 });
  };

  if (adding) {
    return (
      <>
        <FriendExpenseForm g={g} token={token} me={me} ownerName={view.owner.name} onCancel={() => openForm(false)} onDone={(msg) => { openForm(false); notify(msg); }} />
        {toastBox}
      </>
    );
  }

  return (
    <>
      <div ref={heading}>
        <Header view={view}>
          <span className="caption flex items-center gap-2">嗨，{me.name}・<button type="button" onClick={onSwitch} className="press underline">不是你？</button></span>
        </Header>
      </div>

      <section aria-label="你的結算" className="relative overflow-hidden rounded-xl border border-line bg-surface px-5 py-[22px]">
        <span aria-hidden className="absolute -top-[110px] -right-[110px] h-60 w-60 rounded-full bg-brand" />
        <div className="relative flex flex-col gap-2 pr-16">
          {pays.length ? (
            <>
              <p className="text-body-s tracking-[.12em] text-muted">你要付</p>
              <p className="display m-0 text-display-l leading-[1.15]"><small>$</small>{pays.reduce((s, t) => s + t.amount, 0).toLocaleString('en-US')}</p>
              <p className="caption leading-[1.8]">{pays.map((t) => `給 ${nameOf(t.toId)} ${formatMoney(t.amount)}`).join('、')}</p>
            </>
          ) : gets.length ? (
            <>
              <p className="text-body-s tracking-[.12em] text-muted">你會收到</p>
              <p className="display m-0 text-display-l leading-[1.15]"><small>$</small>{gets.reduce((s, t) => s + t.amount, 0).toLocaleString('en-US')}</p>
              <p className="caption leading-[1.8]">{gets.map((t) => `${nameOf(t.fromId)} 會給你 ${formatMoney(t.amount)}`).join('、')}</p>
            </>
          ) : (
            <>
              <p className="text-body-s tracking-[.12em] text-muted">你的狀態</p>
              <p className="display m-0 text-display-m leading-[1.2]">已結清</p>
              <p className="caption leading-[1.8]">這個群組你不欠錢，也沒人欠你。</p>
            </>
          )}
        </div>
      </section>

      {rejected.length > 0 && (
        <p role="note" className="rounded-sm bg-warn-tint px-4 py-3 text-body-s leading-[1.8] text-warn-fg">
          {view.owner.name} 說還沒收到你付的 {rejected.map((c) => formatMoney(c.amount)).join('、')}，請再確認一下，或直接跟 {view.owner.name} 聯絡。
        </p>
      )}

      {pays.map((t) => (
        <PayCard key={t.toId} view={view} token={token} me={me} t={t} toOwner={t.toId === owner.id} toName={nameOf(t.toId)} onNotify={notify} />
      ))}

      {view.group.allowFriendAdd && (
        <button type="button" onClick={() => openForm(true)} className="press flex min-h-[52px] items-center justify-center gap-2 rounded-lg border border-dashed border-dash text-body-s tracking-[.08em]">
          <Plus size={18} strokeWidth={1.5} aria-hidden />新增一筆（誰先付的都可以記）
        </button>
      )}

      <FriendAdded g={g} token={token} me={me} ownerName={view.owner.name} nameOf={nameOf} onNotify={notify} />

      <section aria-labelledby="mine-title" className="flex flex-col gap-2.5">
        <div className="flex items-baseline justify-between px-1">
          <h2 id="mine-title" className="h-sec">你的花費</h2>
          <span className="caption num">共 {formatMoney(mine.reduce((s, e) => s + (e.amounts[me.id] ?? 0), 0))}</span>
        </div>
        {mine.length ? (
          <ul className="card py-1">
            {mine.map((e) => {
              const Icon = getCategory(e.categoryId).icon;
              return (
                <li key={e.id} className="row">
                  <span aria-hidden className="ico"><Icon size={20} strokeWidth={1.5} /></span>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-body">{e.title}</span>
                    <span className="truncate text-caption tracking-[.06em] text-muted">{shortDate(e.date)}・{nameOf(e.payerId)}付 {fullAmount(e)}・{modeText(e)}</span>
                  </span>
                  <span className="flex flex-none flex-col items-end gap-0.5">
                    <span className="num text-body">{shareAmount(e, me.id)}</span>
                    {e.currency !== 'TWD' && e.originalAmount ? <span className="num text-caption text-muted">≈ {formatMoney(e.amounts[me.id])}</span> : null}
                  </span>
                </li>
              );
            })}
          </ul>
        ) : <p className="caption px-1">{g.rounds.length ? '目前沒有未結清的花費。' : '這個群組還沒有你的花費。'}</p>}
      </section>

      {list.length > 0 && <ExpenseTable title={`看這次全部 ${list.length} 筆花費`} rows={list} nameOf={nameOf} />}
      {past.length > 0 && <ExpenseTable title={`之前已結清 ${g.rounds.length} 次・${past.length} 筆`} rows={past} nameOf={nameOf} />}

      <Footer />
      {toastBox}
    </>
  );
}

/**
 * 從分享頁記的花費：所有人送出、等分享的人確認的；你被退回的；你記的朋友之間花費（還沒結清）。
 * 你記的都可以撤回；已經確認進分享的人帳上的，只能請他改。
 */
function FriendAdded({ g, token, me, ownerName, nameOf, onNotify }: {
  g: SplitGroup;
  token: string;
  me: SplitMember;
  ownerName: string;
  nameOf: (id: string) => string;
  onNotify: (msg: string) => void;
}) {
  const remove = usePublicRemove(token);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const owner = g.members.find((m) => m.isMe)!;
  const rows = [
    ...waitingProposals(g).map((p) => ({ ...p, state: 'waiting' as const })),
    ...g.proposals.filter((p) => p.status === 'rejected' && p.addedBy === me.id).map((p) => ({ ...p, state: 'rejected' as const })),
    ...openExpenses(g).filter((e) => e.addedBy === me.id && !involves(e, owner.id)).map((e) => ({ ...e, addedBy: me.id, state: 'added' as const })),
  ];
  if (!rows.length) return null;

  const withdraw = async (id: string, title: string) => {
    setError('');
    try {
      await remove.mutateAsync({ memberId: me.id, id });
      setConfirmId(null);
      onNotify(`已撤回「${title}」`);
    } catch (e) {
      setError(e instanceof Error ? e.message : '撤回失敗，請再試一次');
    }
  };
  const status = { waiting: `等 ${ownerName} 確認`, rejected: `${ownerName} 說有問題，退回了`, added: '已記進群組' };

  return (
    <section aria-labelledby="added-title" className="flex flex-col gap-2.5">
      <h2 id="added-title" className="h-sec px-1">從這裡記的花費</h2>
      <ul className="card py-1">
        {rows.map((r) => {
          const mine = r.addedBy === me.id;
          const amountText = r.currency !== 'TWD' && r.originalAmount ? formatForeign(r.originalAmount, r.currency) : formatMoney(r.amount);
          return (
            <li key={r.id} className="flex flex-col gap-2 border-t border-line px-4 py-3 first:border-t-0">
              <div className="flex items-center gap-3">
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-body">{r.title}</span>
                  <span className="truncate text-caption tracking-[.06em] text-muted">
                    {shortDate(r.date)}・{mine ? '你' : nameOf(r.addedBy)}記的・{nameOf(r.payerId)}付 {amountText}
                  </span>
                </span>
                <span className={`flex-none rounded-full px-2 py-px text-[11px] ${r.state === 'rejected' ? 'bg-alert-tint text-alert' : r.state === 'waiting' ? 'bg-warn-tint text-warn-fg' : 'bg-fill text-muted'}`}>
                  {status[r.state]}
                </span>
              </div>
              {mine && (confirmId === r.id ? (
                <div role="alertdialog" aria-label={`撤回「${r.title}」`} className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setConfirmId(null)} className="btn-secondary press min-h-10" autoFocus>取消</button>
                  <button type="button" onClick={() => withdraw(r.id, r.title)} disabled={remove.isPending} className="btn-secondary press min-h-10 border-alert text-alert">
                    {remove.isPending ? '撤回中…' : '確定撤回'}
                  </button>
                </div>
              ) : (
                <button type="button" onClick={() => setConfirmId(r.id)} className="caption press min-h-10 self-start underline">
                  {r.state === 'rejected' ? '刪掉這筆，重新記' : '撤回'}
                </button>
              ))}
            </li>
          );
        })}
      </ul>
      {error && <p role="alert" className="px-1 text-caption text-alert">{error}</p>}
      <p className="flex items-start gap-2 px-1 text-caption leading-[1.7] text-muted">
        <Info size={16} strokeWidth={1.5} aria-hidden className="mt-0.5 flex-none" />
        <span>等確認的花費還不會算進上面的結算。{ownerName} 確認後，記錯了要請 {ownerName} 修改。</span>
      </p>
    </section>
  );
}

/** 付款卡：付給分享的人時顯示收款方式；按「我已付款」通知對方確認 */
function PayCard({ view, token, me, t, toOwner, toName, onNotify }: {
  view: PublicSplit;
  token: string;
  me: SplitMember;
  t: Transfer;
  toOwner: boolean;
  toName: string;
  onNotify: (msg: string) => void;
}) {
  const claim = usePublicClaim(token);
  const [error, setError] = useState('');
  const waiting = view.claims.find((c) => c.fromId === me.id && c.toId === t.toId && c.status === 'waiting');
  const methods = toOwner ? [['銀行轉帳', view.owner.bank], ['LINE Pay ID', view.owner.line]].filter((x): x is [string, string] => Boolean(x[1])) : [];

  const copy = async (text: string) => onNotify((await copyText(text)) ? '已複製' : '複製失敗，請長按文字複製');
  const paid = async () => {
    setError('');
    try {
      await claim.mutateAsync({ fromId: me.id, toId: t.toId, amount: t.amount });
      onNotify(`已通知 ${view.owner.name}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : '通知失敗，請再試一次');
    }
  };

  return (
    <section aria-label={`付給 ${toName}`} className="card flex flex-col gap-3 px-5 py-4">
      <h2 className="flex items-baseline justify-between gap-3 text-title-s font-medium tracking-[.14em]">
        付給 {toName}<span className="num font-light">{formatMoney(t.amount)}</span>
      </h2>
      {methods.length > 0 ? (
        <ul className="flex flex-col">
          {methods.map(([label, value]) => (
            <li key={label} className="flex min-h-[52px] items-center justify-between gap-3 border-t border-line py-1.5 first:border-t-0">
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="caption">{label}</span>
                <span className="num break-all text-[14px]">{value}</span>
              </span>
              <button type="button" onClick={() => copy(value)} className="btn-secondary press min-h-10 flex-none px-3 text-caption"><Copy size={14} strokeWidth={1.5} aria-hidden />複製</button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="caption leading-[1.8]">收款方式請直接問 {toName}。</p>
      )}
      {error && <p role="alert" className="text-caption text-alert">{error}</p>}
      {waiting ? (
        <p className="flex items-center gap-1.5 text-caption text-muted">
          <Check size={16} strokeWidth={1.5} aria-hidden />已通知 {view.owner.name}，等確認收到
        </p>
      ) : (
        <button type="button" onClick={paid} disabled={claim.isPending} className="btn-primary press w-full">
          {claim.isPending ? '通知中…' : `我已付款給 ${toName}`}
        </button>
      )}
    </section>
  );
}

/** 外幣花費顯示原幣（¥3,000），台幣照舊 */
const fullAmount = (e: { amount: number; currency: string; originalAmount: number | null }) =>
  e.currency !== 'TWD' && e.originalAmount ? formatForeign(e.originalAmount, e.currency) : formatMoney(e.amount);
/** 某個人那份的原幣金額；台幣直接顯示 */
const shareAmount = (e: Parameters<typeof originalShareOf>[0], memberId: string) => {
  const v = originalShareOf(e, memberId);
  return v === null ? formatMoney(e.amounts[memberId] ?? 0) : formatForeign(v, e.currency);
};

function ExpenseTable({ title, rows, nameOf }: {
  title: string;
  rows: { id: string; date: string; title: string; payerId: string; amount: number; currency: string; originalAmount: number | null }[];
  nameOf: (id: string) => string;
}) {
  return (
    <details className="group">
      <summary className="press inline-flex min-h-11 cursor-pointer list-none items-center gap-1.5 px-1 text-body-s tracking-[.08em] [&::-webkit-details-marker]:hidden">
        {title}<span aria-hidden className="text-muted group-open:hidden">＋</span><span aria-hidden className="hidden text-muted group-open:inline">－</span>
      </summary>
      <table className="w-full border-collapse text-body-s">
        <thead>
          <tr className="text-caption tracking-[.1em] text-muted">
            <th scope="col" className="border-b border-line px-1 py-2 text-left font-normal">日期</th>
            <th scope="col" className="border-b border-line px-1 py-2 text-left font-normal">品項</th>
            <th scope="col" className="border-b border-line px-1 py-2 text-left font-normal">誰付</th>
            <th scope="col" className="border-b border-line px-1 py-2 text-right font-normal">金額</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((e) => (
            <tr key={e.id}>
              <td className="num border-b border-line px-1 py-2">{shortDate(e.date)}</td>
              <td className="border-b border-line px-1 py-2">{e.title}</td>
              <td className="border-b border-line px-1 py-2">{nameOf(e.payerId)}</td>
              <td className="num border-b border-line px-1 py-2 text-right">{fullAmount(e)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}
