'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type RecorderState = 'idle' | 'starting' | 'recording';

// 依序挑瀏覽器支援的格式：Chrome／Edge 是 webm，Safari 是 mp4，Firefox 是 ogg；三種 Gemini 都聽得懂
const MIME_TYPES = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg;codecs=opus'];
// 按「說完了」後多錄一下，最後一個字才不會被切掉
const TAIL_MS = 300;

export const canRecord = () =>
  typeof window !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia) && typeof MediaRecorder !== 'undefined';

interface Session {
  recorder: MediaRecorder;
  stream: MediaStream;
  timer: ReturnType<typeof setInterval> | null;
  tail: ReturnType<typeof setTimeout> | null;
  /** 音量條：每 0.1 秒量一次 */
  meter: ReturnType<typeof setInterval> | null;
  audio: AudioContext | null;
  discard: boolean;
}

/** 放掉麥克風、停掉計時和音量條 */
function release(s: Pick<Session, 'stream' | 'timer' | 'tail' | 'meter' | 'audio'>) {
  if (s.timer) clearInterval(s.timer);
  if (s.tail) clearTimeout(s.tail);
  if (s.meter) clearInterval(s.meter);
  s.audio?.close().catch(() => {});
  s.stream.getTracks().forEach((t) => t.stop());
}

/**
 * 錄一小段語音；按完成或錄滿 maxSeconds 秒時呼叫 onRecorded，取消則不呼叫。
 * level 是目前音量（0～1），畫面用來顯示音量條，讓人知道有收到聲音。
 */
export function useRecorder({ maxSeconds, onRecorded }: { maxSeconds: number; onRecorded: (audio: Blob) => void }) {
  const [state, setState] = useState<RecorderState>('idle');
  const [seconds, setSeconds] = useState(0);
  const [level, setLevel] = useState(0);
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
    if (s.recorder.state === 'inactive') return;
    if (discard) {
      s.recorder.stop();
    } else if (!s.tail) {
      s.tail = setTimeout(() => {
        if (s.recorder.state !== 'inactive') s.recorder.stop();
      }, TAIL_MS);
    }
  }, []);

  /** 開始錄音；真的開始了回傳 true，還在等權限時就取消或面板關掉則回傳 false */
  const start = useCallback(async () => {
    if (session.current || starting.current) return false;
    starting.current = true;
    abortStart.current = false;
    setState('starting');
    // 音量條用的 AudioContext 要在按下的當下建立，iPhone 才會動；不支援就不顯示音量
    let audio: AudioContext | null = null;
    try {
      audio = new AudioContext();
    } catch {
      audio = null;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch (e) {
      starting.current = false;
      audio?.close().catch(() => {});
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
      release({ stream, timer: null, tail: null, meter: null, audio });
      if (alive.current) setState('idle');
      return false;
    }

    const mimeType = MIME_TYPES.find((t) => MediaRecorder.isTypeSupported(t));
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType, audioBitsPerSecond: 32_000 } : undefined);
    const chunks: Blob[] = [];
    const s: Session = { recorder, stream, timer: null, tail: null, meter: null, audio, discard: false };
    session.current = s;

    if (audio) {
      try {
        const analyser = audio.createAnalyser();
        analyser.fftSize = 512;
        audio.createMediaStreamSource(stream).connect(analyser);
        const samples = new Uint8Array(analyser.fftSize);
        s.meter = setInterval(() => {
          analyser.getByteTimeDomainData(samples);
          let sum = 0;
          for (const v of samples) sum += ((v - 128) / 128) ** 2;
          // 說話的音量大約 0.02～0.2，放大到 0～1 比較好看出變化
          setLevel(Math.min(1, Math.sqrt(sum / samples.length) * 5));
        }, 100);
      } catch {
        // 量不到音量就不顯示，錄音照常
      }
    }

    // 真的開始錄了才顯示「聆聽中」、開始計時；手機開麥克風要一點時間，太早開口第一個字會被切掉
    recorder.onstart = () => {
      if (!alive.current || session.current !== s) return;
      let elapsed = 0;
      s.timer = setInterval(() => {
        elapsed += 1;
        setSeconds(elapsed);
        if (elapsed >= maxSeconds) finish(false);
      }, 1000);
      setState('recording');
    };
    recorder.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data);
    };
    recorder.onstop = () => {
      release(s);
      session.current = null;
      if (!alive.current) return;
      setState('idle');
      setSeconds(0);
      setLevel(0);
      if (!s.discard && chunks.length) onRecordedRef.current(new Blob(chunks, { type: recorder.mimeType || mimeType || 'audio/webm' }));
    };
    setSeconds(0);
    setLevel(0);
    recorder.start();
    return true;
  }, [finish, maxSeconds]);

  // 面板關掉時一定要放掉麥克風，不然手機上方的錄音指示會一直亮著
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      const s = session.current;
      if (!s) return;
      s.discard = true;
      if (s.recorder.state !== 'inactive') s.recorder.stop();
      release(s);
    };
  }, []);

  return { state, seconds, level, start, stop: () => finish(false), cancel: () => finish(true) };
}
