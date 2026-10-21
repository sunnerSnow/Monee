import type { Metadata } from 'next';
import { RecurringScreen } from '@/components/screens/RecurringScreen';

export const metadata: Metadata = { title: '固定收支' };

export default function RecurringPage() {
  return <RecurringScreen />;
}
