import { describe, expect, it } from 'vitest';
import { createVad, encodeWav, rms } from './voice-capture';

const tone = (n: number, amp: number) => Float32Array.from({ length: n }, (_, i) => amp * Math.sin(i / 5));

describe('rms', () => {
  it('安靜是 0，大聲比較大', () => {
    expect(rms(new Float32Array(100))).toBe(0);
    expect(rms(tone(1000, 0.5))).toBeGreaterThan(rms(tone(1000, 0.1)));
    expect(rms(new Float32Array(0))).toBe(0);
  });
});

describe('createVad', () => {
  /** 每段 50 毫秒，照順序餵音量，回傳有發生的事 */
  const feed = (vad: ReturnType<typeof createVad>, levels: number[]) => levels.map((l) => vad.push(l, 50)).filter(Boolean);
  const quiet = (n: number) => Array(n).fill(0.003);
  const loud = (n: number) => Array(n).fill(0.08);

  it('先安靜、開口、說完停頓：speech 然後 done', () => {
    const vad = createVad({ silenceMs: 1300 });
    expect(feed(vad, [...quiet(10), ...loud(20), ...quiet(30)])).toEqual(['speech', 'done']);
  });

  it('句中短暫停頓不算說完', () => {
    const vad = createVad({ silenceMs: 1300 });
    expect(feed(vad, [...quiet(10), ...loud(10), ...quiet(10), ...loud(10)])).toEqual(['speech']);
    expect(vad.speaking).toBe(true);
  });

  it('一直說很久（10 秒）也不會被當成說完', () => {
    const vad = createVad({ silenceMs: 1300 });
    expect(feed(vad, [...quiet(10), ...loud(200)])).toEqual(['speech']);
    expect(feed(vad, quiet(30))).toEqual(['done']);
  });

  it('一直沒說話：no-speech', () => {
    const vad = createVad({ noSpeechMs: 8000 });
    expect(feed(vad, quiet(200))).toEqual(['no-speech']);
  });

  it('環境比較吵：底噪跟著拉高，吵雜聲不算開口', () => {
    const vad = createVad();
    const noisy = Array(60).fill(0.03);
    expect(feed(vad, noisy)).toEqual([]);
    expect(feed(vad, Array(10).fill(0.2))).toEqual(['speech']);
  });

  it('結束後就不再回報', () => {
    const vad = createVad({ noSpeechMs: 100 });
    expect(feed(vad, [...quiet(5), ...loud(20)])).toEqual(['no-speech']);
  });
});

describe('encodeWav', () => {
  it('16kHz 單聲道 16-bit 的 WAV 檔頭，長度照降取樣算', async () => {
    const blob = encodeWav([tone(24_000, 0.5), tone(24_000, 0.5)], 48_000);
    expect(blob.type).toBe('audio/wav');
    const view = new DataView(await blob.arrayBuffer());
    const str = (at: number, n: number) => String.fromCharCode(...Array.from({ length: n }, (_, i) => view.getUint8(at + i)));
    expect(str(0, 4)).toBe('RIFF');
    expect(str(8, 4)).toBe('WAVE');
    expect(view.getUint16(22, true)).toBe(1);
    expect(view.getUint32(24, true)).toBe(16_000);
    expect(view.getUint16(34, true)).toBe(16);
    expect(view.getUint32(40, true)).toBe(16_000 * 2); // 1 秒
    expect(blob.size).toBe(44 + 32_000);
  });

  it('44.1kHz 這種除不盡的也可以；聲音不會爆音', async () => {
    const blob = encodeWav([tone(44_100, 1.5)], 44_100);
    const view = new DataView(await blob.arrayBuffer());
    expect(view.getUint32(40, true)).toBe(16_000 * 2);
    for (let i = 44; i < blob.size; i += 2) expect(Math.abs(view.getInt16(i, true))).toBeLessThanOrEqual(0x8000);
  });
});
