import type { MetadataRoute } from 'next';

/** 手機「加到主畫面」時用的設定：獨立視窗開啟、小雞圖示、奶油黃底 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Monee',
    short_name: 'Monee',
    description: '可愛輕量、懂你金流的個人生活財務助理',
    lang: 'zh-Hant',
    start_url: '/',
    display: 'standalone',
    background_color: '#FCF7D9',
    theme_color: '#FCF7D9',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
