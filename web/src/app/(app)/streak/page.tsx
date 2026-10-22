import type { Metadata } from 'next';
import { StreakScreen } from '@/components/screens/StreakScreen';

export const metadata: Metadata = { title: '記帳月曆' };

export default function StreakPage() {
  return <StreakScreen />;
}
