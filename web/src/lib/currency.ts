// 旅程的幣別與匯率。金額一律以台幣入帳；外幣只存原幣金額與當下匯率，方便顯示「¥3,000（≈ $603）」。

export interface Currency {
  code: string;
  symbol: string;
  name: string;
  /** 小數位數：日圓、韓圜這類沒有小數 */
  decimals: number;
  /** 建立旅程時用來選的目的地 */
  place: string;
}

// 台灣人常去的地方排前面
export const CURRENCIES: Currency[] = [
  { code: 'JPY', symbol: '¥', name: '日圓', decimals: 0, place: '日本' },
  { code: 'KRW', symbol: '₩', name: '韓圜', decimals: 0, place: '韓國' },
  { code: 'THB', symbol: '฿', name: '泰銖', decimals: 2, place: '泰國' },
  { code: 'HKD', symbol: 'HK$', name: '港幣', decimals: 2, place: '香港' },
  { code: 'VND', symbol: '₫', name: '越南盾', decimals: 0, place: '越南' },
  { code: 'SGD', symbol: 'S$', name: '新加坡幣', decimals: 2, place: '新加坡' },
  { code: 'MYR', symbol: 'RM', name: '馬來幣', decimals: 2, place: '馬來西亞' },
  { code: 'PHP', symbol: '₱', name: '菲律賓披索', decimals: 2, place: '菲律賓' },
  { code: 'IDR', symbol: 'Rp', name: '印尼盾', decimals: 0, place: '印尼' },
  { code: 'MOP', symbol: 'MOP$', name: '澳門幣', decimals: 2, place: '澳門' },
  { code: 'CNY', symbol: 'CN¥', name: '人民幣', decimals: 2, place: '中國' },
  { code: 'USD', symbol: 'US$', name: '美元', decimals: 2, place: '美國' },
  { code: 'EUR', symbol: '€', name: '歐元', decimals: 2, place: '歐洲' },
  { code: 'GBP', symbol: '£', name: '英鎊', decimals: 2, place: '英國' },
  { code: 'CHF', symbol: 'CHF ', name: '瑞士法郎', decimals: 2, place: '瑞士' },
  { code: 'AUD', symbol: 'A$', name: '澳幣', decimals: 2, place: '澳洲' },
  { code: 'NZD', symbol: 'NZ$', name: '紐幣', decimals: 2, place: '紐西蘭' },
  { code: 'CAD', symbol: 'C$', name: '加幣', decimals: 2, place: '加拿大' },
  { code: 'TWD', symbol: '$', name: '新台幣', decimals: 0, place: '台灣' },
];

const byCode = new Map(CURRENCIES.map((c) => [c.code, c]));
export const getCurrency = (code: string): Currency => byCode.get(code) ?? { code, symbol: `${code} `, name: code, decimals: 2, place: code };
export const isForeign = (code: string | null | undefined) => Boolean(code && code !== 'TWD');

/** ¥3,000、US$12.50；整數就不顯示小數 */
export function formatForeign(n: number, code: string) {
  const c = getCurrency(code);
  const abs = Math.abs(n);
  const digits = abs % 1 ? Math.min(2, c.decimals) : 0;
  return `${c.symbol}${abs.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}

/** 外幣換台幣，取整數 */
export const toTwd = (original: number, rate: number) => Math.round(original * rate);

/** 金額輸入框：只留數字，有小數的幣別允許一個小數點與兩位小數 */
export function cleanAmountInput(raw: string, decimals: number, maxDigits = 8) {
  if (!decimals) return raw.replace(/\D/g, '').slice(0, maxDigits);
  const [intPart, ...rest] = raw.replace(/[^\d.]/g, '').split('.');
  const int = intPart.slice(0, maxDigits);
  return rest.length ? `${int}.${rest.join('').slice(0, decimals)}` : int;
}

/** 換成最小單位的整數（日圓 1、美元 0.01），分攤時才不會有浮點誤差 */
export const toMinor = (value: number, decimals: number) => Math.round(value * 10 ** decimals);

export interface FxRates {
  /** 資料來源的更新時間 */
  updatedAt: string;
  /** 1 台幣可以換多少外幣 */
  perTwd: Record<string, number>;
}

/** 1 單位外幣 = 多少台幣；拿不到匯率時回傳 null */
export function twdPerUnit(rates: FxRates | undefined, code: string): number | null {
  if (code === 'TWD') return 1;
  const v = rates?.perTwd[code];
  return v ? Number((1 / v).toFixed(6)) : null;
}

/** 示範模式與測試用的固定匯率（2026 年 10 月左右的水準） */
export const SAMPLE_RATES: FxRates = {
  updatedAt: '示範匯率',
  perTwd: {
    JPY: 4.97, KRW: 42.1, THB: 1.058, HKD: 0.2447, VND: 805, SGD: 0.0405, MYR: 0.1332, PHP: 1.82, IDR: 512, MOP: 0.252,
    CNY: 0.2238, USD: 0.03144, EUR: 0.02797, GBP: 0.02391, CHF: 0.0262, AUD: 0.0481, NZD: 0.0533, CAD: 0.0437,
  },
};
