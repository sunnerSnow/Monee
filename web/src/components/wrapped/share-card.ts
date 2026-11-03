'use client';

// 年度回顧最後一張的分享圖：直接畫在 canvas 上（1080×1920，限時動態的尺寸），不靠把網頁轉成圖片的套件，iPhone 上比較穩。
// 字型用頁面已經載入的（粉圓、Rubik、Luckiest Guy），角色是把畫面上的 SVG 畫進來。
import { saveBlob } from '@/lib/download';

export interface ShareCardData {
  year: number;
  /** 偷看版、12 月看今年：標「算到幾月幾日」 */
  partialLabel: string | null;
  /** 年度稱號 */
  title: string;
  /** 一年花了；隱藏金額時是 null */
  expense: number | null;
  topCategory: { name: string; share: number } | null;
  recordedDays: number;
  longestStreak: number;
  topItem: { note: string; count: number } | null;
  entries: number;
}

const W = 1080;
const H = 1920;
const INK = '#1A1A1E';
const INK_2 = '#4E4C55';
const LOGO: [string, string, number][] = [['M', '#00A5B5', -6], ['O', '#FF8FB8', 4], ['N', '#FDE021', -3], ['E', '#2DB45A', 5], ['E', '#8C7FD0', -4]];

/** 頁面上 CSS 變數裡的字型（next/font 的字型名稱有雜湊，要從變數讀） */
const fontVar = (name: string, fallback: string) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** 貼紙：錯開的實心影＋粗黑框 */
function sticker(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, fill: string, shadow = 16) {
  ctx.fillStyle = INK;
  roundRect(ctx, x + shadow, y + shadow, w, h, r);
  ctx.fill();
  ctx.fillStyle = fill;
  roundRect(ctx, x, y, w, h, r);
  ctx.fill();
  ctx.lineWidth = 8;
  ctx.strokeStyle = INK;
  ctx.stroke();
}

/** 字太長就縮小到放得下 */
function fitFont(ctx: CanvasRenderingContext2D, text: string, family: string, size: number, maxWidth: number, weight = '400') {
  let s = size;
  ctx.font = `${weight} ${s}px ${family}`;
  while (s > 24 && ctx.measureText(text).width > maxWidth) {
    s -= 4;
    ctx.font = `${weight} ${s}px ${family}`;
  }
}

