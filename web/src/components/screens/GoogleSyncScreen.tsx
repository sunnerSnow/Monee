'use client';

import { ChevronLeft, CircleAlert, ExternalLink, FolderOpen, Receipt, RefreshCw, Sheet as SheetIcon, ShieldCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useDisconnectGoogle, useGoogleStatus, useSyncGoogle } from '@/lib/data';
import { shortDateTime } from '@/lib/dates';
import { isDemo } from '@/lib/demo';
import type { SyncResult } from '@/lib/server/google-sync';
import { useUi } from '@/lib/ui-store';
import { ErrorBox } from '../ui';

const CONNECT = '/api/google/connect';

/** /api/google/callback 導回來時帶的錯誤 */
const ERRORS: Record<string, string> = {
  config: 'Google 同步還沒設定好：伺服器缺少 GOOGLE_CLIENT_SECRET 或 GOOGLE_TOKEN_KEY（設定步驟在 README）。',
  db: '資料庫還沒更新：請先到 Supabase 執行 20261022000000_google_sync.sql。',
  denied: '你在 Google 的畫面取消了，沒有連結。',
  state: '連結逾時，或不是從這裡開始的。請再按一次「連結 Google 帳號」。',
  scope: '要勾選「查看、編輯、建立及刪除 Monee 使用的 Google 雲端硬碟檔案」才能同步，請再連結一次。',
  'no-refresh': 'Google 沒有給長期授權，請再連結一次。',
  failed: '跟 Google 連結失敗，請再試一次。',
  demo: '示範模式不能連結 Google。',
};

/** 「立即同步」做完的提示 */
function syncMessage(r: SyncResult) {
  switch (r.status) {
    case 'done': return r.months ? `同步好了（${r.months} 個月）` : '都是最新的，不用同步';
    case 'more': return `同步了 ${r.months ?? 0} 個月，還有一些會在背景接著做`;
    case 'busy': return '正在同步中（可能是另一支手機），等一下再看';
    case 'reconnect': return 'Google 的授權失效了，請重新連結';
    case 'not-connected': return '還沒連結 Google';
    default: return r.message ?? '同步失敗，等一下再試';
  }
}

/** 我的 → Google 雲端同步：連結 Google、看同步狀態、立即同步、解除連結 */
export function GoogleSyncScreen() {
  const router = useRouter();
  const showToast = useUi((s) => s.showToast);
  const { data: status, isPending, error, refetch } = useGoogleStatus();
  const [notice, setNotice] = useState<string | null>(null);
  const back = () => (window.history.length > 1 ? router.back() : router.push('/settings'));

  // Google 導回來時網址帶著結果：提示一次，再把網址清乾淨（重新整理不會再提示）
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const err = params.get('error');
    if (params.get('connected')) showToast('已連結 Google，收據和年度帳本會自動同步');
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 只在打開時讀一次網址
    if (err) setNotice(ERRORS[err] ?? ERRORS.failed);
    if (err || params.get('connected')) window.history.replaceState(null, '', window.location.pathname);
  }, [showToast]);

  return (
    <>
      <header className="flex min-h-12 items-center gap-1">
        <button type="button" onClick={back} aria-label="返回" className="icon-btn ghost press">
          <ChevronLeft size={20} strokeWidth={1.5} aria-hidden />
        </button>
        <h1 className="h-page">Google 雲端同步<span className="en">Drive</span></h1>
      </header>

      {notice && (
        <div role="alert" className="empty-box flex-row items-start gap-2.5">
          <CircleAlert size={18} strokeWidth={1.5} aria-hidden className="mt-0.5 flex-none text-alert" />
          <p className="text-body-s leading-[1.8]">{notice}</p>
        </div>
      )}

      {error ? <ErrorBox message={error.message} onRetry={() => refetch()} />
        : isPending ? <div aria-busy="true" className="skeleton h-64" />
        : status ? <Connected status={status} />
        : <NotConnected />}
    </>
  );
}

function NotConnected() {
  const items = [
    { icon: Receipt, color: 'var(--orange)', title: '收據照片', text: '記帳附的收據自動放進 Drive 的「Monee／2026／10」，照記帳日期分月。' },
    { icon: SheetIcon, color: 'var(--green)', title: '年度帳本', text: '每年一份「Monee_2026_年度帳本」：12 個月的收支明細，加上年度總覽和圖表。' },
    { icon: ShieldCheck, color: 'var(--teal)', title: '只碰 Monee 的檔案', text: 'Monee 只看得到自己建立的檔案，你 Drive 裡其他東西都看不到。帳一樣先存在 Monee，Google 暫時連不上也不影響記帳。' },
  ];
  return (
    <section aria-label="還沒連結" className="card flex flex-col gap-4 p-5">
      <ul className="flex flex-col gap-3.5">
        {items.map(({ icon: Icon, color, title, text }) => (
          <li key={title} className="flex gap-3">
            <span aria-hidden className="ico sm mt-0.5" style={{ background: color }}><Icon size={16} strokeWidth={1.5} /></span>
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="text-body">{title}</span>
              <span className="caption leading-[1.7]">{text}</span>
            </span>
          </li>
        ))}
      </ul>
      {isDemo ? (
        <p className="caption rounded-md bg-fill px-3 py-2 text-center">示範模式不能連結 Google</p>
      ) : (
        <a href={CONNECT} className="btn-primary press">連結 Google 帳號</a>
      )}
    </section>
  );
}

