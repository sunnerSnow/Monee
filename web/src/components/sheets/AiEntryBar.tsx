'use client';

import { Camera, Keyboard, Mic, Sparkles, X } from 'lucide-react';
import Image from 'next/image';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { requestDraft, shrinkImage } from '@/lib/ai-client';
import type { AiDraftTransaction, DraftContext, DraftSource } from '@/lib/ai-draft';
import type { Account } from '@/lib/types';
import { useLiveTranscript } from '@/lib/use-live-transcript';
import { canRecord, useRecorder } from '@/lib/use-recorder';

const MAX_SECONDS = 30;
const LOW_CONFIDENCE = 0.7;

type Phase =
  | { kind: 'idle' }
  | { kind: 'typing' }
  | { kind: 'working'; source: DraftSource }
  | { kind: 'done'; source: DraftSource; draft: AiDraftTransaction; note?: string }
  | { kind: 'error'; source: DraftSource; message: string };

const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

// 音量條：五條中間高、兩邊低，跟著音量長高；沒聲音時剩一點點
const BAR_SHAPE = [0.55, 0.8, 1, 0.8, 0.55];
function LevelBars({ level }: { level: number }) {
  return (
    <span aria-hidden className="flex h-5 w-[27px] flex-none items-center gap-[3px]">
      {BAR_SHAPE.map((s, i) => (
        <i
          key={i}
          className="block h-full w-[3px] rounded-full bg-alert transition-transform duration-100 ease-out motion-reduce:transition-none"
          style={{ transform: `scaleY(${Math.max(0.15, Math.min(1, level * s * 1.6))})` }}
        />
      ))}
    </span>
  );
}

/**
 * 記一筆上方的 AI 入口：說一句、拍收據（不能錄音的瀏覽器改成打一句）。
 * 辨識結果交給 onDraft 填進下面的表單，使用者檢查後按「記下」才會寫入。
 * onDraft 可以回傳一句補充說明（例如外幣換算），顯示在草稿說明裡。
 * 分帳、旅程帶 context（成員與幣別），AI 才認得「小明付的」和當地貨幣。
 */