async function svgImage(svg: SVGSVGElement, size: number) {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('width', String(size));
  clone.setAttribute('height', String(size));
  clone.removeAttribute('class');
  const img = new Image();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(clone))}`;
  await img.decode();
  return img;
}

export async function drawShareCard(d: ShareCardData, mascot: SVGSVGElement | null): Promise<Blob> {
  const fun = fontVar('--font-fun', 'sans-serif');
  const display = fontVar('--font-display', 'sans-serif');
  const num = fontVar('--font-num', 'sans-serif');
  const body = fontVar('--font-body', 'sans-serif');
  const tag = fontVar('--font-tag', 'cursive');

  const expenseText = d.expense === null ? '$ ••••' : `$${Math.round(d.expense).toLocaleString('en-US')}`;
  const rows: [string, string][] = [
    [d.partialLabel ? '今年花了' : '一年花了', expenseText],
    ...(d.topCategory ? [['花最多', `${d.topCategory.name} ${d.topCategory.share}%`] as [string, string]] : []),
    ['記帳天數', `${d.recordedDays} 天`],
    ['最長連續', `${d.longestStreak} 天`],
    d.topItem ? ['最常買', `${d.topItem.note} ×${d.topItem.count}`] : ['記了', `${d.entries} 筆`],
  ];
  const heading = `我的 ${d.year} 年度回顧`;

  // 用到的字先載好（中文字型照字分檔，沒載過的字畫出來會是備援字型）
  const allText = [heading, d.title, d.partialLabel ?? '', '年度稱號', ...rows.flat()].join('');
  await Promise.all([
    document.fonts.load(`400 80px ${fun}`, `MONEE${d.year}WRAPPED`),
    document.fonts.load(`400 80px ${display}`, allText),
    document.fonts.load(`700 64px ${num}`, allText),
    document.fonts.load(`400 40px ${body}`, allText),
    document.fonts.load(`400 44px ${tag}`, 'Know your money. Grow your money.'),
  ]).catch(() => undefined);

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('這個瀏覽器不能產生圖片');

  // 招牌黃底＋網點
  ctx.fillStyle = '#FDE021';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(26, 26, 30, .12)';
  for (let y = 21; y < H; y += 42) {
    for (let x = 21; x < W; x += 42) {
      ctx.beginPath();
      ctx.arc(x, y, 3.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // MONEE 泡泡字
  ctx.font = `400 128px ${fun}`;
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  let x = 96;
  for (const [i, [ch, color, deg]] of LOGO.entries()) {
    const w = ctx.measureText(ch).width;
    ctx.save();
    ctx.translate(x + w / 2, 250 + (i % 2 ? -4 : 2));
    ctx.rotate((deg * Math.PI) / 180);
    ctx.fillStyle = INK;
    ctx.fillText(ch, -w / 2 + 8, 8);
    ctx.lineWidth = 14;
    ctx.strokeStyle = INK;
    ctx.strokeText(ch, -w / 2, 0);
    ctx.fillStyle = color;
    ctx.fillText(ch, -w / 2, 0);
    ctx.restore();
    x += w + 6;
  }

  // 年份標籤：黑底黃字
  const label = `${d.year} WRAPPED`;
  ctx.font = `400 52px ${fun}`;
  const lw = ctx.measureText(label).width + 64;
  ctx.fillStyle = INK;
  roundRect(ctx, 96, 300, lw, 86, 43);
  ctx.fill();
  ctx.fillStyle = '#FDE021';
  ctx.fillText(label, 128, 362);

  // 標題
  ctx.fillStyle = INK;
  fitFont(ctx, heading, display, 84, W - 192);
  ctx.fillText(heading, 96, 530);
  if (d.partialLabel) {
    ctx.font = `400 42px ${display}`;
    ctx.fillStyle = INK_2;
    ctx.fillText(d.partialLabel, 96, 600);
  }

  // 年度稱號：歪一點的粉紅貼紙
  ctx.font = `400 40px ${display}`;
  ctx.fillStyle = INK;
  ctx.fillText('年度稱號', 112, 700);
  ctx.save();
  ctx.translate(96, 730);
  ctx.rotate((-2.5 * Math.PI) / 180);
  sticker(ctx, 0, 0, W - 210, 170, 28, '#FF8FB8');
  ctx.fillStyle = INK;
  fitFont(ctx, `「${d.title}」`, display, 96, W - 290);
  ctx.textAlign = 'center';
  ctx.fillText(`「${d.title}」`, (W - 210) / 2, 120);
  ctx.restore();
  ctx.textAlign = 'left';

  // 數字卡
  const top = 990;
  const rowH = 118;
  const cardH = rows.length * rowH + 56;
  sticker(ctx, 80, top, W - 176, cardH, 36, '#FFFFFF');
  rows.forEach(([k, v], i) => {
    const y = top + 28 + i * rowH;
    if (i > 0) {
      ctx.setLineDash([14, 12]);
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(26, 26, 30, .35)';
      ctx.beginPath();
      ctx.moveTo(130, y);
      ctx.lineTo(W - 146, y);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.fillStyle = INK_2;
    ctx.font = `400 40px ${display}`;
    ctx.fillText(k, 130, y + 76);
    ctx.fillStyle = INK;
    ctx.textAlign = 'right';
    fitFont(ctx, v, num, 60, W - 146 - 380, '700');
    ctx.fillText(v, W - 146, y + 80);
    ctx.textAlign = 'left';
  });

  // 角色：右下角，壓在數字卡邊上
  if (mascot) {
    try {
      const img = await svgImage(mascot, 300);
      ctx.save();
      ctx.translate(W - 200, top + cardH + 112);
      ctx.rotate((8 * Math.PI) / 180);
      ctx.drawImage(img, -150, -150, 300, 300);
      ctx.restore();
    } catch {
      // 畫不出角色也照樣給圖
    }
  }

  ctx.fillStyle = INK;
  ctx.font = `400 46px ${tag}`;
  ctx.fillText('Know your money.', 96, H - 190);
  ctx.fillText('Grow your money.', 96, H - 124);

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('圖片產生失敗'))), 'image/png'));
}

/** 手機上叫出分享選單（可以存到相簿）；不支援分享檔案的瀏覽器直接下載 */
export async function shareImage(blob: Blob, name: string, title: string): Promise<'shared' | 'saved' | 'cancelled'> {
  const file = new File([blob], name, { type: 'image/png' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title });
      return 'shared';
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled';
      // 其他錯誤（例如沒有使用者動作）改用下載
    }
  }
  saveBlob(name, blob);
  return 'saved';
}
