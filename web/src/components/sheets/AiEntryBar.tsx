'use client';

import { Camera, Keyboard, Mic, Play, Sparkles, Square, X } from 'lucide-react';
import Image from 'next/image';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { requestDraft, shrinkImage } from '@/lib/ai-client';
import type { AiDraftTransaction, DraftContext, DraftSource } from '@/lib/ai-draft';
import type { Account } from '@/lib/types';
import { canTranscribe, useLiveTranscript } from '@/lib/use-live-transcript';
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

/** 聽剛剛的錄音：AI 聽錯時，先確認手機錄到的聲音清不清楚、有沒有被切掉 */
function Playback({ src }: { src: string }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const toggle = () => {
    const a = audio.current;
    if (!a) return;
    if (!a.paused) return a.pause();
    a.currentTime = 0;
    a.play().catch(() => setPlaying(false));
  };
  return (
    <>
      <button type="button" onClick={toggle} className="btn-secondary press">
        {playing ? <Square size={14} strokeWidth={1.5} aria-hidden /> : <Play size={14} strokeWidth={1.5} aria-hidden />}
        {playing ? '停止' : '聽錄音'}
      </button>
      <audio ref={audio} src={src} preload="auto" hidden onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} />
    </>
  );
}

/**
 * 記一筆上方的 AI 入口：說一句、拍收據（不能錄音的瀏覽器改成打一句）。
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
  /** 錄音時的說法範例 */
  example?: string;
}) {
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const [text, setText] = useState('');
  const [voiceOk] = useState(() => canRecord() || canTranscribe());
  // 上一段錄音（錄音交給 AI 聽的時候才有），可以重聽
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const request = useRef<AbortController | null>(null);
  const draftCard = useRef<HTMLDivElement>(null);

  // 面板關掉時取消還在跑的辨識
  useEffect(() => () => request.current?.abort(), []);

  // 換了一段錄音或面板關掉時，放掉上一段
  useEffect(() => () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
  }, [audioUrl]);

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

  // 說一句：瀏覽器能轉字就邊說邊顯示字、說完把字交給 AI；不能（iPhone 主畫面 App、LINE）就錄音交給 AI 聽。
  // 兩個不同時用麥克風，同時用的話手機上第二次會錄不到聲音
  const live = useLiveTranscript({
    maxSeconds: MAX_SECONDS,
    onDone: (heard) => run('voice', { text: heard }),
    onError: (message) => setPhase({ kind: 'error', source: 'voice', message }),
  });
  const recorder = useRecorder({
    maxSeconds: MAX_SECONDS,
    onRecorded: (audio) => {
      setAudioUrl(URL.createObjectURL(audio));
      run('voice', { file: audio });
    },
  });
  const transcribing = live.state !== 'idle';

  const startVoice = async () => {
    setPhase({ kind: 'idle' });
    setAudioUrl(null);
    // 轉字要在按下的當下開始，Safari 才會動
    if (canTranscribe()) return live.start();
    live.cancel();
    try {
      await recorder.start();
    } catch (e) {
      setPhase({ kind: 'error', source: 'voice', message: e instanceof Error ? e.message : '無法開始錄音' });
    }
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

  if (transcribing || recorder.state !== 'idle') {
    const seconds = transcribing ? live.seconds : recorder.seconds;
    const left = MAX_SECONDS - seconds;
    const listening = transcribing ? live.state === 'listening' : recorder.state === 'recording';
    const finishing = live.state === 'finishing';
    return (
      <div className="card flex flex-col gap-3 rounded-sm p-4">
        <div className="flex items-center gap-2.5 text-body">
          <span aria-hidden className="size-2.5 rounded-full bg-alert animate-[pulse_1.2s_ease-in-out_infinite] motion-reduce:animate-none" />
          {/* 只播報狀態；秒數和轉出來的字一直在變，放進 live region 會讓報讀器一直念 */}
          <span role="status">{finishing ? '收尾中…' : listening ? '聆聽中' : '準備麥克風…'}</span>
          <span aria-hidden className="num ml-auto text-body-s text-muted">{clock(seconds)}{left <= 10 ? `・剩 ${left} 秒` : ''}</span>
        </div>
        {transcribing && (
          <p aria-hidden className={`min-h-[52px] rounded-sm bg-fill px-4 py-3 leading-[1.7] ${live.text ? 'text-body' : 'text-body-s text-muted'}`}>
            {live.text || (listening ? '說吧，你說的字會出現在這裡' : '…')}
          </p>
        )}
        <p className="caption leading-[1.8]">
          {listening ? '' : '看到「聆聽中」再開口。'}說出品項、金額和付款方式，例如{example}。{transcribing ? '說完停一下就會自動整理。' : '品項只有一個字時，前面加「買」比較聽得準，例如「買蔥 19 塊」。'}
        </p>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={transcribing ? live.cancel : recorder.cancel} className="btn-secondary press">取消</button>
          <button type="button" onClick={transcribing ? live.stop : recorder.stop} disabled={finishing} autoFocus className="btn-secondary press border-primary bg-primary text-on-primary">
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
            {phase.source === 'voice' && audioUrl && <Playback src={audioUrl} />}
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
          {phase.source === 'voice' && audioUrl && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 pt-1">
              <Playback src={audioUrl} />
              <span className="caption">AI 聽錯的話，聽聽看錄得清不清楚</span>
            </div>
          )}
        </div>
        {buttons}
      </div>
    );
  }

  return buttons;
}
