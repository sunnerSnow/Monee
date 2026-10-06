import type { Metadata } from 'next';
import { AssetsScreen } from '@/components/screens/AssetsScreen';

export const metadata: Metadata = { title: '資產' };

export default function AssetsPage() {
  return <AssetsScreen />;
}
