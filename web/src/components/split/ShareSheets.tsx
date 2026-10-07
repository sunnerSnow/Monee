'use client';

import { Copy, Info, Share2 } from 'lucide-react';
import { useState } from 'react';
import { copyText } from '@/lib/clipboard';
import { useAccounts, useConfirmClaim, useProfile, useRejectClaim, useShareGroup, useStopShare, useUpdateProfile } from '@/lib/data';
import { toISODate, toTime } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { meOf, memberName, waitingClaims } from '@/lib/split';
import type { SplitClaim, SplitGroup } from '@/lib/types';
import { useUi } from '@/lib/ui-store';
import { SheetHeader } from '../Sheet';
import { EmptyBox } from '../ui';
import { Field, Pills, receivingAccounts } from './parts';

export const SHARE_TITLE_ID = 'split-sheet-title';

/** 分享給朋友：產生連結、你的名字與收款方式、重設或停止分享 */
export function ShareSheet({ g }: { g: SplitGroup }) {
  const close = useUi((s) => s.closeSheet);
  const { data: profile, isPending } = useProfile();
  if (isPending || !profile) {
    return <><SheetHeader id={SHARE_TITLE_ID} title="分享給朋友" en="Share" sub={g.name} onClose={close} /><div aria-busy="true" className="skeleton h-48" /></>;
  }
  return <ShareForm g={g} initial={{ name: profile.displayName ?? '', bank: profile.payBank ?? '', line: profile.payLine ?? '' }} />;
}

