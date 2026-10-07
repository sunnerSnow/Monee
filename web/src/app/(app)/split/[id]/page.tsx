import type { Metadata } from 'next';
import { GroupScreen } from '@/components/split/GroupScreen';

export const metadata: Metadata = { title: '分帳群組' };

export default async function SplitGroupPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <GroupScreen id={id} />;
}
