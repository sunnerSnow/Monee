'use client';

import { Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';

/** 密碼欄：可切換顯示，autoComplete 讓瀏覽器與密碼管理器能自動填入 */
export function PasswordInput({ id, label, value, onChange, autoComplete, autoFocus }: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: 'current-password' | 'new-password';
  autoFocus?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="caption">{label}</label>
      <div className="relative">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          required
          minLength={autoComplete === 'new-password' ? 8 : undefined}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="field-input pr-12"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label="顯示密碼"
          aria-pressed={visible}
          className="icon-btn ghost press absolute top-1/2 right-1 -translate-y-1/2"
        >
          {visible ? <EyeOff size={18} strokeWidth={1.5} aria-hidden /> : <Eye size={18} strokeWidth={1.5} aria-hidden />}
        </button>
      </div>
    </div>
  );
}
