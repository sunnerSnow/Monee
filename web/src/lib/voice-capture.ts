// 說一句的錄音：音量、判斷有沒有在說話、存成 WAV（純函式，有測試）。
// 不用 MediaRecorder（iPhone 加到主畫面的 App 上常常錄不到或卡住）：Web Audio 直接拿到聲音，自己存成 Gemini 官方支援的 WAV。

/** 一段聲音的音量（RMS，0～1） */
export function rms(samples: Float32Array) {
  let sum = 0;
  for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
  return samples.length ? Math.sqrt(sum / samples.length) : 0;
}

export type VadEvent = 'speech' | 'done' | 'no-speech' | null;

/**
 * 判斷有沒有在說話：先抓環境的底噪，比底噪大很多就是在說話；
 * 說過話之後安靜超過 silenceMs 就算說完（done），一開始一直沒說話超過 noSpeechMs 就是沒聽到（no-speech）。
 * push(音量, 這段幾毫秒)，有事情發生才回傳，其他時候是 null
 */
export function createVad({ silenceMs = 1300, noSpeechMs = 8000, minLevel = 0.012 } = {}) {
  let floor = Infinity;
  let elapsed = 0;
  let loud = 0;
  let quiet = 0;
  let speaking = false;
  let ended = false;
  return {
    get speaking() {
      return speaking;
    },
    push(level: number, ms: number): VadEvent {
      if (ended) return null;
      elapsed += ms;
      // 底噪：安靜時的音量，馬上往下追；還沒開口前才慢慢往上追（開口後還追的話，說久了自己的聲音會被當成底噪）
      if (level < floor) floor = level;
      else if (!speaking) floor += (level - floor) * 0.02;
      const threshold = Math.max(minLevel, floor * 3);
      if (!speaking) {
        loud = level > threshold ? loud + ms : 0;
        if (loud >= 120) {
          speaking = true;
          quiet = 0;
          return 'speech';
        }
        if (elapsed >= noSpeechMs) {
          ended = true;
          return 'no-speech';
        }
        return null;
      }
      quiet = level > threshold * 0.7 ? 0 : quiet + ms;
      if (quiet >= silenceMs) {
        ended = true;
        return 'done';
      }
      return null;
    },
  };
}

/**
 * 錄到的聲音（一段一段的 Float32）轉成 16kHz 單聲道 16-bit 的 WAV：說話用 16kHz 就夠清楚，檔案小、上傳快（10 秒約 320KB）。
 * 降取樣時把每個輸出點涵蓋的輸入平均起來，避免高頻雜音折回來。
 */
export function encodeWav(chunks: Float32Array[], inRate: number, outRate = 16_000) {
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const input = new Float32Array(total);
  let offset = 0;
  for (const c of chunks) {
    input.set(c, offset);
    offset += c.length;
  }
  const ratio = inRate / outRate;
  const outLen = Math.floor(total / ratio);
  const buffer = new ArrayBuffer(44 + outLen * 2);
  const view = new DataView(buffer);
  const text = (at: number, s: string) => [...s].forEach((ch, i) => view.setUint8(at + i, ch.charCodeAt(0)));
  text(0, 'RIFF');
  view.setUint32(4, 36 + outLen * 2, true);
  text(8, 'WAVE');
  text(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // 單聲道
  view.setUint32(24, outRate, true);
  view.setUint32(28, outRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, 'data');
  view.setUint32(40, outLen * 2, true);
  for (let i = 0; i < outLen; i++) {
    const from = Math.floor(i * ratio);
    const to = Math.max(from + 1, Math.floor((i + 1) * ratio));
    let sum = 0;
    for (let j = from; j < to && j < total; j++) sum += input[j];
    const v = Math.max(-1, Math.min(1, sum / (to - from)));
    view.setInt16(44 + i * 2, v < 0 ? v * 0x8000 : v * 0x7fff, true);
  }
  return new Blob([buffer], { type: 'audio/wav' });
}
