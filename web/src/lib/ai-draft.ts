// AI 記帳草稿：給 Gemini 的指示、回傳格式，以及把回傳結果整理成表單可以直接用的草稿。
// 伺服器（/api/ai/draft）與測試共用；這裡只放純函式，不碰網路與金鑰。
import { CATEGORIES, categoriesFor } from './categories';
import type { Account, AccountType, TransactionType } from './types';

export type DraftSource = 'voice' | 'receipt' | 'text';

/** 送給 AI 當參考的帳戶（只需要這些欄位） */
export type DraftAccount = Pick<Account, 'id' | 'name' | 'type'>;

/** 對應 monee_ux.md 的 AiDraftTransaction；使用者確認後才會寫入 */
export interface AiDraftTransaction {
  /** 語音逐字稿或收據上的重點文字 */
  rawInput: string;
  /** 0 ~ 1 */
  confidence: number;
  suggestedType: TransactionType;
  /** 0 代表沒聽到金額，讓使用者自己輸入 */
  suggestedAmount: number;
  suggestedCategoryId: string;
  /** null 代表沒提到付款方式，沿用表單目前選的帳戶 */
  suggestedAccountId: string | null;
  suggestedTargetAccountId: string | null;
  suggestedDate: string;
  suggestedNote: string;
}

const TYPE_LABEL: Record<AccountType, string> = {
  CASH: '現金',
  BANK: '銀行',
  CREDIT_CARD: '信用卡',
  INVESTMENT_MIRROR: '投資帳戶，只能當轉入帳戶',
};
const NONE = 'none';
const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_NOTE = 30;
const MAX_RAW = 500;

export const isISODate = (s: unknown): s is string =>
  typeof s === 'string' && ISO_DATE.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) && new Date(`${s}T00:00:00Z`).toISOString().startsWith(s);

const weekday = (iso: string) => WEEKDAYS[new Date(`${iso}T00:00:00Z`).getUTCDay()];

const categoryList = (type: TransactionType) => categoriesFor(type).map((c) => `${c.id} ${c.name}`).join('、');

export function draftInstruction(accounts: DraftAccount[], today: string) {
  const accountLines = accounts.length
    ? accounts.map((a) => `- ${a.id}：${a.name}（${TYPE_LABEL[a.type]}）`).join('\n')
    : '- （還沒有帳戶，accountId 一律填 none）';
  return `你是 Monee 記帳 App 的助理，負責把使用者的語音、文字或收據照片整理成「一筆」交易草稿；使用者確認後才會寫入。
今天是 ${today}（週${weekday(today)}，台灣時間），金額單位是新台幣。

帳戶（accountId、targetAccountId 只能用這些 id，判斷不出來就填 ${NONE}）：
${accountLines}

分類（categoryId 只能用這些 id）：
- 支出：${categoryList('EXPENSE')}
- 收入：${categoryList('INCOME')}
- 轉帳：${categoryList('TRANSFER')}

規則：
1. type：花錢是 EXPENSE，收到錢是 INCOME；在自己的帳戶之間移動錢（提款、繳卡費、轉到證券戶）是 TRANSFER，categoryId 填 transfer，並填 targetAccountId（轉入的帳戶）。不是轉帳時 targetAccountId 填 ${NONE}。
2. amount：正數。收據取「總計／合計」的實付金額，不是單品價格。完全聽不到或看不到金額就填 0。
3. accountId：錢從哪個帳戶出去（收入則是存入哪個帳戶）。有提到付款方式才填：刷卡選名稱最接近的信用卡、付現選現金；收據印有信用卡末四碼時選最可能的信用卡帳戶。判斷不出來填 ${NONE}。
4. date：YYYY-MM-DD。「昨天」「上週五」依今天推算；收據用上面印的交易日期，民國年加 1911 換成西元年。沒提到就用今天，不能晚於今天。
5. note：${MAX_NOTE} 字以內的繁體中文，格式「店名或場合・品項」，例如「全聯・衛生紙、洗衣精」「午餐・拉麵」。
6. rawInput：語音的逐字稿，或收據上的店名、日期、品項與總計。
7. confidence：0 到 1，你對金額與分類有多確定。
8. isTransaction：內容跟記帳無關、照片不是收據、或完全聽不清楚時填 false。`;
}

