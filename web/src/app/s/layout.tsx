import { Providers } from '@/components/Providers';

/** 分帳分享頁：朋友不用登入，沒有底部導覽 */
export default function SharedLayout({ children }: { children: React.ReactNode }) {
  return (
    <Providers>
      <main className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col gap-5 px-5 pt-[max(24px,env(safe-area-inset-top))] pb-[calc(40px+env(safe-area-inset-bottom))]">
        {children}
      </main>
    </Providers>
  );
}
