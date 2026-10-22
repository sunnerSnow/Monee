'use client';

import { useGoogleAutoSync } from '@/lib/data';

/** 有連結 Google 時，記帳改帳之後自動同步（畫面上不顯示東西） */
export function GoogleAutoSync() {
  useGoogleAutoSync();
  return null;
}
