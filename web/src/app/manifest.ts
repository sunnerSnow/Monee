import type { MetadataRoute } from 'next';

/** 手機「加到主畫面」時用的設定：獨立視窗開啟、硬幣小子圖示、深色底（跟 App 預設的深色一致） */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Monee',
    short_name: 'Monee',
    description: '可愛輕量、懂你金流的個人生活財務助理',
    lang: 'zh-Hant',
    start_url: '/',
    display: 'standalone',
    background_color: '#141416',
    theme_color: '#141416',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
