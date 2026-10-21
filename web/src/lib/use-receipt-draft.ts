'use client';

import { useEffect, useMemo, useState } from 'react';
import { removeReceipts, uploadReceipt } from './data';

/**
 * 表單上的收據照片。path 是已經存好的照片，blob 是這次新選的（按記下時才上傳）。
 * 存檔流程：upload() 拿到要寫進資料庫的路徑 → 寫入 → settle(路徑, 成功與否)：
 * 成功就刪掉被換掉或拿掉的舊照片，失敗就刪掉剛上傳的，Storage 裡不會留下沒人用的檔案。
 */
export function useReceiptDraft(original: string | null, initialBlob: Blob | null = null) {
  const [blob, setBlob] = useState<Blob | null>(initialBlob);
  const [path, setPath] = useState<string | null>(original);

  // 新選的照片用本機網址預覽，換掉或關掉表單時放掉
  const preview = useMemo(() => (blob ? URL.createObjectURL(blob) : null), [blob]);
  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  return {
    blob,
    path,
    preview,
    has: Boolean(blob || path),
    changed: blob !== null || path !== original,
    attach: (photo: Blob) => setBlob(photo),
    clear: () => {
      setBlob(null);
      setPath(null);
    },
    upload: async () => (blob ? uploadReceipt(blob) : path),
    settle: (saved: string | null, ok: boolean) => {
      if (ok && original && original !== saved) void removeReceipts([original]);
      if (!ok && blob && saved) void removeReceipts([saved]);
    },
  };
}

export type ReceiptDraft = ReturnType<typeof useReceiptDraft>;
