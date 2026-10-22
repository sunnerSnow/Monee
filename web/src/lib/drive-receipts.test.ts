import { describe, expect, it } from 'vitest';
import { cleanTitle, extensionOf, monthFolder, planMonthReceipts, receiptFileName, type DriveReceipt, type ReceiptRef } from './drive-receipts';

const ref = (p: Partial<ReceiptRef>): ReceiptRef => ({ sourcePath: 'u/a.jpg', date: '2026-10-22', title: '全聯', amount: 830, ...p });
const map = (p: Partial<DriveReceipt>): DriveReceipt => ({ sourcePath: 'u/a.jpg', driveFileId: 'f1', fileName: '2026-10-22_全聯_830.jpg', folderPath: '2026/10', ...p });

describe('檔名', () => {
  it('照規格：日期_項目_金額.副檔名', () => {
    expect(receiptFileName(ref({}))).toBe('2026-10-22_全聯_830.jpg');
    expect(receiptFileName(ref({ amount: 12.5, sourcePath: 'u/b.png' }))).toBe('2026-10-22_全聯_12.50.png');
  });

  it('不能用的字換掉、太長截斷、空的叫收據', () => {
    expect(cleanTitle('午餐/晚餐: "拉麵"?')).toBe('午餐 晚餐 拉麵');
    expect(cleanTitle('a\nb\tc')).toBe('a b c');
    expect([...cleanTitle('長'.repeat(60))]).toHaveLength(40);
    expect(cleanTitle(' / ')).toBe('收據');
  });

  it('副檔名：認得的照用，jpeg 寫成 jpg，認不得的當 jpg', () => {
    expect(extensionOf('u/x.JPEG')).toBe('jpg');
    expect(extensionOf('u/x.webp')).toBe('webp');
    expect(extensionOf('u/x')).toBe('jpg');
  });

  it('月份資料夾照記帳日期', () => {
    expect(monthFolder('2026-01-31')).toBe('2026/01');
  });
});

describe('planMonthReceipts', () => {
  it('還沒放的上傳、放過沒變的不動', () => {
    const plan = planMonthReceipts('2026-10', [ref({}), ref({ sourcePath: 'u/new.jpg', title: '咖啡', amount: 85 })], [map({})]);
    expect(plan.upload.map((r) => r.sourcePath)).toEqual(['u/new.jpg']);
    expect(plan.update).toEqual([]);
    expect(plan.orphans).toEqual([]);
  });

  it('改了品項或金額：改檔名', () => {
    const plan = planMonthReceipts('2026-10', [ref({ title: '全聯福利中心', amount: 900 })], [map({})]);
    expect(plan.update).toEqual([{ ref: ref({ title: '全聯福利中心', amount: 900 }), mapping: map({}), name: '2026-10-22_全聯福利中心_900.jpg' }]);
  });

  it('從別的月份搬進來：要搬資料夾', () => {
    const plan = planMonthReceipts('2026-11', [ref({ date: '2026-11-02' })], [map({})]);
    expect(plan.update[0].name).toBe('2026-11-02_全聯_830.jpg');
    expect(plan.folder).toBe('2026/11');
  });

  it('這個月資料夾裡、現在沒有的：候選丟垃圾桶；別的月份資料夾的不算', () => {
    const plan = planMonthReceipts('2026-10', [], [map({}), map({ sourcePath: 'u/nov.jpg', folderPath: '2026/11' })]);
    expect(plan.orphans.map((m) => m.sourcePath)).toEqual(['u/a.jpg']);
  });
});
