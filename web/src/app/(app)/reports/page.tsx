import type { Metadata } from 'next';
import { ReportsScreen } from '@/components/screens/ReportsScreen';

export const metadata: Metadata = { title: '報表' };

export default function ReportsPage() {
  return <ReportsScreen />;
}
