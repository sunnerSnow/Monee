'use client';

import { Delete, Divide, Equal, Minus, Plus, X } from 'lucide-react';
import { useEffect } from 'react';
import { formatExpression, isExpression, type CalcKey, type Operator } from '@/lib/calc';

// 第一列是清除和刪除（刪除佔兩格），數字照手機撥號的排法，最右邊一欄是加減乘除和等於
const KEYS: (CalcKey | '=')[] = ['clear', 'del', '÷', '1', '2', '3', '×', '4', '5', '6', '−', '7', '8', '9', '+', '00', '0', '.', '='];
const LABELS: Partial<Record<CalcKey | '=', string>> = { clear: '全部清除', del: '刪除一位', '.': '小數點', '=': '等於' };
const OPS: Record<Operator, { label: string; Icon: typeof Plus }> = {
  '+': { label: '加', Icon: Plus },
  '−': { label: '減', Icon: Minus },
  '×': { label: '乘', Icon: X },
  '÷': { label: '除', Icon: Divide },
};
// 實體鍵盤：* / - 換成畫面上的符號
const FROM_KEYBOARD: Record<string, CalcKey> = { '+': '+', '-': '−', '*': '×', x: '×', X: '×', '/': '÷', '.': '.', Backspace: 'del' };

/** 大金額：打算式時顯示算式，下面一行是算出來的結果（放在記一筆的金額卡上半，下半是品項） */
export function AmountDisplay({ expr, value, hint }: { expr: string; value: number; hint: string }) {
  const pending = isExpression(expr);
  const text = expr ? formatExpression(expr) : '0';
  // 算式變長就縮小字，最長會換行，不會把面板撐寬
  const size = text.length <= 9 ? 'text-[44px]' : text.length <= 15 ? 'text-[30px]' : 'text-[22px]';
  return (
    <div aria-live="polite" className="flex flex-col items-center gap-0.5 px-4 pt-2.5">
      <p className={`display m-0 flex min-h-[52px] flex-wrap items-center justify-center gap-x-1.5 text-center leading-[1.2] ${size} ${expr ? '' : 'text-muted'}`}>
        {!pending && <small className="!m-0 self-center text-[20px]">$</small>}
        <span className="min-w-0 break-words">{text}</span>
      </p>
      {/* 先留一行的高度，開始打算式時下面的欄位才不會跳一下 */}
      <p className={`num m-0 min-h-[18px] text-body-s leading-[18px] ${hint ? 'text-alert' : 'text-muted'}`}>
        {hint || (pending && value ? `= $${value.toLocaleString('en-US')}` : '')}
      </p>
    </div>
  );
}

/** 數字鍵盤＋加減乘除；焦點不在輸入框時也可以直接用實體鍵盤打 */
export function AmountPad({ onKey, onEquals }: { onKey: (key: CalcKey) => void; onEquals: () => void }) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el?.closest('input, textarea, select, [contenteditable="true"]')) return;
      if (e.key === '=' || e.key === 'Enter') {
        // 焦點在按鈕上的 Enter 是按那顆按鈕，不要搶
        if (e.key === 'Enter' && el?.closest('button, a')) return;
        e.preventDefault();
        return onEquals();
      }
      const key = /^\d$/.test(e.key) ? (e.key as CalcKey) : FROM_KEYBOARD[e.key];
      if (!key) return;
      e.preventDefault();
      onKey(key);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onKey, onEquals]);

  return (
    // 鍵盤固定在面板底部，按鍵比一般按鈕矮一點（仍 ≥ 44px），上面才放得下金額、品項、分類；矮螢幕再縮到 44px
    <div role="group" aria-label="數字鍵盤，可以加減乘除" className="grid grid-cols-4 gap-1.5">
      {KEYS.map((k) => {
        const op = k in OPS ? OPS[k as Operator] : null;
        return (
          <button
            key={k}
            type="button"
            onClick={() => (k === '=' ? onEquals() : onKey(k))}
            aria-label={op ? op.label : LABELS[k]}
            className={`press num flex h-[46px] items-center justify-center rounded-sm border-2 text-[20px] [@media(max-height:700px)]:h-11 ${k === 'del' ? 'col-span-2' : ''} ${op || k === '=' ? 'border-ink bg-fill' : 'border-line-strong bg-surface'}`}
          >
            {op ? <op.Icon size={20} strokeWidth={2.5} aria-hidden />
              : k === '=' ? <Equal size={20} strokeWidth={2.5} aria-hidden />
              : k === 'del' ? <Delete size={22} strokeWidth={1.5} aria-hidden />
              : k === 'clear' ? 'C' : k}
          </button>
        );
      })}
    </div>
  );
}
