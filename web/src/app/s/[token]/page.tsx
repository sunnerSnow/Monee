import type { Metadata } from 'next';
import { SharedSplit } from '@/components/split/SharedSplit';

// 分享連結不要被搜尋引擎收錄
export const metadata: Metadata = { title: '分帳', robots: { index: false, follow: false } };

export default async function SharedSplitPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <SharedSplit token={token} />;
}
