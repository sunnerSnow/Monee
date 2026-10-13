'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// 瀏覽器內建的語音辨識：邊說邊顯示字，說完把字交給 AI 整理。
// 不跟錄音同時用麥克風（兩個一起用，手機上第二次會錄不到聲音）；
// 瀏覽器沒有這個功能（Firefox、LINE 內建瀏覽器、iPhone 加到主畫面的 App）就改用錄音交給 AI 聽。
interface RecognitionResult {
  readonly [index: number]: { readonly transcript: string } | undefined;
}
interface RecognitionEvent {
  readonly results: { readonly length: number; readonly [index: number]: RecognitionResult };
}
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onaudiostart: (() => void) | null;
  onresult: ((e: RecognitionEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type RecognitionCtor = new () => Recognition;

const recognitionCtor = (): RecognitionCtor | undefined => {
  if (typeof window === 'undefined') return undefined;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
};

// 這個瀏覽器轉字失敗過（沒權限、不提供服務）：重新整理前都改用錄音
let unavailable = false;

/** 可以邊說邊轉字；iPhone 加到主畫面的 App 有這個功能但不能用，直接改用錄音 */
export function canTranscribe() {
  if (unavailable || !recognitionCtor()) return false;
  return (navigator as Navigator & { standalone?: boolean }).standalone !== true;
}

// 按「說完了」後等最後的字，等太久就用目前轉出來的
const FINISH_WAIT_MS = 2000;

const ERRORS: Record<string, string> = {
  'no-speech': '沒有聽到聲音，看到「聆聽中」再開口試試',
  'audio-capture': '找不到麥克風，可以改用打字',
  network: '轉字需要網路，請檢查網路後再試，或改用打字',
};
// 這些錯誤代表這個瀏覽器不能轉字，之後改用錄音
const UNAVAILABLE = new Set(['not-allowed', 'service-not-allowed', 'language-not-supported']);

export type TranscribeState = 'idle' | 'starting' | 'listening' | 'finishing';

/**
 * 說一句：開始後邊說邊更新 text；說完（按「說完了」、停頓太久或滿 maxSeconds 秒）呼叫 onDone(轉出來的字)，
 * 沒聽到或出錯呼叫 onError(訊息)，取消則都不呼叫。
 */
export function useLiveTranscript({ maxSeconds, onDone, onError }: {
  maxSeconds: number;
  onDone: (text: string) => void;
  onError: (message: string) => void;
}) {
  const [state, setState] = useState<TranscribeState>('idle');
  const [text, setText] = useState('');
  const [seconds, setSeconds] = useState(0);
  const rec = useRef<Recognition | null>(null);
  const latest = useRef('');
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const finishTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callbacks = useRef({ onDone, onError });

  useEffect(() => {
    callbacks.current = { onDone, onError };
  }, [onDone, onError]);

  const clearTimers = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    if (finishTimer.current) clearTimeout(finishTimer.current);
    timer.current = null;
    finishTimer.current = null;
  }, []);

  /** 結束這次：放掉辨識、回到 idle；轉出來的字留著，畫面「正在整理」時還看得到 */
  const settle = useCallback((r: Recognition, error: string | null) => {
    if (rec.current !== r) return;
    rec.current = null;
    clearTimers();
    r.onresult = null;
    r.onend = null;
    r.onerror = null;
    setState('idle');
    setSeconds(0);
    const heard = latest.current;
    if (error && UNAVAILABLE.has(error)) {
      unavailable = true;
      callbacks.current.onError('這裡不能邊說邊轉字，再按一次「說一句」改用錄音');
    } else if (heard) {
      callbacks.current.onDone(heard);
    } else {
      callbacks.current.onError((error && ERRORS[error]) || '沒有聽到你說的話，看到「聆聽中」再開口試試');
    }
  }, [clearTimers]);

  const stop = useCallback(() => {
    const r = rec.current;
    if (!r) return;
    setState('finishing');
    try {
      r.stop();
    } catch {
      // 已經停了
    }
    // 有的瀏覽器停了不一定會通知，等太久就用目前轉出來的字
    if (!finishTimer.current) {
      finishTimer.current = setTimeout(() => {
        try {
          r.abort();
        } catch {
          // 已經停了
        }
        settle(r, null);
      }, FINISH_WAIT_MS);
    }
  }, [settle]);

  const start = useCallback(() => {
    const Ctor = recognitionCtor();
    if (!Ctor || rec.current) return;
    latest.current = '';
    setText('');
    setSeconds(0);
    let r: Recognition;
    try {
      r = new Ctor();
    } catch {
      unavailable = true;
      callbacks.current.onError('這裡不能邊說邊轉字，再按一次「說一句」改用錄音');
      return;
    }
    r.lang = 'zh-TW';
    // 記帳就一句話：說完停一下就自動結束（連續模式在 Android 上字會重複）
    r.continuous = false;
    r.interimResults = true;
    let error: string | null = null;
    // 麥克風真的開始收音才顯示「聆聽中」、開始計時（沒有 audiostart 的瀏覽器，第一次出字時算）
    const begin = () => {
      if (rec.current !== r || timer.current) return;
      setState((s) => (s === 'starting' ? 'listening' : s));
      let elapsed = 0;
      timer.current = setInterval(() => {
        elapsed += 1;
        setSeconds(elapsed);
        if (elapsed >= maxSeconds) stop();
      }, 1000);
    };
    r.onaudiostart = begin;
    r.onresult = (e) => {
      begin();
      let t = '';
      for (let i = 0; i < e.results.length; i++) t += e.results[i][0]?.transcript ?? '';
      latest.current = t.trim();
      setText(latest.current);
    };
    r.onerror = (e) => {
      error = e.error;
    };
    // 說完停頓太久，瀏覽器會自己結束：當作說完了
    r.onend = () => settle(r, error === 'aborted' ? null : error);
    rec.current = r;
    setState('starting');
    try {
      r.start();
    } catch {
      rec.current = null;
      setState('idle');
      unavailable = true;
      callbacks.current.onError('這裡不能邊說邊轉字，再按一次「說一句」改用錄音');
    }
  }, [maxSeconds, settle, stop]);

  const cancel = useCallback(() => {
    const r = rec.current;
    rec.current = null;
    clearTimers();
    latest.current = '';
    setText('');
    setSeconds(0);
    setState('idle');
    if (!r) return;
    r.onresult = null;
    r.onend = null;
    r.onerror = null;
    try {
      r.abort();
    } catch {
      // 已經停了
    }
  }, [clearTimers]);

  // 面板關掉時一定要停，不然手機會一直在聽
  useEffect(() => () => {
    const r = rec.current;
    rec.current = null;
    if (timer.current) clearInterval(timer.current);
    if (finishTimer.current) clearTimeout(finishTimer.current);
    if (!r) return;
    r.onresult = null;
    r.onend = null;
    r.onerror = null;
    try {
      r.abort();
    } catch {
      // 已經停了
    }
  }, []);

  return { state, text, seconds, start, stop, cancel };
}
