'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createVad, encodeWav, rms } from './voice-capture';

// 說一句：Web Audio 直接收麥克風的聲音（不用 MediaRecorder、也不用瀏覽器的語音辨識，這兩個在 iPhone 主畫面的 App 上常卡住），
// 邊收邊算音量給波形用，說完停一下自動結束，存成 WAV 交給 AI 聽。每個可能卡住的地方都有時間限制，不會停在原地。

export type VoiceState = 'idle' | 'starting' | 'listening' | 'finishing';

type AudioCtor = typeof AudioContext;
const audioCtor = (): AudioCtor | undefined =>
  typeof window === 'undefined' ? undefined : window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioCtor }).webkitAudioContext;

export const canListen = () => typeof window !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia) && Boolean(audioCtor());

const BUFFER = 2048;
// 按「說完了」或自動結束後多收一下，最後一個字才不會被切掉
const TAIL_MS = 250;
// 拿到麥克風後這麼久都沒有聲音資料進來，就當作卡住
const NO_AUDIO_MS = 4000;

interface Session {
  ctx: AudioContext;
  stream: MediaStream | null;
  source: MediaStreamAudioSourceNode | null;
  proc: ScriptProcessorNode | null;
  chunks: Float32Array[];
  timer: ReturnType<typeof setInterval> | null;
  watchdog: ReturnType<typeof setTimeout> | null;
  tail: ReturnType<typeof setTimeout> | null;
}

function teardown(s: Session) {
  if (s.timer) clearInterval(s.timer);
  if (s.watchdog) clearTimeout(s.watchdog);
  if (s.tail) clearTimeout(s.tail);
  if (s.proc) s.proc.onaudioprocess = null;
  s.proc?.disconnect();
  s.source?.disconnect();
  // 一定要放掉麥克風，不然手機上方的錄音指示會一直亮著
  s.stream?.getTracks().forEach((t) => t.stop());
  s.ctx.close().catch(() => {});
}

/** 說完（按「說完了」、停頓、或滿 maxSeconds 秒）呼叫 onDone(WAV)；沒聽到或出錯呼叫 onError(訊息)；取消都不呼叫 */
export function useVoice({ maxSeconds, onDone, onError }: {
  maxSeconds: number;
  onDone: (wav: Blob) => void;
  onError: (message: string) => void;
}) {
  const [state, setState] = useState<VoiceState>('idle');
  const [seconds, setSeconds] = useState(0);
  const [speaking, setSpeaking] = useState(false);
  /** 目前的音量（0～1）：波形自己定時來讀，不經過 React 重畫 */
  const level = useRef(0);
  const session = useRef<Session | null>(null);
  const callbacks = useRef({ onDone, onError });

  useEffect(() => {
    callbacks.current = { onDone, onError };
  }, [onDone, onError]);

  /** 結束這次：audio 交出錄音、error 給訊息、null 是取消 */
  const end = useCallback((s: Session, result: 'audio' | { error: string } | null) => {
    if (session.current !== s) return;
    session.current = null;
    const rate = s.ctx.sampleRate;
    teardown(s);
    level.current = 0;
    setState('idle');
    setSeconds(0);
    setSpeaking(false);
    if (!result) return;
    if (result !== 'audio') return callbacks.current.onError(result.error);
    if (!s.chunks.length) return callbacks.current.onError('沒有收到聲音，再說一次試試');
    callbacks.current.onDone(encodeWav(s.chunks, rate));
  }, []);

  const stop = useCallback(() => {
    const s = session.current;
    if (!s) return;
    // 還在等麥克風（例如權限詢問還沒按）就按了：當作取消
    if (!s.proc) return end(s, null);
    setState('finishing');
    if (!s.tail) s.tail = setTimeout(() => end(s, 'audio'), TAIL_MS);
  }, [end]);

  /** 要在按鈕的 click 裡直接呼叫（前面不能有 await）：iPhone 只有這時候才肯打開聲音 */
  const start = useCallback(() => {
    if (session.current) return;
    const Ctor = audioCtor();
    if (!Ctor || !navigator.mediaDevices?.getUserMedia) return callbacks.current.onError('這裡不能錄音，可以改用打字');
    let ctx: AudioContext;
    try {
      ctx = new Ctor();
    } catch {
      return callbacks.current.onError('無法開始錄音，可以改用打字');
    }
    void ctx.resume().catch(() => {});
    const s: Session = { ctx, stream: null, source: null, proc: null, chunks: [], timer: null, watchdog: null, tail: null };
    session.current = s;
    level.current = 0;
    setSeconds(0);
    setSpeaking(false);
    setState('starting');

    navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } }).then((stream) => {
      // 等權限的時候已經取消或關掉面板
      if (session.current !== s) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      s.stream = stream;
      const source = ctx.createMediaStreamSource(stream);
      const proc = ctx.createScriptProcessor(BUFFER, 1, 1);
      s.source = source;
      s.proc = proc;
      const vad = createVad();
      const bufferMs = (BUFFER / ctx.sampleRate) * 1000;
      proc.onaudioprocess = (e) => {
        if (session.current !== s) return;
        const data = e.inputBuffer.getChannelData(0);
        s.chunks.push(new Float32Array(data));
        const l = rms(data);
        level.current = l;
        // 真的有聲音進來才顯示「聆聽中」、開始計時
        if (!s.timer) {
          if (s.watchdog) clearTimeout(s.watchdog);
          s.watchdog = null;
          setState('listening');
          let elapsed = 0;
          s.timer = setInterval(() => {
            elapsed += 1;
            setSeconds(elapsed);
            if (elapsed >= maxSeconds) stop();
          }, 1000);
        }
        if (s.tail) return;
        const event = vad.push(l, bufferMs);
        if (event === 'speech') setSpeaking(true);
        else if (event === 'done') stop();
        else if (event === 'no-speech') end(s, { error: '沒有聽到聲音。看到波形跟著你的聲音跳動再說，或改用打字' });
      };
      source.connect(proc);
      // ScriptProcessor 要接到輸出才會動；它輸出的是靜音，喇叭不會有聲音
      proc.connect(ctx.destination);
      void ctx.resume().catch(() => {});
      s.watchdog = setTimeout(() => end(s, { error: '麥克風沒有聲音進來。把 App 完全關掉再打開試試，或改用打字' }), NO_AUDIO_MS);
    }).catch((e: unknown) => {
      const name = e instanceof DOMException ? e.name : '';
      end(s, {
        error: name === 'NotAllowedError' ? '沒有麥克風權限。到手機的「設定 → Safari → 麥克風」允許 Monee，或改用打字'
          : name === 'NotFoundError' ? '找不到麥克風，可以改用打字'
            : '無法開始錄音，可以改用打字',
      });
    });
  }, [end, maxSeconds, stop]);

  const cancel = useCallback(() => {
    const s = session.current;
    if (s) end(s, null);
  }, [end]);

  // 面板關掉時一定要停
  useEffect(() => () => {
    const s = session.current;
    session.current = null;
    if (s) teardown(s);
  }, []);

  return { state, seconds, speaking, level, start, stop, cancel };
}
