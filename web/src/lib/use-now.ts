'use client';

import { useSyncExternalStore } from 'react';

// 以分鐘為單位更新，日期、問候語跨過整點或午夜時會自動換
const subscribe = (onChange: () => void) => {
  const id = setInterval(onChange, 60_000);
  return () => clearInterval(id);
};
const getSnapshot = () => Math.floor(Date.now() / 60_000);
const getServerSnapshot = () => 0;

/**
 * 伺服器與 hydration 期間回傳 null，避免伺服器時區（通常是 UTC）跟使用者不同而造成畫面不一致。
 */
export function useNow(): Date | null {
  const minute = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return minute ? new Date(minute * 60_000) : null;
}
