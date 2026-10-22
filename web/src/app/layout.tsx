import type { Metadata, Viewport } from 'next';
import { Luckiest_Guy, Rubik, Sedgwick_Ave_Display } from 'next/font/google';
import './globals.css';

// 英數字體檔小，由 next/font 自行託管：金額用 Rubik、英文點綴和大金額用 Luckiest Guy、塗鴉小字用 Sedgwick Ave Display
const rubik = Rubik({ subsets: ['latin'], weight: ['500', '600', '700', '800'], variable: '--font-rubik', display: 'swap' });
const luckiest = Luckiest_Guy({ subsets: ['latin'], weight: '400', variable: '--font-luckiest', display: 'swap' });
const sedgwick = Sedgwick_Ave_Display({ subsets: ['latin'], weight: '400', variable: '--font-sedgwick', display: 'swap' });

// 中文字體（粉圓 Huninn、Noto Sans TC）有上百個 unicode-range 分片，交給 next/font 下載時只要一片逾時就會讓建置或頁面失敗，
// 所以改由瀏覽器向 Google Fonts 按需載入；載入失敗只會先顯示系統字體。
const CHINESE_FONTS = 'https://fonts.googleapis.com/css2?family=Huninn&family=Noto+Sans+TC:wght@400;500;700&display=swap';

export const metadata: Metadata = {
  title: { default: 'Monee', template: '%s · Monee' },
  description: '可愛輕量、懂你金流的個人生活財務助理。Know your money. Grow your money.',
  // iPhone 從主畫面打開時用獨立視窗、名稱顯示 Monee（圖示見下面的 link，跟著使用者挑的角色換）
  appleWebApp: { capable: true, title: 'Monee', statusBarStyle: 'default' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  // 預設深色；使用者改成淺色時由 lib/ui-store.ts 的 applyTheme 換掉
  themeColor: '#141416',
};

// 在畫面繪製前套用深淺色，避免閃一下（key 與 lib/ui-store.ts 的 THEME_KEY 一致）
const themeScript = `(function(){try{var p=localStorage.getItem("monee-theme")||"dark";var d=p==="dark"||(p==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.setAttribute("data-theme",d?"dark":"light")}catch(e){}})()`;
// App 圖示跟著使用者挑的角色（key 與 lib/ui-store.ts 的 MASCOT_KEY、applyAppIcon 一致）：
// iPhone 按「加入主畫面」時讀當下的 apple-touch-icon，所以要在頁面一開始就換好
const iconScript = `(function(){try{var k=localStorage.getItem("monee-mascot");if(k!=="wallet"&&k!=="piggy")return;document.getElementById("app-icon").href="/icons/"+k+"-192.png";document.getElementById("app-apple-icon").href="/icons/"+k+"-180.png";document.getElementById("app-manifest").href="/manifests/"+k+".webmanifest"}catch(e){}})()`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hant" data-theme="dark" className={`${rubik.variable} ${luckiest.variable} ${sedgwick.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <link id="app-icon" rel="icon" type="image/png" sizes="192x192" href="/icons/coin-192.png" />
        <link id="app-apple-icon" rel="apple-touch-icon" sizes="180x180" href="/icons/coin-180.png" />
        <link id="app-manifest" rel="manifest" href="/manifests/coin.webmanifest" />
        <script dangerouslySetInnerHTML={{ __html: iconScript }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href={CHINESE_FONTS} />
      </head>
      <body>{children}</body>
    </html>
  );
}
