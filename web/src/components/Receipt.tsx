'use client';

/* eslint-disable @next/next/no-img-element -- 照片是簽名網址或本機的 blob 網址，不經過 next/image 的最佳化 */

import { ImageOff, ImagePlus, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { shrinkImage } from '@/lib/ai-client';
import { useReceiptUrl } from '@/lib/data';
import type { ReceiptDraft } from '@/lib/use-receipt-draft';

/** 全螢幕看照片；可以用兩指放大（整頁縮放），按關閉或 Esc 回到表單 */
function PhotoViewer({ src, onClose }: { src: string; onClose: () => void }) {
  const closeBtn = useRef<HTMLButtonElement>(null);

  // 打開時焦點移到關閉鈕，關掉後回到原本的小圖
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeBtn.current?.focus();
    return () => previous?.focus?.();
  }, []);

  // Esc 只關照片：下面的面板在 document 上聽 Esc，所以要在 window 的捕獲階段先接住
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      onClose();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="收據照片"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 pt-[calc(56px+env(safe-area-inset-top))] motion-safe:animate-[fade-in_var(--dur-fade)_ease-out]"
    >
      <img src={src} alt="收據照片" className="max-h-full max-w-full object-contain" />
      <button
        ref={closeBtn}
        type="button"
        onClick={onClose}
        aria-label="關閉照片"
        className="icon-btn press absolute top-[calc(8px+env(safe-area-inset-top))] right-3 border-transparent bg-white/15 text-white"
      >
        <X size={20} strokeWidth={1.5} aria-hidden />
      </button>
    </div>
  );
}

/** 照片小圖：點了看大圖；載入中是骨架，照片不在了顯示圖示 */
function Thumb({ src, missing, className, label }: { src: string | null | undefined; missing: boolean; className: string; label: string }) {
  const [open, setOpen] = useState(false);
  if (missing) {
    return (
      <span className={`flex flex-none items-center justify-center rounded-xs border border-line bg-fill text-muted ${className}`}>
        <ImageOff size={18} strokeWidth={1.5} aria-hidden />
      </span>
    );
  }
  if (!src) return <span aria-hidden className={`skeleton flex-none rounded-xs ${className}`} />;
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label={label} aria-haspopup="dialog" className={`press flex-none overflow-hidden rounded-xs border border-line bg-fill ${className}`}>
        <img src={src} alt="" className="h-full w-full object-cover" />
      </button>
      {open && <PhotoViewer src={src} onClose={() => setOpen(false)} />}
    </>
  );
}

/** 表單裡的收據照片：附上、換一張、拿掉；按記下時才上傳 */
export function ReceiptField({ draft }: { draft: ReceiptDraft }) {
  const input = useRef<HTMLInputElement>(null);
  const saved = useReceiptUrl(draft.blob ? null : draft.path);
  const missing = !draft.blob && saved.isError;

  const pick = async (file: File | undefined) => {
    if (input.current) input.current.value = '';
    if (file) draft.attach(await shrinkImage(file));
  };

  return (
    <div className="flex min-h-11 items-center gap-3">
      {draft.has ? (
        <>
          <Thumb src={draft.preview ?? saved.data} missing={missing} label="看收據照片" className="h-14 w-11" />
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-body-s">收據照片</span>
            <span className="caption">{missing ? '照片已經不在了' : draft.blob ? '按記下時一起存' : '點小圖看大圖'}</span>
          </span>
          <button type="button" onClick={() => input.current?.click()} className="press min-h-11 flex-none px-1 text-body-s underline underline-offset-4">換一張</button>
          <button type="button" onClick={draft.clear} className="press min-h-11 flex-none px-1 text-body-s text-muted underline underline-offset-4">拿掉</button>
        </>
      ) : (
        <button type="button" onClick={() => input.current?.click()} className="pill press">
          <ImagePlus size={16} strokeWidth={1.5} aria-hidden />附上收據照片
        </button>
      )}
      <input ref={input} type="file" accept="image/*" onChange={(e) => pick(e.target.files?.[0])} className="hidden" />
    </div>
  );
}

/** 只看不改：分帳花費的明細 */
export function ReceiptView({ path }: { path: string }) {
  const { data, isError } = useReceiptUrl(path);
  return (
    <div className="flex items-center gap-3">
      <Thumb src={data} missing={isError} label="看收據照片" className="h-20 w-16" />
      <span className="caption">{isError ? '照片已經不在了' : '點小圖看大圖'}</span>
    </div>
  );
}
