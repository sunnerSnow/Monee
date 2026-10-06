'use client';

import { ArrowRight, MailCheck } from 'lucide-react';
import Image from 'next/image';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { isSupabaseConfigured } from '@/lib/supabase/env';

export function LoginScreen({ linkError }: { linkError: boolean }) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState(linkError ? '登入連結已失效或用過了，請重新寄一次。' : '');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('sending');
    setError('');
    const { error: err } = await createClient().auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (err) {
      setStatus('idle');
      setError(err.message.includes('rate limit') ? '寄送太頻繁，請稍後再試。' : err.message);
      return;
    }
    setStatus('sent');
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
      ) : status === 'sent' ? (
        <div role="status" className="card flex flex-col gap-2 p-5">
          <p className="flex items-center gap-2 text-body font-medium"><MailCheck size={20} strokeWidth={1.5} aria-hidden />登入連結已寄出</p>
          <p className="text-body-s leading-[1.8] text-muted">打開 {email} 的信箱，點信裡的連結就能登入。沒收到的話，看一下垃圾郵件匣。</p>
          <button type="button" onClick={() => setStatus('idle')} className="btn-secondary press mt-2 self-start">換一個信箱</button>
        </div>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-3">
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
          {error && <p role="alert" className="text-caption text-alert">{error}</p>}
          <button type="submit" disabled={status === 'sending'} className="btn-primary press mt-1 w-full">
            {status === 'sending' ? '寄送中…' : '寄送登入連結'}<ArrowRight size={18} strokeWidth={1.5} aria-hidden />
          </button>
          <p className="caption leading-[1.8] tracking-[.04em]">不用設密碼，我們會寄一封有登入連結的信給你。第一次登入會自動建立帳號。</p>
        </form>
      )}
    </main>
  );
}