export function AiEntryBar({ accounts, onDraft, context, example = '「午餐拉麵 260 刷國泰」「昨天全聯 389 付現」' }: {
  accounts: Account[];
  onDraft: (draft: AiDraftTransaction) => string | void;
  context?: DraftContext;
  /** 錄音時的說法範例 */
  example?: string;
}) {
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const [text, setText] = useState('');
  const [voiceOk] = useState(canRecord);
  const fileInput = useRef<HTMLInputElement>(null);
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

  // 錄音時邊說邊顯示字（有的瀏覽器才有）；轉出來的字跟錄音一起送給 AI 當參考
  const live = useLiveTranscript();

  const onRecorded = async (audio: Blob) => {
    // 先顯示「正在整理」，等手機轉完最後的字（最多 1.2 秒）再一起送出；等的時候按了取消就不送
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setPhase({ kind: 'working', source: 'voice' });
    const heard = await live.finish();
    if (controller.signal.aborted) return;
    run('voice', { file: audio, text: heard || undefined });
  };

  const recorder = useRecorder({ maxSeconds: MAX_SECONDS, onRecorded });

  const startVoice = async () => {
    setPhase({ kind: 'idle' });
    live.cancel();
    try {
      // 先拿到麥克風開始錄，再開始轉字：轉字失敗也不會影響錄音
      if (await recorder.start()) live.start();
    } catch (e) {
      setPhase({ kind: 'error', source: 'voice', message: e instanceof Error ? e.message : '無法開始錄音' });
    }
  };

  const doneSpeaking = () => {
    live.stop();
    recorder.stop();
  };

  const cancelVoice = () => {
    live.cancel();
    recorder.cancel();
  };

  const pickReceipt = () => fileInput.current?.click();

  const onFile = async (file: File | undefined) => {
    if (fileInput.current) fileInput.current.value = '';
    if (!file) return;
    setPhase({ kind: 'working', source: 'receipt' });
    run('receipt', { file: await shrinkImage(file) });
  };

  const submitText = (e: FormEvent) => {
    e.preventDefault();
    if (text.trim()) run('text', { text: text.trim() });
  };

  const cancelWork = () => {
    request.current?.abort();
    setPhase({ kind: 'idle' });
  };

  const retry = (source: DraftSource) => {
    if (source === 'voice') return startVoice();
    if (source === 'receipt') return pickReceipt();
    setPhase({ kind: 'typing' });
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

  if (recorder.state !== 'idle') {
    const left = MAX_SECONDS - recorder.seconds;
    const recording = recorder.state === 'recording';
    return (
      <div className="card flex flex-col gap-3 rounded-sm p-4">
        <div className="flex items-center gap-2.5 text-body">
          <LevelBars level={recording ? recorder.level : 0} />
          {/* 只播報狀態；秒數和轉出來的字一直在變，放進 live region 會讓報讀器一直念 */}
          <span role="status">{recording ? '聆聽中' : '準備麥克風…'}</span>
          <span aria-hidden className="num ml-auto text-body-s text-muted">{clock(recorder.seconds)}{left <= 10 ? `・剩 ${left} 秒` : ''}</span>
        </div>
        {(live.text || live.status === 'listening') && (
          <p aria-hidden className={`min-h-[52px] rounded-sm bg-fill px-4 py-3 leading-[1.7] ${live.text ? 'text-body' : 'text-body-s text-muted'}`}>
            {live.text || (recording ? '說吧，你說的字會出現在這裡' : '…')}
          </p>
        )}
        <p className="caption leading-[1.8]">
          {recording ? '' : '看到「聆聽中」再開口。'}說出品項、金額和付款方式，例如{example}。品項只有一個字時，前面加「買」比較聽得準，例如「買蔥 19 塊」。
        </p>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={cancelVoice} className="btn-secondary press">取消</button>
          <button type="button" onClick={doneSpeaking} autoFocus className="btn-secondary press border-primary bg-primary text-on-primary">
            說完了
          </button>
        </div>
      </div>
    );
  }

  if (phase.kind === 'working') {
    const heard = phase.source === 'voice' && live.text;
    return (
      <div role="status" aria-live="polite" className="card flex items-center gap-3 rounded-sm py-3 pr-2 pl-4">
        <Image src="/monee.png" alt="" width={44} height={32} className="h-auto w-11 flex-none animate-[pulse_1.4s_ease-in-out_infinite] motion-reduce:animate-none" />
        <span className="line-clamp-2 min-w-0 text-body-s">
          Monee 正在整理{heard ? `「${heard}」` : phase.source === 'receipt' ? '收據' : phase.source === 'voice' ? '你說的話' : '你打的字'}…
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
        <label htmlFor="ai-text" className="caption">用一句話描述，Monee 幫你填好下面的欄位</label>
        <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-2">
          <input
            id="ai-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={300}
            autoFocus
            autoComplete="off"
            enterKeyHint="send"
            placeholder="例如：午餐拉麵 260 刷國泰"
            className="field-input"
          />
          <button type="submit" disabled={!text.trim()} className="btn-secondary press">整理</button>
          <button type="button" onClick={() => setPhase({ kind: 'idle' })} aria-label="關閉" className="icon-btn ghost press">
            <X size={18} strokeWidth={1.5} aria-hidden />
          </button>
        </div>
      </form>
    );
  }

  const buttons = (
    <div className="grid grid-cols-2 gap-2">
      {voiceOk ? (
        <button type="button" onClick={startVoice} className="btn-secondary press">
          <Mic size={16} strokeWidth={1.5} aria-hidden />說一句
        </button>
      ) : (
        <button type="button" onClick={() => setPhase({ kind: 'typing' })} className="btn-secondary press">
          <Keyboard size={16} strokeWidth={1.5} aria-hidden />打一句
        </button>
      )}
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
            <button type="button" onClick={() => retry(phase.source)} autoFocus className="btn-secondary press">
              {phase.source === 'receipt' ? '重新選照片' : phase.source === 'voice' ? '再說一次' : '重新輸入'}
            </button>
            {phase.source === 'voice' && (
              <button type="button" onClick={() => setPhase({ kind: 'typing' })} className="btn-secondary press">改用打字</button>
            )}
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
              {draft.suggestedAmount ? '有些地方不太確定，請檢查品項、金額、分類和帳戶。' : '沒有聽到金額，請用下面的鍵盤輸入。'}
            </p>
          )}
        </div>
        {buttons}
      </div>
    );
  }

  return buttons;
}