function ShareForm({ g, initial }: { g: SplitGroup; initial: { name: string; bank: string; line: string } }) {
  const close = useUi((s) => s.closeSheet);
  const showToast = useUi((s) => s.showToast);
  const share = useShareGroup();
  const stop = useStopShare();
  const updateProfile = useUpdateProfile();
  const [name, setName] = useState(initial.name);
  const [bank, setBank] = useState(initial.bank);
  const [line, setLine] = useState(initial.line);
  const [error, setError] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);
  const dirty = name.trim() !== initial.name || bank.trim() !== initial.bank || line.trim() !== initial.line;
  const url = g.shareToken && typeof window !== 'undefined' ? `${window.location.origin}/s/${g.shareToken}` : '';
  const intro = `${name.trim() || '我'} 邀請你看「${g.name}」的分帳，點連結就能看要付誰多少，不用下載：`;
  const busy = share.isPending || stop.isPending || updateProfile.isPending;
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  const saveProfile = async () => {
    if (!name.trim()) throw new Error('請先填你在朋友頁上的名字');
    if (dirty) await updateProfile.mutateAsync({ displayName: name.trim(), payBank: bank.trim(), payLine: line.trim() });
  };
  const run = async (fn: () => Promise<unknown>, done?: string) => {
    setError('');
    try {
      await fn();
      if (done) showToast(done);
    } catch (e) {
      // 使用者在系統分享選單按取消不算錯誤
      if (e instanceof DOMException && e.name === 'AbortError') return;
      setError(e instanceof Error ? e.message : '操作失敗，請再試一次');
    }
  };

  return (
    <>
      <SheetHeader id={SHARE_TITLE_ID} title="分享給朋友" en="Share" sub={g.name} onClose={close} />
      <p className="-mt-2 text-body-s leading-[1.8] text-muted">朋友點連結就能看這個群組的帳、知道要付誰多少，付完按「我已付款」，你確認後才會記帳。不用下載、不用註冊。</p>

      <Field label="你在朋友頁上的名字" htmlFor="share-name">
        <input id="share-name" data-autofocus value={name} onChange={(e) => setName(e.target.value)} maxLength={20} placeholder="例如：Yuki" autoComplete="off" className="field-input" />
      </Field>
      <Field label="你的收款方式（要付你錢的朋友看得到，可不填）">
        <label className="sr-only" htmlFor="share-bank">銀行帳號</label>
        <input id="share-bank" value={bank} onChange={(e) => setBank(e.target.value)} maxLength={60} placeholder="銀行與帳號，例如：國泰世華 013・0123-4567-8901" autoComplete="off" className="field-input" />
        <label className="sr-only" htmlFor="share-line">LINE Pay ID</label>
        <input id="share-line" value={line} onChange={(e) => setLine(e.target.value)} maxLength={40} placeholder="LINE Pay ID" autoComplete="off" className="field-input" />
      </Field>

      {error && <p role="alert" className="-my-2 text-caption text-alert">{error}</p>}

      {!g.shareToken ? (
        <button
          type="button"
          onClick={() => run(async () => { await saveProfile(); await share.mutateAsync({ groupId: g.id, reset: false }); }, '已產生分享連結')}
          disabled={busy || !name.trim()}
          className="btn-primary press w-full"
        >
          <Share2 size={18} strokeWidth={1.5} aria-hidden />{busy ? '處理中…' : '產生分享連結'}
        </button>
      ) : (
        <>
          {dirty && (
            <button type="button" onClick={() => run(saveProfile, '已更新，朋友頁會顯示新的名字與收款方式')} disabled={busy || !name.trim()} className="btn-secondary press w-full">
              儲存名字與收款方式
            </button>
          )}
          <div className="flex items-center gap-2 rounded-full border border-line bg-surface py-1.5 pr-1.5 pl-4">
            <code className="num min-w-0 flex-1 truncate text-[13px]">{url.replace(/^https?:\/\//, '')}</code>
            <button type="button" onClick={async () => showToast((await copyText(url)) ? '已複製連結' : '複製失敗，請長按連結複製')} className="btn-secondary press min-h-10">
              <Copy size={14} strokeWidth={1.5} aria-hidden />複製
            </button>
          </div>
          <a
            href={`https://line.me/R/msg/text/?${encodeURIComponent(intro + url)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary press w-full !bg-[#06C755] !text-white"
          >
            用 LINE 傳給朋友
          </a>
          {canShare && (
            <button type="button" onClick={() => run(() => navigator.share({ title: `${g.name}・分帳`, text: intro, url }))} className="btn-secondary press w-full">
              其他分享方式
            </button>
          )}
          <p className="flex items-start gap-2 px-1 text-caption leading-[1.7] text-muted">
            <Info size={16} strokeWidth={1.5} aria-hidden className="mt-0.5 flex-none" />
            <span>朋友只看得到這個群組的花費與結算，看不到你的個人記帳。連結外流的話，重設後舊連結立刻失效。</span>
          </p>
          {confirmReset ? (
            <div role="alertdialog" aria-labelledby="reset-q" className="flex flex-col gap-3 rounded-sm bg-alert-tint p-4">
              <p id="reset-q" className="text-body-s text-alert">舊連結會立刻失效，要把新連結重新傳給朋友。確定重設？</p>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setConfirmReset(false)} className="btn-secondary press" autoFocus>取消</button>
                <button
                  type="button"
                  onClick={() => run(async () => { await share.mutateAsync({ groupId: g.id, reset: true }); setConfirmReset(false); }, '已換成新連結')}
                  disabled={busy}
                  className="btn-secondary press border-alert text-alert"
                >
                  重設
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setConfirmReset(true)} disabled={busy} className="btn-secondary press">重設連結</button>
              <button type="button" onClick={() => run(() => stop.mutateAsync(g.id), '已停止分享，舊連結失效了')} disabled={busy} className="btn-secondary press text-alert">停止分享</button>
            </div>
          )}
        </>
      )}
    </>
  );
}

/** 待確認：朋友在分享頁按了「我已付款」，你確認後才寫進還款與個人帳 */
export function InboxSheet({ groups, groupId }: { groups: SplitGroup[]; groupId?: string }) {
  const close = useUi((s) => s.closeSheet);
  const items = groups.filter((g) => !groupId || g.id === groupId).flatMap((g) => waitingClaims(g).map((c) => ({ g, c })));
  return (
    <>
      <SheetHeader id={SHARE_TITLE_ID} title="待確認" en="Inbox" sub="朋友說已付款，要你確認才會記帳" onClose={close} />
      {items.length
        ? items.map(({ g, c }) => <ClaimItem key={c.id} g={g} c={c} isLast={items.length === 1} />)
        : <EmptyBox title="都處理好了">朋友在分享連結按「我已付款」時，會出現在這裡。</EmptyBox>}
    </>
  );
}

function ClaimItem({ g, c, isLast }: { g: SplitGroup; c: SplitClaim; isLast: boolean }) {
  const close = useUi((s) => s.closeSheet);
  const showToast = useUi((s) => s.showToast);
  const { data: accounts = [] } = useAccounts();
  const confirm = useConfirmClaim();
  const reject = useRejectClaim();
  const me = meOf(g)!;
  const toMe = c.toId === me.id;
  const choices = receivingAccounts(accounts);
  const [accountId, setAccountId] = useState(choices.find((a) => a.type === 'BANK')?.id ?? choices[0]?.id ?? '');
  const [error, setError] = useState('');
  const from = memberName(g, c.fromId);
  const to = memberName(g, c.toId);
  const busy = confirm.isPending || reject.isPending;

  const doConfirm = async () => {
    if (toMe && !accountId) return setError('請先新增現金或銀行帳戶');
    const now = new Date();
    try {
      const closed = await confirm.mutateAsync({ claimId: c.id, accountId: toMe ? accountId : null, date: toISODate(now), time: toTime(now) });
      showToast(closed ? `都結清了！「${g.name}」的花費收進已結清的紀錄` : toMe ? `已記錄：${from}還你 ${formatMoney(c.amount)}` : `已記錄：${from}付給${to} ${formatMoney(c.amount)}`);
      if (isLast) close();
    } catch (e) {
      setError(e instanceof Error ? e.message : '操作失敗，請再試一次');
    }
  };
  const doReject = async () => {
    try {
      await reject.mutateAsync(c.id);
      showToast(`已標記還沒收到，${from}在分享頁會看到`);
      if (isLast) close();
    } catch (e) {
      setError(e instanceof Error ? e.message : '操作失敗，請再試一次');
    }
  };

  return (
    <div className="card flex flex-col gap-3 p-4">
      <p className="text-body-s leading-[1.8]">
        <b className="font-medium">{from}</b> 說已經付給{toMe ? '你' : ` ${to} `}<b className="num font-normal">{formatMoney(c.amount)}</b>（{g.name}）
      </p>
      {toMe && (
        <Field label="存進哪個帳戶">
          {choices.length
            ? <Pills items={choices.map((a) => ({ id: a.id, label: a.name }))} value={accountId} onPick={setAccountId} label="存入帳戶" wrap />
            : <p className="text-body-s text-muted">還沒有現金或銀行帳戶，請先到資產頁新增。</p>}
        </Field>
      )}
      {!toMe && <p className="caption">朋友之間的還款，不影響你的帳，只會更新群組的結算。</p>}
      {error && <p role="alert" className="text-caption text-alert">{error}</p>}
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={doReject} disabled={busy} className="btn-secondary press">{toMe ? '還沒收到' : '不對'}</button>
        <button type="button" onClick={doConfirm} disabled={busy} className="btn-primary press min-h-11">{toMe ? '確認收到' : '確認'}</button>
      </div>
    </div>
  );
}
