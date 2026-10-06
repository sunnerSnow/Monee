import { AppShell } from '@/components/AppShell';
import { Providers } from '@/components/Providers';

/** 登入後的頁面共用外框：底部導覽、記一筆面板、提示訊息 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Providers>
      <AppShell>{children}</AppShell>
    </Providers>
  );
}
