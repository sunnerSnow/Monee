// 收據放進 Google Drive：檔名、資料夾、這個月要上傳／改名搬家／丟垃圾桶的有哪些（純函式，有測試）。
// 檔名照規格：YYYY-MM-DD_項目_金額.副檔名（例如 2026-10-22_全聯_830.jpg），資料夾照記帳日期：Monee/2026/10。

/** 一張收據：source_path 是 Supabase Storage 裡的照片路徑 */
export interface ReceiptRef {
  sourcePath: string;
  date: string;
  title: string;
  amount: number;
}

/** 已經放進 Drive 的（drive_receipts 的一列） */
export interface DriveReceipt {
  sourcePath: string;
  driveFileId: string;
  fileName: string;
  folderPath: string;
}

/** 2026-10-22 → 2026/10 */
export const monthFolder = (date: string) => `${date.slice(0, 4)}/${date.slice(5, 7)}`;

const MAX_TITLE = 40;

/** 檔名不能有的字（Windows、Mac 下載下來也要能存）換成空白，連續空白縮成一個 */
export function cleanTitle(title: string) {
  const cleaned = title.replace(/[\\/:*?"<>|\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  return [...cleaned].slice(0, MAX_TITLE).join('').trim() || '收據';
}

/** 副檔名照原本的照片；認不得就當 jpg（App 拍的收據都是 JPEG） */
export function extensionOf(path: string) {
  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  return ['jpg', 'jpeg', 'png', 'webp', 'heic', 'pdf'].includes(ext) ? (ext === 'jpeg' ? 'jpg' : ext) : 'jpg';
}

export const MIME: Record<string, string> = {
  jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp', heic: 'image/heic', pdf: 'application/pdf',
};

/** 金額取整數、不加千分位（830、1500），有小數就留兩位 */
const amountText = (amount: number) => (Number.isInteger(amount) ? String(amount) : amount.toFixed(2));

export const receiptFileName = (r: ReceiptRef) => `${r.date}_${cleanTitle(r.title)}_${amountText(r.amount)}.${extensionOf(r.sourcePath)}`;

/**
 * 同步一個月的收據要做的事：
 * - upload：還沒放進 Drive 的
 * - update：放過了，但品項、金額或日期改了（檔名不一樣，或要搬到別的月份資料夾）
 * - orphans：原本放在這個月資料夾、現在這個月已經沒有的（交易刪了、換照片、或改到別的月份）。
 *   要再確認別的月份也沒有用到，才丟進垃圾桶
 */
export function planMonthReceipts(month: string, current: ReceiptRef[], mappings: DriveReceipt[]) {
  const folder = monthFolder(`${month}-01`);
  const byPath = new Map(mappings.map((m) => [m.sourcePath, m]));
  const currentPaths = new Set(current.map((r) => r.sourcePath));
  const upload: ReceiptRef[] = [];
  const update: { ref: ReceiptRef; mapping: DriveReceipt; name: string }[] = [];
  for (const ref of current) {
    const mapping = byPath.get(ref.sourcePath);
    const name = receiptFileName(ref);
    if (!mapping) upload.push(ref);
    else if (mapping.fileName !== name || mapping.folderPath !== folder) update.push({ ref, mapping, name });
  }
  const orphans = mappings.filter((m) => m.folderPath === folder && !currentPaths.has(m.sourcePath));
  return { folder, upload, update, orphans };
}