/** 在新分頁打開 Google 上的資料夾或試算表 */
function fileLink(href: string, Icon: typeof FolderOpen, color: string, title: string, sub: string) {
  return (
    <li key={href} className="border-t border-line first:border-t-0">
      <a href={href} target="_blank" rel="noopener noreferrer" className="press flex min-h-14 items-center gap-3.5 px-5 py-2">
        <span aria-hidden className="ico sm" style={{ background: color }}><Icon size={16} strokeWidth={1.5} /></span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate text-body">{title}</span>
          <span className="caption">{sub}</span>
        </span>
        <ExternalLink size={16} strokeWidth={1.5} aria-hidden className="text-muted" />
        <span className="sr-only">（在新分頁打開）</span>
      </a>
    </li>
  );
}

function Connected({ status }: { status: NonNullable<ReturnType<typeof useGoogleStatus>['data']> }) {
  const disconnect = useDisconnectGoogle();
  const sync = useSyncGoogle();
  const showToast = useUi((s) => s.showToast);
  const [confirming, setConfirming] = useState(false);

  const syncNow = () => sync.mutate(undefined, { onSuccess: (r) => showToast(syncMessage(r)) });

  const unlink = () => disconnect.mutate(undefined, {
    onSuccess: () => showToast('已解除連結；Drive 裡的收據和年度帳本都還在'),
    onError: (e) => showToast(e.message),
  });

  const row = (label: string, value: string) => (
    <div className="flex items-baseline justify-between gap-3 border-t border-line py-3 first:border-t-0">
      <dt className="caption flex-none">{label}</dt>
      <dd className="min-w-0 text-right text-body-s break-all">{value}</dd>
    </div>
  );

  return (
    <>
      {status.needsReconnect && (
        <div role="alert" className="card flex flex-col gap-3 border-alert p-5">
          <p className="text-body-s leading-[1.8]">Google 的授權失效了（可能在 Google 帳號移除了 Monee 的權限，或太久沒用），同步暫停。重新連結後會接著同步。</p>
          <a href={CONNECT} className="btn-primary press">重新連結</a>
        </div>
      )}

      <section aria-label="同步狀態" className="card px-5 py-1">
        <dl>
          {row('Google 帳號', status.email ?? '已連結')}
          {row('連結時間', shortDateTime(status.connectedAt))}
          {row('最後同步', status.lastSyncedAt ? shortDateTime(status.lastSyncedAt) : '還沒同步過')}
          {row('待同步', status.pending ? `${status.pending} 個月${status.failed ? `（${status.failed} 個月失敗過，會再試）` : ''}` : '都同步好了')}
          {status.lastError && row('上次的問題', status.lastError)}
        </dl>
      </section>

      {!status.needsReconnect && (
        <div className="flex flex-col gap-2">
          <button type="button" onClick={syncNow} disabled={sync.isPending} className="btn-primary press w-full">
            <RefreshCw size={18} strokeWidth={1.5} aria-hidden className={sync.isPending ? 'motion-safe:animate-spin' : ''} />
            {sync.isPending ? '同步中…' : '立即同步'}
          </button>
          <p className="caption px-1 leading-[1.7]">平常記帳、改帳後會自動同步；失敗很多次的月份要按這裡才會再試。</p>
        </div>
      )}
      <section aria-labelledby="files-title" className="flex flex-col gap-2">
        <h2 id="files-title" className="px-1 text-body-s font-normal tracking-[.1em] text-muted">Google 上的檔案</h2>
        {status.rootFolderId || status.workbooks.length ? (
          <ul className="card">
            {status.rootFolderId && fileLink(`https://drive.google.com/drive/folders/${status.rootFolderId}`, FolderOpen, 'var(--orange)', 'Monee 資料夾', '收據照記帳日期放在「年／月」')}
            {status.workbooks.map((b) => fileLink(`https://docs.google.com/spreadsheets/d/${b.id}`, SheetIcon, 'var(--green)', `Monee_${b.year}_年度帳本`, '12 個月的明細、年度總覽和圖表'))}
          </ul>
        ) : (
          <p className="caption px-1 leading-[1.7]">第一次同步時會建立 Monee 資料夾和今年的年度帳本。</p>
        )}
      </section>

      {confirming ? (
        <div role="alertdialog" aria-labelledby="unlink-title" className="card flex flex-col gap-3 p-5">
          <p id="unlink-title" className="text-body-s leading-[1.8]">解除後就不再同步。Drive 裡已經放的收據和年度帳本都會留著，不會刪掉；之後再連結會接著同步。</p>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setConfirming(false)} className="btn-secondary press">取消</button>
            <button type="button" onClick={unlink} disabled={disconnect.isPending} className="btn-secondary press text-alert">
              {disconnect.isPending ? '解除中…' : '確定解除'}
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setConfirming(true)} className="btn-secondary press w-full">解除 Google 連結</button>
      )}
    </>
  );
}
