'use client';

import { ExternalLink, Sheet as SheetIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { fetchExportData, useProfile, useUpdateProfile } from '@/lib/data';
import { shortDateTime } from '@/lib/dates';
import { isDemo } from '@/lib/demo';
import { isGoogleConfigured, preloadGoogle, requestGoogleToken, sheetsUrl, writeSpreadsheet } from '@/lib/google-sheets';
import { buildWorkbook } from '@/lib/sheets-export';
import { useUi } from '@/lib/ui-store';

const ready = isGoogleConfigured && !isDemo;

/** 我的 → 資料：匯出到 Google Sheets。第一次建一份「Monee 記帳」，之後每次都更新同一份 */
export function SheetsExportRow() {
  const { data: profile } = useProfile();
  const update = useUpdateProfile();
  const showToast = useUi((s) => s.showToast);
  const [stage, setStage] = useState<'auth' | 'write' | null>(null);
  // 第幾次按：等授權時可以再按一次（使用者關掉 Google 的視窗時，Google 不一定會通知），只有最後一次算數
  const attempt = useRef(0);

  // 先載好 Google 登入，按下去時 Google 的視窗才不會被瀏覽器擋掉
  useEffect(() => {
    if (ready) preloadGoogle().catch(() => {});
  }, []);

  const run = async () => {
    if (isDemo) return showToast('示範模式不會連到 Google；正式版按這裡會在你的 Google 雲端硬碟建一份試算表');
    if (!isGoogleConfigured) return showToast('匯出還沒設定好（缺少 NEXT_PUBLIC_GOOGLE_CLIENT_ID，設定步驟在 README）');
    if (!profile || stage === 'write') return;
    const mine = ++attempt.current;
    setStage('auth');
    try {
      // 在 click 裡直接跟 Google 要授權（前面不能有 await），視窗才不會被擋
      const token = await requestGoogleToken();
      if (mine !== attempt.current) return;
      setStage('write');
      const data = await fetchExportData();
      const id = await writeSpreadsheet(
        token, profile.sheetsId, buildWorkbook(data, new Date()), (created) => update.mutateAsync({ sheetsId: created }),
      );
      await update.mutateAsync({ sheetsId: id, sheetsExportedAt: new Date().toISOString() });
      showToast(`已匯出 ${data.transactions.length.toLocaleString('en-US')} 筆交易到 Google Sheets`);
    } catch (e) {
      if (mine === attempt.current) showToast(e instanceof Error ? e.message : '匯出失敗，請再試一次');
    } finally {
      if (mine === attempt.current) setStage(null);
    }
  };

  const status = stage === 'auth' ? '等 Google 授權…（沒看到 Google 的視窗就再按一次）'
    : stage === 'write' ? '匯出中，資料多的話要等一下…'
      : isDemo ? '示範模式不能用'
        : !isGoogleConfigured ? '還沒設定'
          : profile?.sheetsExportedAt ? `上次 ${shortDateTime(profile.sheetsExportedAt)}・每次更新同一份`
            : '在你的 Google 雲端硬碟建一份試算表，之後每次更新同一份。Monee 只能存取它自己建立的檔案。';

  return (
    <li className="flex flex-col gap-1 px-5 py-3">
      <div className="flex min-h-11 items-center gap-3.5">
        <span aria-hidden className="ico sm" style={{ background: 'var(--green)' }}><SheetIcon size={16} strokeWidth={1.5} /></span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-body">匯出到 Google Sheets</span>
          <span className="caption leading-[1.6]" aria-live="polite">{status}</span>
        </span>
        <button type="button" onClick={run} disabled={stage === 'write' || (ready && !profile)} className="btn-secondary press flex-none">
          {stage === 'write' ? '匯出中…' : profile?.sheetsId ? '更新' : '匯出'}
        </button>
      </div>
      {ready && profile?.sheetsId && (
        <a
          href={sheetsUrl(profile.sheetsId)}
          target="_blank"
          rel="noopener noreferrer"
          className="press ml-[42px] inline-flex min-h-11 items-center gap-1.5 self-start text-body-s underline underline-offset-4"
        >
          打開試算表<ExternalLink size={14} strokeWidth={1.5} aria-hidden />
        </a>
      )}
    </li>
  );
}
