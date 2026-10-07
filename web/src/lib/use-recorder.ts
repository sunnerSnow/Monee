'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type RecorderState = 'idle' | 'starting' | 'recording';

// 依序挑瀏覽器支援的格式：Chrome／Edge 是 webm，Safari 是 mp4，Firefox 是 ogg；三種 Gemini 都聽得懂
const MIME_TYPES = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg;codecs=opus'];

export const canRecord = () =>
  typeof window !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia) && typeof MediaRecorder !== 'undefined';

interface Session {
  recorder: MediaRecorder;
  stream: MediaStream;
  timer: ReturnType<typeof setInterval>;
  discard: boolean;
}

/** 錄一小段語音；按完成或錄滿 maxSeconds 秒時呼叫 onRecorded，取消則不呼叫 */
export function useRecorder({ maxSeconds, onRecorded }: { maxSeconds: number; onRecorded: (audio: Blob) => void }) {
  const [state, setState] = useState<RecorderState>('idle');
  const [seconds, setSeconds] = useState(0);
  const session = useRef<Session | null>(null);
  const starting = useRef(false);
  const abortStart = useRef(false);
  const alive = useRef(true);
  const onRecordedRef = useRef(onRecorded);

  useEffect(() => {
    onRecordedRef.current = onRecorded;
  }, [onRecorded]);

  const finish = useCallback((discard: boolean) => {
    const s = session.current;
    // 還在等麥克風權限就按了完成或取消：等權限回來後直接放棄這次錄音
    if (!s) {
      if (starting.current) abortStart.current = true;
      return;
    }
    s.discard = discard;
    if (s.recorder.state !== 'inactive') s.recorder.stop();
  }, []);

  const start = useCallback(async () => {
    if (session.current || starting.current) return;
    starting.current = true;
    abortStart.current = false;
    setState('starting');
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch (e) {
      starting.current = false;
      setState('idle');
      const name = e instanceof DOMException ? e.name : '';
      throw new Error(
        name === 'NotAllowedError' ? '沒有麥克風權限。請在瀏覽器的網站設定允許 Monee 使用麥克風，或改用打字'
          : name === 'NotFoundError' ? '找不到麥克風，可以改用打字'
            : '無法開始錄音，可以改用打字',
      );
    }
    starting.current = false;
    // 等使用者按允許的期間面板已經關掉、或已經按了取消，就不要開始錄
    if (!alive.current || abortStart.current) {
      stream.getTracks().forEach((t) => t.stop());
      if (alive.current) setState('idle');
      return;
    }

    const mimeType = MIME_TYPES.find((t) => MediaRecorder.isTypeSupported(t));
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType, audioBitsPerSecond: 32_000 } : undefined);
    const chunks: Blob[] = [];
    let elapsed = 0;
    const timer = setInterval(() => {
      elapsed += 1;
      setSeconds(elapsed);
      if (elapsed >= maxSeconds) finish(false);
    }, 1000);
    const s: Session = { recorder, stream, timer, discard: false };
    session.current = s;

    recorder.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data);
    };
    recorder.onstop = () => {
      clearInterval(timer);
      stream.getTracks().forEach((t) => t.stop());
      session.current = null;
      setState('idle');
      setSeconds(0);
      if (!s.discard && chunks.length) onRecordedRef.current(new Blob(chunks, { type: recorder.mimeType || mimeType || 'audio/webm' }));
    };
    recorder.start();
    setSeconds(0);
    setState('recording');
  }, [finish, maxSeconds]);

  // 面板關掉時一定要放掉麥克風，不然手機上方的錄音指示會一直亮著
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      const s = session.current;
      if (!s) return;
      s.discard = true;
      clearInterval(s.timer);
      if (s.recorder.state !== 'inactive') s.recorder.stop();
      s.stream.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return { state, seconds, start, stop: () => finish(false), cancel: () => finish(true) };
}
