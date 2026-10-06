'use client';

import { create } from 'zustand';

export type ThemePref = 'light' | 'dark' | 'system';
export type SheetState =
  | { kind: 'entry' }
  | { kind: 'account' }
  | { kind: 'reconcile'; accountId: string }
  | null;

/** layout.tsx 的行內腳本也讀這個 key，兩邊要一致 */
export const THEME_KEY = 'monee-theme';
const HIDDEN_KEY = 'monee-hidden';

export function applyTheme(pref: ThemePref) {
  const dark = pref === 'dark' || (pref === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
}

const save = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // 無痕模式等情況存不了，只影響下次開啟時的偏好
  }
};

interface UiState {
  hidden: boolean;
  theme: ThemePref;
  sheet: SheetState;
  toast: string | null;
  /** 剛新增的交易，列表會短暫高亮 */
  flashId: string | null;
  hydrate: () => void;
  toggleHidden: () => void;
  setTheme: (theme: ThemePref) => void;
  openSheet: (sheet: Exclude<SheetState, null>) => void;
  closeSheet: () => void;
  showToast: (message: string) => void;
  flash: (id: string) => void;
}

let toastTimer: ReturnType<typeof setTimeout> | undefined;
let flashTimer: ReturnType<typeof setTimeout> | undefined;

export const useUi = create<UiState>((set, get) => ({
  hidden: false,
  theme: 'system',
  sheet: null,
  toast: null,
  flashId: null,
  hydrate: () => {
    try {
      const theme = localStorage.getItem(THEME_KEY);
      set({
        hidden: localStorage.getItem(HIDDEN_KEY) === '1',
        theme: theme === 'light' || theme === 'dark' ? theme : 'system',
      });
    } catch {
      // 讀不到偏好就用預設值
    }
  },
  toggleHidden: () => {
    const hidden = !get().hidden;
    set({ hidden });
    save(HIDDEN_KEY, hidden ? '1' : '0');
  },
  setTheme: (theme) => {
    set({ theme });
    save(THEME_KEY, theme);
    applyTheme(theme);
  },
  openSheet: (sheet) => set({ sheet }),
  closeSheet: () => set({ sheet: null }),
  showToast: (toast) => {
    clearTimeout(toastTimer);
    set({ toast });
    toastTimer = setTimeout(() => set({ toast: null }), 2400);
  },
  flash: (flashId) => {
    clearTimeout(flashTimer);
    set({ flashId });
    flashTimer = setTimeout(() => set({ flashId: null }), 1600);
  },
}));
