import type { Metadata } from 'next';
import { SettingsScreen } from '@/components/screens/SettingsScreen';

export const metadata: Metadata = { title: '我的' };

export default function SettingsPage() {
  return <SettingsScreen />;
}
