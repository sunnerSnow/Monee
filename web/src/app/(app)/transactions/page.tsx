import type { Metadata } from 'next';
import { TransactionsScreen } from '@/components/screens/TransactionsScreen';

export const metadata: Metadata = { title: '明細' };

export default function TransactionsPage() {
  return <TransactionsScreen />;
}
