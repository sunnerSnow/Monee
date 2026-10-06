import type { Metadata, Viewport } from 'next';
import { Lexend_Exa } from 'next/font/google';
import './globals.css';

// 英數字體檔小，由 next/font 自行託管
const lexend = Lexend_Exa({
  subsets: ['latin'],
  weight: ['200', '300', '400'],
  variable: '--font-lexend-exa',
  display: 'swap',
});

// 中文 Noto Sans TC 有上百個 unicode-range 分片，交給 next/font 下載時只要一片逾時就會讓建置或頁面失敗，
// 所以改由瀏覽器向 Google Fonts 按需載入；載入失敗只會先顯示系統字體。
const NOTO_SANS_TC = 'https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500&display=swap';

export const metadata: Metadata = {
  title: { default: 'Monee', template: '%s · Monee' },
  description: '可愛輕量、懂你金流的個人生活財務助理。Know your money. Grow your money.',
  // iPhone 從主畫面打開時用獨立視窗、名稱顯示 Monee（圖示來自 app/apple-icon.png）
  appleWebApp: { capable: true, title: 'Monee', statusBarStyle: 'default' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#FCF7D9' },
    { media: '(prefers-color-scheme: dark)', color: '#0E0E0F' },
  ],
};

// 在畫面繪製前套用深淺色，避免閃一下（key 與 lib/ui-store.ts 的 THEME_KEY 一致）
const themeScript = `(function(){try{var p=localStorage.getItem("monee-theme")||"system";var d=p==="dark"||(p==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.setAttribute("data-theme",d?"dark":"light")}catch(e){}})()`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hant" data-theme="light" className={lexend.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href={NOTO_SANS_TC} />
      </head>
      <body>{children}</body>
    </html>
  );
}