export const SOURCE_PROMPT: Record<DraftSource, string> = {
  voice: '這是一段記帳語音，請整理成交易草稿。',
  receipt: '這是一張收據或發票的照片，請整理成交易草稿。',
  text: '使用者輸入的記帳文字如下，請整理成交易草稿：',
};

/** Gemini responseSchema（OpenAPI 子集）；分類與帳戶用 enum 限定，避免 AI 自己編 id */
export function draftSchema(accounts: DraftAccount[]) {
  const accountIds = [...accounts.map((a) => a.id), NONE];
  return {
    type: 'OBJECT',
    properties: {
      isTransaction: { type: 'BOOLEAN' },
      rawInput: { type: 'STRING' },
      type: { type: 'STRING', enum: ['EXPENSE', 'INCOME', 'TRANSFER'] },
      amount: { type: 'NUMBER' },
      categoryId: { type: 'STRING', enum: CATEGORIES.map((c) => c.id) },
      accountId: { type: 'STRING', enum: accountIds },
      targetAccountId: { type: 'STRING', enum: accountIds },
      date: { type: 'STRING' },
      note: { type: 'STRING' },
      confidence: { type: 'NUMBER' },
    },
    required: ['isTransaction', 'rawInput', 'type', 'amount', 'categoryId', 'accountId', 'targetAccountId', 'date', 'note', 'confidence'],
  };
}

export class NotATransactionError extends Error {
  constructor(source: DraftSource) {
    super({
      receipt: '看不出這是收據，換個角度再拍一次，或改用手動輸入',
      voice: '聽不出要記什麼，再說一次試試，例如「午餐拉麵 260 刷國泰」',
      text: '看不出要記什麼，寫出品項和金額試試，例如「午餐拉麵 260 刷國泰」',
    }[source]);
  }
}

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/**
 * 把 AI 回傳的 JSON 整理成可用的草稿：不合法的值換成安全的預設值，
 * 金額取整數、日期不晚於今天、帳戶與分類一定是現有的 id。
 */
export function sanitizeDraft(raw: unknown, { accounts, today, source }: { accounts: DraftAccount[]; today: string; source: DraftSource }): AiDraftTransaction {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  if (r.isTransaction === false) throw new NotATransactionError(source);

  const type: TransactionType = r.type === 'INCOME' || r.type === 'TRANSFER' ? r.type : 'EXPENSE';
  const amount = typeof r.amount === 'number' && Number.isFinite(r.amount) && r.amount > 0 ? Math.min(Math.round(r.amount), 99_999_999) : 0;
  const allowed = categoriesFor(type);
  const categoryId = allowed.some((c) => c.id === r.categoryId) ? (r.categoryId as string) : allowed[0].id;

  // 投資帳戶由 Monee Invest 同步，只能當轉入對象（跟手動記帳的規則一樣）
  const payable = accounts.filter((a) => a.type !== 'INVESTMENT_MIRROR');
  const accountId = payable.some((a) => a.id === r.accountId) ? (r.accountId as string) : null;
  const targetAccountId = type === 'TRANSFER' && r.targetAccountId !== accountId && accounts.some((a) => a.id === r.targetAccountId)
    ? (r.targetAccountId as string)
    : null;

  const date = isISODate(r.date) && r.date <= today ? r.date : today;
  const confidence = typeof r.confidence === 'number' && Number.isFinite(r.confidence) ? Math.min(Math.max(r.confidence, 0), 1) : 0.5;

  return {
    rawInput: str(r.rawInput, MAX_RAW),
    confidence,
    suggestedType: type,
    suggestedAmount: amount,
    suggestedCategoryId: categoryId,
    suggestedAccountId: accountId,
    suggestedTargetAccountId: targetAccountId,
    suggestedDate: date,
    suggestedNote: str(r.note, MAX_NOTE),
  };
}

/** 檢查前端送來的帳戶清單，只留需要的欄位 */
export function parseDraftAccounts(input: unknown): DraftAccount[] {
  if (!Array.isArray(input)) return [];
  const types: AccountType[] = ['CASH', 'BANK', 'CREDIT_CARD', 'INVESTMENT_MIRROR'];
  return input
    .filter((a): a is DraftAccount => Boolean(a) && typeof a.id === 'string' && typeof a.name === 'string' && types.includes(a.type))
    .slice(0, 50)
    .map((a) => ({ id: a.id.slice(0, 64), name: a.name.replace(/\s+/g, ' ').slice(0, 40), type: a.type }));
}
