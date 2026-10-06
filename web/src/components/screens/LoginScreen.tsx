'use client';

import { ArrowLeft, ArrowRight, MailCheck } from 'lucide-react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { authErrorMessage } from '@/lib/auth-errors';
import { createClient } from '@/lib/supabase/client';
import { isSupabaseConfigured } from '@/lib/supabase/env';
import { PasswordInput } from '../PasswordInput';

type Mode = 'login' | 'signup' | 'forgot';
type Sent = null | 'confirm' | 'reset';

export function LoginScreen({ linkError }: { linkError: boolean }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<Sent>(null);
  const [error, setError] = useState(linkError ? '連結已失效或用過了，請重新操作一次。' : '');

  const switchMode = (next: Mode) => {
    setMode(next);
    setError('');
    setSent(null);
    setPassword('');
    setConfirm('');
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (mode === 'signup' && password !== confirm) return setError('兩次輸入的密碼不一樣');
    setBusy(true);
    const supabase = createClient();
    const origin = window.location.origin;
    try {
      if (mode === 'login') {
        const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (err) throw err;
        router.replace('/');
        router.refresh();
        return;
      }
      if (mode === 'signup') {
        const { data, error: err } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: `${origin}/auth/callback` },
        });
        if (err) throw err;
        // 開著「Email 驗證」時，已註冊的 Email 不會報錯，而是回傳沒有身分資料的使用者
        if (data.user && data.user.identities?.length === 0) throw new Error('already registered');
        if (data.session) {
          router.replace('/');
          router.refresh();
          return;
        }
        setSent('confirm');
        return;
      }
      const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${origin}/auth/callback?next=/reset-password`,
      });
      if (err) throw err;
      setSent('reset');
    } catch (err) {
      setError(authErrorMessage(err instanceof Error ? err.message : String(err)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col justify-center gap-8 px-5 py-10">
      <div className="flex flex-col items-start gap-4">
        <Image src="/monee.png" alt="" width={124} height={90} priority className="h-auto w-[124px]" />
        <h1 className="flex flex-col gap-1.5">
          <span className="display text-[40px] font-extralight leading-none">Monee</span>
          <span className="text-title-m font-medium tracking-[.14em]">懂你金流的生活財務助理</span>
        </h1>
        <p className="num text-caption tracking-[.08em] text-muted">Know your money. Grow your money.</p>
      </div>

      {!isSupabaseConfigured ? (
        <div role="alert" className="card flex flex-col gap-2 p-5 text-body-s leading-[1.8]">
          <p className="font-medium">還沒設定 Supabase</p>
          <p className="text-muted">把 <code>web/.env.local.example</code> 複製成 <code>.env.local</code>，填入 Supabase 專案的網址和 Publishable key，再重新執行 <code>npm run dev</code>。詳細步驟見 <code>web/README.md</code>。</p>
        </div>
      ) : sent ? (
        <div role="status" className="card flex flex-col gap-2 p-5">
          <p className="flex items-center gap-2 text-body font-medium">
            <MailCheck size={20} strokeWidth={1.5} aria-hidden />{sent === 'confirm' ? '確認信已寄出' : '重設密碼信已寄出'}
          </p>
          <p className="text-body-s leading-[1.8] text-muted">
            {sent === 'confirm'
              ? `打開 ${email} 的信箱，點信裡的連結完成註冊，之後就用 Email 和密碼登入。`
              : `打開 ${email} 的信箱，點信裡的連結設定新密碼。`}
            沒收到的話，看一下垃圾郵件匣。請在同一個瀏覽器打開連結。
          </p>
          <button type="button" onClick={() => switchMode('login')} className="btn-secondary press mt-2 self-start">回到登入</button>
        </div>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-4">
          {mode === 'forgot' ? (
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => switchMode('login')} aria-label="回到登入" className="icon-btn ghost press -ml-3">
                <ArrowLeft size={20} strokeWidth={1.5} aria-hidden />
              </button>
              <h2 className="text-title-s font-medium tracking-[.14em]">重設密碼</h2>
            </div>
          ) : (
            <div role="group" aria-label="登入或註冊" className="pills">
              <button type="button" aria-pressed={mode === 'login'} onClick={() => switchMode('login')} className="pill press">登入</button>
              <button type="button" aria-pressed={mode === 'signup'} onClick={() => switchMode('signup')} className="pill press">註冊</button>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <label htmlFor="email" className="caption">Email</label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="field-input"
            />
          </div>

          {mode !== 'forgot' && (
            <PasswordInput
              id="password"
              label={mode === 'signup' ? '密碼（至少 8 個字元）' : '密碼'}
              value={password}
              onChange={setPassword}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            />
          )}
          {mode === 'signup' && (
            <PasswordInput id="password-confirm" label="再輸入一次密碼" value={confirm} onChange={setConfirm} autoComplete="new-password" />
          )}

          {error && <p role="alert" className="text-caption text-alert">{error}</p>}

          <button type="submit" disabled={busy} className="btn-primary press mt-1 w-full">
            {busy ? '處理中…' : mode === 'login' ? '登入' : mode === 'signup' ? '建立帳號' : '寄送重設密碼信'}
            <ArrowRight size={18} strokeWidth={1.5} aria-hidden />
          </button>

          {mode === 'login' && (
            <button type="button" onClick={() => switchMode('forgot')} className="press self-center min-h-11 px-2 text-body-s tracking-[.08em] text-muted underline-offset-4 hover:underline">
              忘記密碼？
            </button>
          )}
          {mode === 'forgot' && (
            <p className="caption leading-[1.8] tracking-[.04em]">輸入註冊用的 Email，我們會寄一封重設密碼的信給你。以前用登入連結建立的帳號，也用這個方式設定第一組密碼。</p>
          )}
        </form>
      )}
    </main>
  );
}
