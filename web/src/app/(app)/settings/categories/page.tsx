import type { Metadata } from 'next';
import { CategoriesScreen } from '@/components/screens/CategoriesScreen';

export const metadata: Metadata = { title: '分類管理' };

export default function CategoriesPage() {
  return <CategoriesScreen />;
}
