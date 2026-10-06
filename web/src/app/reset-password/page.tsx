import type { Metadata } from 'next';
import { ResetPasswordScreen } from '@/components/screens/ResetPasswordScreen';

export const metadata: Metadata = { title: '設定密碼' };

// 需要登入狀態（proxy 會把未登入的人導到 /login）：從重設密碼信回來時，/auth/callback 已經換好登入狀態
export default function ResetPasswordPage() {
  return <ResetPasswordScreen />;
}
