'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// 瀏覽器內建的語音辨識：錄音時邊說邊顯示字，讓人知道有在聽。
// Chrome、Android、Safari 有；Firefox、LINE 內建瀏覽器、iPhone 加到主畫面的 App 沒有或不能用，就不顯示字，錄音照常。
// 真正整理還是交給 Gemini 聽錄音，轉出來的字一起送過去當參考。
interface RecognitionResult {
  readonly isFinal: boolean;
  readonly [index: number]: { readonly transcript: string } | undefined;
}
interface RecognitionEvent {
  readonly results: { readonly length: number; readonly [index: number]: RecognitionResult };
}
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
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

// 按「說完了」後最多等這麼久拿最後的字，等不到就用目前轉出來的
const FINISH_WAIT_MS = 1200;

export type LiveStatus = 'off' | 'listening' | 'failed';

export function useLiveTranscript() {
  const [text, setText] = useState('');
  const [status, setStatus] = useState<LiveStatus>('off');
  const rec = useRef<Recognition | null>(null);
  const ended = useRef<Promise<void> | null>(null);
  const latest = useRef('');

  const start = useCallback(() => {
    const Ctor = recognitionCtor();
    latest.current = '';
    setText('');
    if (!Ctor || rec.current) return setStatus('off');
    let r: Recognition;
    try {
      r = new Ctor();
    } catch {
      return setStatus('failed');
    }
    r.lang = 'zh-TW';
    r.continuous = true;
    r.interimResults = true;
    r.onresult = (e) => {
      let t = '';
      for (let i = 0; i < e.results.length; i++) t += e.results[i][0]?.transcript ?? '';
      latest.current = t.trim();
      setText(latest.current);
    };
    // 沒權限、iPhone 主畫面 App、沒網路…就不顯示字；沒聽到聲音（no-speech）不算失敗
    r.onerror = (e) => {
      if (e.error !== 'no-speech' && e.error !== 'aborted') setStatus('failed');
    };
    ended.current = new Promise((resolve) => {
      r.onend = () => {
        if (rec.current === r) rec.current = null;
        resolve();
      };
    });
    rec.current = r;
    setStatus('listening');
    try {
      r.start();
    } catch {
      rec.current = null;
      ended.current = null;
      setStatus('failed');
    }
  }, []);

  /** 不再聽，最後的字會在 finish() 拿到 */
  const stop = useCallback(() => {
    try {
      rec.current?.stop();
    } catch {
      // 已經停了
    }
  }, []);

  /** 停止並拿最後轉出來的字（最多等 1.2 秒）；沒有字就回傳空字串 */
  const finish = useCallback(async () => {
    stop();
    if (ended.current) await Promise.race([ended.current, new Promise((resolve) => setTimeout(resolve, FINISH_WAIT_MS))]);
    ended.current = null;
    return latest.current;
  }, [stop]);

  const cancel = useCallback(() => {
    const r = rec.current;
    rec.current = null;
    ended.current = null;
    latest.current = '';
    setText('');
    setStatus('off');
    if (!r) return;
    r.onresult = null;
    try {
      r.abort();
    } catch {
      // 已經停了
    }
  }, []);

  // 面板關掉時一定要停，不然手機會一直在聽
  useEffect(() => () => {
    const r = rec.current;
    rec.current = null;
    if (!r) return;
    r.onresult = null;
    try {
      r.abort();
    } catch {
      // 已經停了
    }
  }, []);

  return { text, status, start, stop, finish, cancel };
}
