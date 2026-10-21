'use client';

import { FileSpreadsheet } from 'lucide-react';
import { useState } from 'react';
import { ledgerCsv, ledgerFileName } from '@/lib/csv';
import { fetchExportData } from '@/lib/data';
import { saveFile } from '@/lib/download';
import { useUi } from '@/lib/ui-store';

/** 我的 → 資料：下載明細 CSV（全部交易），Excel、Numbers 都能直接打開 */
export function CsvExportRow() {
  const showToast = useUi((s) => s.showToast);
  const [busy, setBusy] = useState(false);

  const download = async () => {
    setBusy(true);
    try {
      const data = await fetchExportData();
      saveFile(ledgerFileName(new Date()), ledgerCsv(data), 'text/csv;charset=utf-8');
      showToast(`已下載明細（交易 ${data.transactions.length.toLocaleString('en-US')} 筆）`);
    } catch (e) {
      showToast(e instanceof Error ? e.message : '下載失敗，請再試一次');
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="flex min-h-14 items-center gap-3.5 border-t border-line px-5 py-3">
      <span aria-hidden className="ico sm"><FileSpreadsheet size={16} strokeWidth={1.5} /></span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-body">下載明細（CSV）</span>
        <span className="caption leading-[1.6]" aria-live="polite">{busy ? '正在整理明細…' : '全部交易，Excel、Numbers 都能直接打開。'}</span>
      </span>
      <button type="button" onClick={download} disabled={busy} className="btn-secondary press flex-none">
        {busy ? '下載中…' : '下載'}
      </button>
    </li>
  );
}
