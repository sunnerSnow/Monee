'use client';

import { ArrowLeft, CircleCheck } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { authErrorMessage } from '@/lib/auth-errors';
import { createClient } from '@/lib/supabase/client';
import { PasswordInput } from '../PasswordInput';

/** 點重設密碼信回來後、或從「我的 → 修改密碼」進來，都在這裡設定新密碼 */
export function ResetPasswordScreen() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) return setError('密碼至少要 8 個字元');
    if (password !== confirm) return setError('兩次輸入的密碼不一樣');
    setBusy(true);
    const { error: err } = await createClient().auth.updateUser({ password });
    setBusy(false);
    if (err) return setError(authErrorMessage(err.message));
    setDone(true);
  };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col gap-6 px-5 pt-[max(18px,env(safe-area-inset-top))] pb-10">
      <header className="flex min-h-12 items-center gap-1">
        <Link href="/" aria-label="回首頁" className="icon-btn ghost press">
          <ArrowLeft size={20} strokeWidth={1.5} aria-hidden />
        </Link>
        <h1 className="h-page">設定密碼<span className="en">Password</span></h1>
      </header>

      {done ? (
        <div role="status" className="card flex flex-col gap-3 p-5">
          <p className="flex items-center gap-2 text-body font-medium">
            <CircleCheck size={20} strokeWidth={1.5} aria-hidden />密碼已更新
          </p>
          <p className="text-body-s leading-[1.8] text-muted">之後就用 Email 和這組密碼登入。</p>
          <Link href="/" className="btn-primary press mt-1 w-full">回到 Monee</Link>
        </div>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-4">
          <PasswordInput id="new-password" label="新密碼（至少 8 個字元）" value={password} onChange={setPassword} autoComplete="new-password" autoFocus />
          <PasswordInput id="new-password-confirm" label="再輸入一次" value={confirm} onChange={setConfirm} autoComplete="new-password" />
          {error && <p role="alert" className="text-caption text-alert">{error}</p>}
          <button type="submit" disabled={busy} className="btn-primary press mt-1 w-full">{busy ? '儲存中…' : '儲存新密碼'}</button>
        </form>
      )}
    </main>
  );
}
