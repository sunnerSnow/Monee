'use client';

import { Camera, Mic, Sparkles, X } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { flushSync } from 'react-dom';
import { requestDraft, shrinkImage } from '@/lib/ai-client';
import type { AiDraftTransaction, DraftContext, DraftSource } from '@/lib/ai-draft';
import type { Account } from '@/lib/types';

import { Mascot } from '../Mascot';
const LOW_CONFIDENCE = 0.7;

type Phase =
  | { kind: 'idle' }
  | { kind: 'typing' }
  | { kind: 'working'; source: DraftSource }
  | { kind: 'done'; source: DraftSource; draft: AiDraftTransaction; note?: string }
  | { kind: 'error'; source: DraftSource; message: string };

/**
 * 記一筆上方的 AI 入口：說一句、拍收據。
 * 「說一句」打開輸入框、叫出鍵盤，用手機鍵盤上的麥克風說（iPhone、Android 鍵盤內建的語音輸入最穩，加到主畫面的 App 也能用），
 * 也可以直接打字；Monee 自己不錄音，只把那句話交給 AI 整理。
 * 辨識結果交給 onDraft 填進下面的表單，使用者檢查後按「記下」才會寫入。
 * onDraft 可以回傳一句補充說明（例如外幣換算），顯示在草稿說明裡。
 * 分帳、旅程帶 context（成員與幣別），AI 才認得「小明付的」和當地貨幣。
 */
