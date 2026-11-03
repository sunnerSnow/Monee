'use client';

import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from 'react';

export interface StorySlide {
  key: string;
  /** 報讀用的標題 */
  label: string;
  /** 背景色（tokens 的角色色） */
  bg: string;
  /** 黑底的那張：字和進度條改成米白 */
  dark?: boolean;
  content: ReactNode;
}

const CLOSE_HREF = '/reports';

/** 整個畫面蓋住（底部導覽也蓋住）的外框：年度回顧的載入中、沒資料、限時動態都用它 */
export function StoryFrame({ bg = 'var(--yellow)', dark = false, label, children, top }: {
  bg?: string;
  dark?: boolean;
  label: string;
  children: ReactNode;
  top?: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-30 flex justify-center bg-ink">
      <section
        aria-label={label}
        className={`relative flex h-full w-full max-w-[480px] flex-col overflow-hidden ${dark ? 'text-[#F7F3E8]' : 'sticker'}`}
        style={{
          ...(dark ? { '--text': '#F7F3E8', '--text-2': '#BDB9AE' } : {}),
          backgroundColor: bg,
          backgroundImage: `radial-gradient(${dark ? 'rgba(247, 243, 232, .1)' : 'rgba(26, 26, 30, .12)'} 1.3px, transparent 1.5px)`,
          backgroundSize: '16px 16px',
        } as CSSProperties}
      >
        <div className="relative z-10 flex flex-col gap-3 px-4 pt-[max(12px,env(safe-area-inset-top))]">
          {top}
          <div className="flex justify-end">
            <Link href={CLOSE_HREF} aria-label="關閉年度回顧" className="icon-btn press">
              <X size={20} strokeWidth={2} aria-hidden />
            </Link>
          </div>
        </div>
        {children}
      </section>
    </div>
  );
}

/** 按鈕、連結上的點擊不算換頁 */
const interactive = (t: EventTarget | null) => t instanceof Element && Boolean(t.closest('a, button, input, label, [data-no-nav]'));

/**
 * 限時動態：點右邊、往左滑、按 → 看下一張；點左邊、往右滑、按 ← 回上一張；Esc 關掉。
 * 不自動換頁，數字讓人慢慢看。
 */
export function Story({ slides }: { slides: StorySlide[] }) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const start = useRef<{ x: number; y: number } | null>(null);
  const last = slides.length - 1;
  const i = Math.min(index, last);
  const go = (n: number) => setIndex(Math.max(0, Math.min(last, n)));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') setIndex((n) => Math.min(last, n + 1));
      else if (e.key === 'ArrowLeft') setIndex((n) => Math.max(0, n - 1));
      else if (e.key === 'Escape') router.push(CLOSE_HREF);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [last, router]);

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    start.current = interactive(e.target) ? null : { x: e.clientX, y: e.clientY };
  };
  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    const s = start.current;
    start.current = null;
    if (!s) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) return go(dx < 0 ? i + 1 : i - 1);
    // 往上下拖是在捲內容，不換頁
    if (Math.abs(dx) > 10 || Math.abs(dy) > 10) return;
    const { left, width } = e.currentTarget.getBoundingClientRect();
    go(e.clientX - left < width / 3 ? i - 1 : i + 1);
  };

  const slide = slides[i];
  const bar = slide.dark ? 'border-[#F7F3E8]' : 'border-ink';
  return (
    <StoryFrame
      bg={slide.bg}
      dark={slide.dark}
      label="年度回顧"
      top={(
        <ol aria-hidden className="flex gap-1">
          {slides.map((s, n) => (
            <li key={s.key} className={`h-1.5 flex-1 rounded-full border ${bar} ${n <= i ? (slide.dark ? 'bg-[#F7F3E8]' : 'bg-ink') : 'bg-transparent'}`} />
          ))}
        </ol>
      )}
    >
      <p className="sr-only" aria-live="polite">第 {i + 1} 張，共 {slides.length} 張：{slide.label}</p>
      <div
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => { start.current = null; }}
        // 左右滑交給這裡處理，上下滑照常捲動
        className="flex min-h-0 flex-1 touch-pan-y flex-col"
      >
        <div key={slide.key} className="story-in flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 pt-2 pb-4">
          {slide.content}
        </div>
        <div className="flex items-center justify-between px-4 pb-[max(16px,env(safe-area-inset-bottom))]">
          <button type="button" onClick={() => go(i - 1)} disabled={i === 0} aria-label="上一張" className="icon-btn press">
            <ChevronLeft size={20} strokeWidth={2} aria-hidden />
          </button>
          <span aria-hidden className="num text-body-s">{i + 1} / {slides.length}</span>
          <button type="button" onClick={() => go(i + 1)} disabled={i === last} aria-label="下一張" className="icon-btn press">
            <ChevronRight size={20} strokeWidth={2} aria-hidden />
          </button>
        </div>
      </div>
    </StoryFrame>
  );
}
