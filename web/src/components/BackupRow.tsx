'use client';

import { DatabaseBackup } from 'lucide-react';
import { useRef, useState, type ChangeEvent } from 'react';
import { backupFileName, isOtherAccount, MAX_BACKUP_BYTES, parseBackup, summarizeBackup, type Backup } from '@/lib/backup';
import { fetchBackup, fetchBackupSnapshot, useBackupSnapshot, useRestoreBackup, useUser } from '@/lib/data';
import { shortDateTime, toTime } from '@/lib/dates';
import { isDemo } from '@/lib/demo';
import { useUi } from '@/lib/ui-store';
import { Sheet, SheetHeader } from './Sheet';

/** 還原的是上傳的備份檔，還是上次還原前留下的那一份 */
type Pending = { kind: 'file' | 'undo'; backup: Backup };

const count = (n: number) => n.toLocaleString('en-US');
/** 2026/10/20 21:30 */
const fullTime = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${toTime(d)}`;
};
/** 2026-04-01 → 2026/4/1 */
const slashDate = (iso: string) => iso.split('-').map(Number).join('/');

/** 讓瀏覽器下載一個檔案 */
function saveFile(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  // Safari 要等下載開始才能放掉
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** 我的 → 資料：下載備份檔、從備份檔還原（整個換掉）、換回還原前的資料 */
export function BackupRow() {
  const { data: user } = useUser();
  const { data: snapshot } = useBackupSnapshot();
  const restore = useRestoreBackup();
  const showToast = useUi((s) => s.showToast);
  const [busy, setBusy] = useState<'download' | 'undo' | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [error, setError] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);

  const download = async () => {
    if (isDemo) return showToast('示範模式不會下載；正式版按這裡會下載一份備份檔');
    setBusy('download');
    try {
      const backup = await fetchBackup();
      saveFile(backupFileName(new Date()), JSON.stringify(backup));
      showToast(`已下載備份檔（交易 ${count(backup.transactions.length)} 筆）`);
    } catch (e) {
      showToast(e instanceof Error ? e.message : '下載失敗，請再試一次');
    } finally {
      setBusy(null);
    }
  };

  const pick = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // 清掉，同一個檔案才能再選一次
    e.target.value = '';
    if (!file) return;
    if (file.size > MAX_BACKUP_BYTES) return showToast('這個檔案不是 Monee 的備份檔');
    try {
      setError('');
      setPending({ kind: 'file', backup: parseBackup(await file.text()) });
    } catch (err) {
      showToast(err instanceof Error ? err.message : '讀不到這個檔案');
    }
  };

  const openUndo = async () => {
    setBusy('undo');
    try {
      const backup = await fetchBackupSnapshot();
      if (!backup) return showToast('找不到還原前的資料');
      setError('');
      setPending({ kind: 'undo', backup });
    } catch (e) {
      showToast(e instanceof Error ? e.message : '讀取失敗，請再試一次');
    } finally {
      setBusy(null);
    }
  };

  const close = () => {
    if (!restore.isPending) setPending(null);
  };

  const confirm = async () => {
    if (!pending) return;
    if (isDemo) {
      setPending(null);
      return showToast('示範模式不會改資料；正式版會整個換成這份備份');
    }
    try {
      await restore.mutateAsync(pending.backup);
      setPending(null);
      showToast(pending.kind === 'undo' ? '已換回還原前的資料' : `已還原 ${fullTime(pending.backup.exportedAt)} 的備份`);
    } catch (e) {
      setError(`還原失敗，資料都沒有動。${e instanceof Error ? e.message : ''}`);
    }
  };

  const status = busy === 'download' ? '正在準備備份檔…'
    : isDemo ? '示範模式不能用'
      : snapshot ? `上次還原 ${shortDateTime(snapshot.createdAt)}，還原錯了可以換回來`
        : '下載一份備份檔，資料出錯或換帳號時可以還原。';

  const link = 'press inline-flex min-h-11 items-center text-body-s underline underline-offset-4 disabled:opacity-50';

  return (
    <li className="flex flex-col gap-1 border-t border-line px-5 py-3">
      <div className="flex min-h-11 items-center gap-3.5">
        <span aria-hidden className="ico sm"><DatabaseBackup size={16} strokeWidth={1.5} /></span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-body">資料備份</span>
          <span className="caption leading-[1.6]" aria-live="polite">{status}</span>
        </span>
        <button type="button" onClick={download} disabled={busy === 'download'} className="btn-secondary press flex-none">
          {busy === 'download' ? '下載中…' : '下載'}
        </button>
      </div>
      <div className="ml-[42px] flex flex-wrap gap-x-5">
        <button type="button" onClick={() => fileInput.current?.click()} className={link}>從備份檔還原</button>
        {snapshot && (
          <button type="button" onClick={openUndo} disabled={busy === 'undo'} className={link}>
            {busy === 'undo' ? '讀取中…' : '換回還原前的資料'}
          </button>
        )}
      </div>
      <input ref={fileInput} type="file" accept=".json,application/json" onChange={pick} className="hidden" />

      <Sheet open={pending !== null} onClose={close} labelledBy="restore-title">
        {pending && (
          <RestoreConfirm
            pending={pending}
            otherAccount={Boolean(user && 'id' in user && isOtherAccount(pending.backup, user.id))}
            restoring={restore.isPending}
            error={error}
            onClose={close}
            onConfirm={confirm}
          />
        )}
      </Sheet>
    </li>
  );
}

function RestoreConfirm({ pending, otherAccount, restoring, error, onClose, onConfirm }: {
  pending: Pending;
  otherAccount: boolean;
  restoring: boolean;
  error: string;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const undo = pending.kind === 'undo';
  const s = summarizeBackup(pending.backup);
  const range = s.firstDate && s.lastDate ? `・${slashDate(s.firstDate)}～${slashDate(s.lastDate)}` : '';
  const rows: [string, string][] = [
    [undo ? '留下的時間' : '備份時間', fullTime(s.exportedAt)],
    ['帳戶', `${count(s.accounts)} 個`],
    ['交易', `${count(s.transactions)} 筆${range}`],
    ['分帳群組與旅程', `${count(s.groups)} 個`],
  ];

  return (
    <>
      <SheetHeader
        id="restore-title"
        title={undo ? '換回還原前的資料' : '從備份還原'}
        en="Restore"
        sub={undo ? '上次還原時，Monee 留下的那一份' : undefined}
        onClose={onClose}
      />
      <dl className="card flex flex-col px-5 py-1">
        {rows.map(([k, v]) => (
          <div key={k} className="flex min-h-11 items-center justify-between gap-3 border-t border-line py-2 first:border-t-0">
            <dt className="caption flex-none">{k}</dt>
            <dd className="text-right text-body-s">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="rounded-sm bg-alert-tint p-4 text-body-s leading-[1.8] text-alert">
        現在 Monee 裡的帳戶、交易、預算和分帳，會整個換成{undo ? '上次還原前的資料' : '這份備份的內容'}。
      </p>
      <div className="-mt-2 flex flex-col gap-1 px-1">
        <p className="caption leading-[1.8]">換掉之前 Monee 會先留一份現在的資料，還原錯了可以在「我的 → 資料備份」換回來。</p>
        {otherAccount && <p className="caption leading-[1.8]">這是另一個帳號的備份。分帳的分享連結不會帶過來，要重新分享給朋友。</p>}
      </div>
      {error && <p role="alert" className="-my-2 text-caption leading-[1.8] text-alert">{error}</p>}
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={onClose} disabled={restoring} className="btn-secondary press" data-autofocus>取消</button>
        <button type="button" onClick={onConfirm} disabled={restoring} className="btn-secondary press border-alert text-alert">
          {restoring ? '還原中…' : undo ? '換回來' : '還原'}
        </button>
      </div>
    </>
  );
}