export function AiEntryBar({ accounts, onDraft, onPhoto, context, example = '「午餐拉麵 260 刷國泰」「昨天全聯 389 付現」' }: {
  accounts: Account[];
  onDraft: (draft: AiDraftTransaction) => string | void;
  /** 拍了收據：縮好的照片交給表單附上（AI 認不出來也留著，手動輸入時一樣用得到） */
  onPhoto?: (photo: Blob) => void;
  context?: DraftContext;
  /** 說法範例 */
  example?: string;
}) {
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const [text, setText] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const textInput = useRef<HTMLInputElement>(null);
  const request = useRef<AbortController | null>(null);
  const draftCard = useRef<HTMLDivElement>(null);

  // 面板關掉時取消還在跑的辨識
  useEffect(() => () => request.current?.abort(), []);

  // 辨識完把焦點移到草稿說明（原本按的按鈕已經不在了），鍵盤使用者接著往下就是填好的欄位
  useEffect(() => {
    if (phase.kind === 'done') draftCard.current?.focus({ preventScroll: true });
  }, [phase]);

  const run = async (source: DraftSource, input: { file?: Blob; text?: string }) => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setPhase({ kind: 'working', source });
    try {
      const draft = await requestDraft({ source, accounts, context, signal: controller.signal, ...input });
      const note = onDraft(draft) || undefined;
      setPhase({ kind: 'done', source, draft, note });
    } catch (e) {
      if (controller.signal.aborted) return;
      setPhase({ kind: 'error', source, message: e instanceof Error ? e.message : 'AI 辨識失敗，請再試一次' });
    } finally {
      if (request.current === controller) request.current = null;
    }
  };

  // 輸入框要在按下的當下就畫出來並拿到焦點，iPhone 才會跳出鍵盤（之後才 focus 的話鍵盤不會出來）
  const openTyping = () => {
    flushSync(() => setPhase({ kind: 'typing' }));
    textInput.current?.focus();
  };

  const pickReceipt = () => fileInput.current?.click();

  const onFile = async (file: File | undefined) => {
    if (fileInput.current) fileInput.current.value = '';
    if (!file) return;
    setPhase({ kind: 'working', source: 'receipt' });
    const photo = await shrinkImage(file);
    onPhoto?.(photo);
    run('receipt', { file: photo });
  };

  const submitText = (e: FormEvent) => {
    e.preventDefault();
    if (text.trim()) run('text', { text: text.trim() });
  };

  const cancelWork = () => {
    request.current?.abort();
    setPhase({ kind: 'idle' });
  };

  const hiddenInput = (
    <input
      ref={fileInput}
      type="file"
      accept="image/*"
      hidden
      aria-hidden
      tabIndex={-1}
      onChange={(e) => onFile(e.target.files?.[0])}
    />
  );

  if (phase.kind === 'working') {
    return (
      <div role="status" aria-live="polite" className="card flex items-center gap-3 rounded-sm py-3 pr-2 pl-4">
        <Mascot className="w-11 flex-none motion-safe:animate-[wiggle_1s_ease-in-out_infinite]" />
        <span className="line-clamp-2 min-w-0 text-body-s">
          Monee 正在整理{phase.source === 'receipt' ? '收據' : `「${text.trim()}」`}…
        </span>
        <button type="button" onClick={cancelWork} aria-label="取消辨識" autoFocus className="icon-btn ghost press ml-auto">
          <X size={18} strokeWidth={1.5} aria-hidden />
        </button>
        {hiddenInput}
      </div>
    );
  }

  if (phase.kind === 'typing') {
    return (
      <form onSubmit={submitText} className="flex flex-col gap-2">
        <label htmlFor="ai-text" className="caption">說或打一句，Monee 幫你填好下面的欄位</label>
        <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-2">
          <input
            ref={textInput}
            id="ai-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={300}
            autoComplete="off"
            enterKeyHint="send"
            placeholder="例如：午餐拉麵 260 刷國泰"
            aria-describedby="ai-text-hint"
            className="field-input"
          />
          <button type="submit" disabled={!text.trim()} className="btn-secondary press">整理</button>
          <button type="button" onClick={() => setPhase({ kind: 'idle' })} aria-label="關閉" className="icon-btn ghost press">
            <X size={18} strokeWidth={1.5} aria-hidden />
          </button>
        </div>
        <p id="ai-text-hint" className="caption flex items-start gap-1.5 leading-[1.7]">
          <Mic size={14} strokeWidth={1.5} aria-hidden className="mt-1 flex-none" />
          <span>想用說的：按手機鍵盤上的麥克風，說出品項、金額和付款方式，例如{example}，說完按「整理」。</span>
        </p>
      </form>
    );
  }

  const buttons = (
    <div className="grid grid-cols-2 gap-2">
      <button type="button" onClick={openTyping} className="btn-secondary press">
        <Mic size={16} strokeWidth={1.5} aria-hidden />說一句
      </button>
      <button type="button" onClick={pickReceipt} className="btn-secondary press">
        <Camera size={16} strokeWidth={1.5} aria-hidden />拍收據
      </button>
      {hiddenInput}
    </div>
  );

  if (phase.kind === 'error') {
    return (
      <div className="flex flex-col gap-2.5">
        <div role="alert" className="flex flex-col gap-2.5 rounded-sm bg-alert-tint p-4">
          <p className="text-body-s leading-[1.8] text-alert">{phase.message}</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={phase.source === 'receipt' ? pickReceipt : openTyping} autoFocus className="btn-secondary press">
              {phase.source === 'receipt' ? '重新選照片' : '改一下再試'}
            </button>
            <button type="button" onClick={() => setPhase({ kind: 'idle' })} className="btn-secondary press">手動輸入</button>
          </div>
        </div>
        {hiddenInput}
      </div>
    );
  }

  if (phase.kind === 'done') {
    const { draft } = phase;
    return (
      <div className="flex flex-col gap-2.5">
        <div ref={draftCard} tabIndex={-1} role="status" className="flex flex-col gap-1.5 rounded-sm bg-fill p-4 outline-none">
          <span className="caption flex items-center gap-1.5">
            <Sparkles size={14} strokeWidth={1.5} aria-hidden />AI 已填好下面的欄位，確認後按「記下」
          </span>
          {draft.rawInput && <p className="text-body-s leading-[1.8]">「{draft.rawInput}」</p>}
          {phase.note && <p className="caption leading-[1.8]">{phase.note}</p>}
          {(draft.confidence < LOW_CONFIDENCE || !draft.suggestedAmount) && (
            <p className="caption text-warn-fg">
              {draft.suggestedAmount ? '有些地方不太確定，請檢查品項、金額、分類和帳戶。' : '沒有看到金額，請用下面的鍵盤輸入。'}
            </p>
          )}
        </div>
        {buttons}
      </div>
    );
  }

  return buttons;
}
