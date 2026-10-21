'use client';

import { useEffect } from 'react';

/**
 * 桌機用滑鼠時，滾輪停在可以左右滑的按鈕列（.pills：分類、帳戶…）上，改成左右捲這一列。
 * 手機用手指滑本來就可以；觸控板的左右滑動、Ctrl＋滾輪縮放照原本的；捲到底了就讓畫面照常上下捲。
 */
export function useWheelPills() {
  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || Math.abs(e.deltaX) >= Math.abs(e.deltaY)) return;
      const row = e.target instanceof Element ? e.target.closest<HTMLElement>('.pills') : null;
      if (!row) return;
      const max = row.scrollWidth - row.clientWidth;
      if (max <= 0) return;
      if ((e.deltaY < 0 && row.scrollLeft <= 0) || (e.deltaY > 0 && row.scrollLeft >= max - 1)) return;
      e.preventDefault();
      // Firefox 有時用「行」當單位
      row.scrollLeft += e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
    };
    document.addEventListener('wheel', onWheel, { passive: false });
    return () => document.removeEventListener('wheel', onWheel);
  }, []);
}
