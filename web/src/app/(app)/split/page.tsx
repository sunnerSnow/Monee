import type { Metadata } from 'next';
import { SplitScreen } from '@/components/split/SplitScreen';

export const metadata: Metadata = { title: '分帳' };

export default function SplitPage() {
  return <SplitScreen />;
}
