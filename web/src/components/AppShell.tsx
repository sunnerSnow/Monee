'use client';

import { useEffect, type ReactNode } from 'react';
import { isDemo } from '@/lib/demo';
import { applyTheme, useUi } from '@/lib/ui-store';
import { BottomNav } from './BottomNav';
import { Toast } from './Toast';
import { AccountSheet } from './sheets/AccountSheet';
import { EntrySheet } from './sheets/EntrySheet';
import { ReconcileSheet } from './sheets/ReconcileSheet';
import { SplitSheets } from './split/SplitSheets';

export function AppShell({ children }: { children: ReactNode }) {
  const sheetOpen = useUi((s) => s.sheet !== null);
  const theme = useUi((s) => s.theme);

  useEffect(() => {
    useUi.getState().hydrate();
  }, []);

  // 選「跟隨系統」時，系統切換深淺色要即時反映
  useEffect(() => {
    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyTheme('system');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [theme]);

  return (
    <div className="relative mx-auto min-h-dvh w-full max-w-[480px]">
      {/* 面板打開時，背景不可操作也不會被讀到 */}
      <main
        inert={sheetOpen}
        className="flex flex-col gap-5 px-5 pt-[max(18px,env(safe-area-inset-top))] pb-[calc(128px+env(safe-area-inset-bottom))]"
      >
        {isDemo && (
          <p role="note" className="caption -mb-2 rounded-full bg-cream px-4 py-2 text-center text-fg">
            示範模式・資料只存在這個分頁，重新整理就會還原
          </p>
        )}
        {children}
      </main>
      <BottomNav inert={sheetOpen} />
      <Toast />
      <EntrySheet />
      <AccountSheet />
      <ReconcileSheet />
      <SplitSheets />
    </div>
  );
}
