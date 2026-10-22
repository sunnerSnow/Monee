import type { Metadata } from 'next';
import { GoogleSyncScreen } from '@/components/screens/GoogleSyncScreen';

export const metadata: Metadata = { title: 'Google 雲端同步' };

export default function GooglePage() {
  return <GoogleSyncScreen />;
}
