'use client';

import { Camera, Keyboard, Mic, Play, Sparkles, Square, X } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent, type RefObject } from 'react';
import { flushSync } from 'react-dom';
import { requestDraft, shrinkImage } from '@/lib/ai-client';
import type { AiDraftTransaction, DraftContext, DraftSource } from '@/lib/ai-draft';
import type { Account } from '@/lib/types';
import { canListen, useVoice } from '@/lib/use-voice';

import { Mascot } from '../Mascot';
const MAX_SECONDS = 30;
const LOW_CONFIDENCE = 0.7;
const BARS = 28;

type Phase =
  | { kind: 'idle' }
  | { kind: 'typing' }
  | { kind: 'working'; source: DraftSource }
  | { kind: 'done'; source: DraftSource; draft: AiDraftTransaction; note?: string }
  | { kind: 'error'; source: DraftSource; message: string };

const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

/** 聲音波形：最近一秒多的音量從右邊流進來，跟著說話跳動；直接改樣式，不經過 React 重畫 */
function Waveform({ level }: { level: RefObject<number> }) {
  const bars = useRef<(HTMLSpanElement | null)[]>([]);
  useEffect(() => {
    const history: number[] = Array(BARS).fill(0);
    let frame = 0;
    let last = 0;
    const tick = (t: number) => {
      frame = requestAnimationFrame(tick);
      if (t - last < 50) return;
      last = t;
      history.shift();
      // 說話的音量大多在 0.01～0.2，開根號放大小聲的部分，看得出有在收音
      history.push(Math.min(1, Math.sqrt(level.current ?? 0) * 2.2));
      history.forEach((v, i) => {
        const bar = bars.current[i];
        if (bar) bar.style.transform = `scaleY(${Math.max(0.08, v)})`;
      });
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [level]);
  return (
    <div aria-hidden className="flex h-14 items-center justify-center gap-[3px] rounded-sm bg-fill px-3">
      {Array.from({ length: BARS }, (_, i) => (
        <span
          key={i}
          ref={(el) => { bars.current[i] = el; }}
          className="h-10 w-[5px] origin-center rounded-full border border-ink bg-teal"
          style={{ transform: 'scaleY(0.08)' }}
        />
      ))}
    </div>
  );
}

/** 聽剛剛的錄音：AI 聽錯時，先確認錄到的聲音清不清楚 */
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
 * 說一句：波形跟著聲音跳動，說完停一下自動結束，錄音交給 AI 聽；聽錯可以重聽錄音、改用打字。
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
  const [voiceOk] = useState(canListen);
  // 上一段錄音，可以重聽
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  // 等麥克風等比較久：提示可能要按「允許」
  const [slowStart, setSlowStart] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const textInput = useRef<HTMLInputElement>(null);
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

  const voice = useVoice({
    maxSeconds: MAX_SECONDS,
    onDone: (wav) => {
      setAudioUrl(URL.createObjectURL(wav));
      run('voice', { file: wav });
    },
    onError: (message) => setPhase({ kind: 'error', source: 'voice', message }),
  });

  useEffect(() => {
    if (voice.state !== 'starting') return;
    const t = setTimeout(() => setSlowStart(true), 2500);
    return () => {
      clearTimeout(t);
      setSlowStart(false);
    };
  }, [voice.state]);

  // 要在 click 裡直接開始（前面不能有 await），iPhone 才肯打開聲音
  const startVoice = () => {
    setPhase({ kind: 'idle' });
    setAudioUrl(null);
    voice.start();
  };

  // 輸入框要在按下的當下就畫出來並拿到焦點，iPhone 才會跳出鍵盤
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

  const retry = (source: DraftSource) => {
    if (source === 'voice') return startVoice();
    if (source === 'receipt') return pickReceipt();
    openTyping();
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

  if (voice.state !== 'idle') {
    const listening = voice.state === 'listening';
    const finishing = voice.state === 'finishing';
    const left = MAX_SECONDS - voice.seconds;
    const status = finishing ? '收尾中…' : listening ? (voice.speaking ? '有聽到，繼續說' : '聆聽中，請說') : '準備麥克風…';
    return (
      <div className="card flex flex-col gap-3 rounded-sm p-4">
        <div className="flex items-center gap-2.5 text-body">
          <span aria-hidden className={`size-2.5 rounded-full ${listening ? 'bg-alert animate-[pulse_1.2s_ease-in-out_infinite] motion-reduce:animate-none' : 'bg-dash'}`} />
          {/* 只播報狀態；秒數一直在變，放進 live region 會讓報讀器一直念 */}
          <span role="status">{status}</span>
          <span aria-hidden className="num ml-auto text-body-s text-muted">{clock(voice.seconds)}{left <= 10 ? `・剩 ${left} 秒` : ''}</span>
        </div>
        <Waveform level={voice.level} />
        <p className="caption leading-[1.8]">
          {voice.state === 'starting'
            ? slowStart ? '如果有跳出「要使用麥克風」的詢問，請按「允許」。' : '準備好麥克風就可以說了。'
            : `說出品項、金額和付款方式，例如${example}。說完停一下就會自動整理。`}
        </p>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={voice.cancel} className="btn-secondary press">取消</button>
          <button type="button" onClick={voice.stop} disabled={finishing || !listening} autoFocus className="btn-secondary press border-primary bg-primary text-on-primary">
            說完了
          </button>
        </div>
      </div>
    );
  }

  if (phase.kind === 'working') {
    return (
      <div role="status" aria-live="polite" className="card flex items-center gap-3 rounded-sm py-3 pr-2 pl-4">
        <Mascot className="w-11 flex-none motion-safe:animate-[wiggle_1s_ease-in-out_infinite]" />
        <span className="line-clamp-2 min-w-0 text-body-s">
          Monee 正在{phase.source === 'voice' ? '聽你說的話' : phase.source === 'receipt' ? '整理收據' : `整理「${text.trim()}」`}…
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
            ref={textInput}
            id="ai-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={300}
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
        <button type="button" onClick={openTyping} className="btn-secondary press">
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
              <button type="button" onClick={openTyping} className="btn-secondary press">改用打字</button>
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
