import type { Metadata } from 'next';
import { WrappedScreen } from '@/components/screens/WrappedScreen';

export const metadata: Metadata = { title: '年度回顧' };

export default async function WrappedPage({ searchParams }: { searchParams: Promise<{ year?: string | string[] }> }) {
  const { year } = await searchParams;
  return <WrappedScreen yearParam={typeof year === 'string' ? year : undefined} />;
}
