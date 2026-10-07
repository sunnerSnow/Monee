// AI 記帳草稿：給 Gemini 的指示、回傳格式，以及把回傳結果整理成表單可以直接用的草稿。
// 伺服器（/api/ai/draft）與測試共用；這裡只放純函式，不碰網路與金鑰。
import { CATEGORIES, categoriesFor } from './categories';
import { CURRENCIES, getCurrency } from './currency';
import type { Account, AccountType, TransactionType } from './types';

export type DraftSource = 'voice' | 'receipt' | 'text';

/** 送給 AI 當參考的帳戶（只需要這些欄位） */
export type DraftAccount = Pick<Account, 'id' | 'name' | 'type'>;

/** 分帳／旅程裡記帳時多給 AI 的資訊 */
export interface DraftContext {
  /** 除了「我」以外的成員名字；一個人的旅程是空的 */
  members: string[];
  /** 群組的幣別：旅程是當地貨幣，一般群組是 TWD；沒提到幣別時用這個 */
  currency: string;
}

/** 對應 monee_ux.md 的 AiDraftTransaction；使用者確認後才會寫入 */
export interface AiDraftTransaction {
  /** 語音逐字稿，或收據上的重點文字（外文收據翻成中文） */
  rawInput: string;
  /** 0 ~ 1 */
  confidence: number;
  suggestedType: TransactionType;
  /** suggestedCurrency 那個幣別的金額，沒有換算；0 代表沒聽到金額，讓使用者自己輸入 */
  suggestedAmount: number;
  suggestedCurrency: string;
  suggestedCategoryId: string;
  /** null 代表沒提到付款方式，沿用表單目前選的帳戶 */
  suggestedAccountId: string | null;
  suggestedTargetAccountId: string | null;
  suggestedDate: string;
  suggestedNote: string;
  /** 分帳時誰先付的：「我」或成員名字；沒提到是 null */
  suggestedPayer: string | null;
}

const TYPE_LABEL: Record<AccountType, string> = {
  CASH: '現金',
  BANK: '銀行',
  CREDIT_CARD: '信用卡',
  INVESTMENT_MIRROR: '投資帳戶，只能當轉入帳戶',
  FRIENDS: '朋友往來，不能選',
};
const NONE = 'none';
/** 分帳時代表使用者自己的付款人名字 */
export const ME = '我';
const CODES = new Set(CURRENCIES.map((c) => c.code));
const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_NOTE = 30;
const MAX_RAW = 500;

export const isISODate = (s: unknown): s is string =>
  typeof s === 'string' && ISO_DATE.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) && new Date(`${s}T00:00:00Z`).toISOString().startsWith(s);

const weekday = (iso: string) => WEEKDAYS[new Date(`${iso}T00:00:00Z`).getUTCDay()];

const categoryList = (type: TransactionType) => categoriesFor(type).map((c) => `${c.id} ${c.name}`).join('、');

/** 分帳／旅程多加的規則 */
function splitRules({ members, currency }: DraftContext) {
  const c = getCurrency(currency);
  const where = currency !== 'TWD' ? `旅程（當地貨幣是 ${c.name} ${c.code}）` : '';
  const lines = [`\n這筆是${where}${members.length ? '跟朋友分帳的' : ''}花費：`, '9. type 一律填 EXPENSE。'];
  if (members.length) {
    lines.push(`10. payer：誰先付的錢，只能填「${ME}」、成員名字或 ${NONE}。「我付的」「我刷卡」填「${ME}」；說到成員名字（例如「小明付的」「阿凱先墊」）就填那個名字；沒提到填 ${NONE}。成員：${[ME, ...members].join('、')}。`);
  }
  return lines.join('\n');
}

export function draftInstruction(accounts: DraftAccount[], today: string, context?: DraftContext) {
  const accountLines = accounts.length
    ? accounts.map((a) => `- ${a.id}：${a.name}（${TYPE_LABEL[a.type]}）`).join('\n')
    : '- （還沒有帳戶，accountId 一律填 none）';
  const fallback = getCurrency(context?.currency ?? 'TWD');
  return `你是 Monee 記帳 App 的助理，負責把使用者的語音、文字或收據照片整理成「一筆」交易草稿；使用者確認後才會寫入。
今天是 ${today}（週${weekday(today)}，台灣時間）。語音或文字沒提到幣別時，金額是${fallback.name}（${fallback.code}）。

帳戶（accountId、targetAccountId 只能用這些 id，判斷不出來就填 ${NONE}）：
${accountLines}

分類（categoryId 只能用這些 id）：
- 支出：${categoryList('EXPENSE')}
- 收入：${categoryList('INCOME')}
- 轉帳：${categoryList('TRANSFER')}

規則：
1. type：花錢是 EXPENSE，收到錢是 INCOME；在自己的帳戶之間移動錢（提款、繳卡費、轉到證券戶）是 TRANSFER，categoryId 填 transfer，並填 targetAccountId（轉入的帳戶）。不是轉帳時 targetAccountId 填 ${NONE}。
2. currency 與 amount：currency 是金額的幣別代碼，只能用 ${CURRENCIES.map((c) => `${c.code} ${c.name}`).join('、')}。收據一定要依店家所在的國家判斷，不能套用預設：台灣的收據（繁體中文、統一編號、電子發票、NT$）是 TWD，日本的收據（日文、¥、令和）是 JPY，其他國家依此類推。語音或文字說「日圓」「美金」就是 JPY、USD，沒提到才用 ${fallback.code}。amount 是那個幣別的金額，正數，不要換算成台幣；美元、歐元這類有小數的幣別保留兩位小數。收據取「總計／合計」的實付金額，不是單品價格。完全聽不到或看不到金額就填 0。
3. accountId：錢從哪個帳戶出去（收入則是存入哪個帳戶）。有提到付款方式才填：刷卡選名稱最接近的信用卡、付現選現金；收據印有信用卡末四碼時選最可能的信用卡帳戶。判斷不出來填 ${NONE}。
4. date：YYYY-MM-DD。「昨天」「上週五」依今天推算；收據用上面印的交易日期，民國年加 1911、日本的令和年加 2018 換成西元年。沒提到就用今天，不能晚於今天。
5. note：${MAX_NOTE} 字以內的繁體中文，格式「店名或場合・品項」，例如「全聯・衛生紙、洗衣精」「午餐・拉麵」。外文收據要把品項翻成中文，店名有常見的中文名稱就用中文，例如「羅森・飯糰、綠茶」。
6. rawInput：語音的逐字稿；收據則用繁體中文寫出店名、日期、品項與總計，外文的要翻譯。
7. confidence：0 到 1，你對金額與分類有多確定。
8. isTransaction：內容跟記帳無關、照片不是收據、或完全聽不清楚時填 false。${context ? splitRules(context) : ''}`;
}

export const SOURCE_PROMPT: Record<DraftSource, string> = {
  voice: '這是一段記帳語音，請整理成交易草稿。',
  receipt: '這是一張收據或發票的照片，請整理成交易草稿。',
  text: '使用者輸入的記帳文字如下，請整理成交易草稿：',
};

/** Gemini responseSchema（OpenAPI 子集）；分類、帳戶、幣別、付款人用 enum 限定，避免 AI 自己編 */
export function draftSchema(accounts: DraftAccount[], context?: DraftContext) {
  const accountIds = [...accounts.map((a) => a.id), NONE];
  const withPayer = Boolean(context?.members.length);
  return {
    type: 'OBJECT',
    properties: {
      isTransaction: { type: 'BOOLEAN' },
      rawInput: { type: 'STRING' },
      type: { type: 'STRING', enum: ['EXPENSE', 'INCOME', 'TRANSFER'] },
      currency: { type: 'STRING', enum: [...CODES] },
      amount: { type: 'NUMBER' },
      categoryId: { type: 'STRING', enum: CATEGORIES.map((c) => c.id) },
      accountId: { type: 'STRING', enum: accountIds },
      targetAccountId: { type: 'STRING', enum: accountIds },
      date: { type: 'STRING' },
      note: { type: 'STRING' },
      confidence: { type: 'NUMBER' },
      ...(withPayer ? { payer: { type: 'STRING', enum: [ME, ...context!.members, NONE] } } : {}),
    },
    required: [
      'isTransaction', 'rawInput', 'type', 'currency', 'amount', 'categoryId', 'accountId', 'targetAccountId', 'date', 'note', 'confidence',
      ...(withPayer ? ['payer'] : []),
    ],
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
 * 金額照幣別取到該有的小數位、日期不晚於今天、帳戶與分類一定是現有的 id。
 * 分帳時一律是支出，付款人一定是群組裡的人。
 */
export function sanitizeDraft(raw: unknown, { accounts, today, source, context }: {
  accounts: DraftAccount[];
  today: string;
  source: DraftSource;
  context?: DraftContext;
}): AiDraftTransaction {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  if (r.isTransaction === false) throw new NotATransactionError(source);

  const type: TransactionType = !context && (r.type === 'INCOME' || r.type === 'TRANSFER') ? r.type : 'EXPENSE';
  const currency = typeof r.currency === 'string' && CODES.has(r.currency) ? r.currency : context?.currency ?? 'TWD';
  const scale = 10 ** getCurrency(currency).decimals;
  const amount = typeof r.amount === 'number' && Number.isFinite(r.amount) && r.amount > 0 ? Math.min(Math.round(r.amount * scale) / scale, 99_999_999) : 0;
  const allowed = categoriesFor(type);
  const categoryId = allowed.some((c) => c.id === r.categoryId) ? (r.categoryId as string) : allowed[0].id;

  // 投資帳戶由 Monee Invest 同步，只能當轉入對象（跟手動記帳的規則一樣）
  const payable = accounts.filter((a) => a.type !== 'INVESTMENT_MIRROR' && a.type !== 'FRIENDS');
  const accountId = payable.some((a) => a.id === r.accountId) ? (r.accountId as string) : null;
  const targetAccountId = type === 'TRANSFER' && r.targetAccountId !== accountId && accounts.some((a) => a.id === r.targetAccountId)
    ? (r.targetAccountId as string)
    : null;

  const date = isISODate(r.date) && r.date <= today ? r.date : today;
  const confidence = typeof r.confidence === 'number' && Number.isFinite(r.confidence) ? Math.min(Math.max(r.confidence, 0), 1) : 0.5;
  const payer = context?.members.length && typeof r.payer === 'string' && (r.payer === ME || context.members.includes(r.payer)) ? r.payer : null;

  return {
    rawInput: str(r.rawInput, MAX_RAW),
    confidence,
    suggestedType: type,
    suggestedAmount: amount,
    suggestedCurrency: currency,
    suggestedCategoryId: categoryId,
    suggestedAccountId: accountId,
    suggestedTargetAccountId: targetAccountId,
    suggestedDate: date,
    suggestedNote: str(r.note, MAX_NOTE),
    suggestedPayer: payer,
  };
}

/** 檢查前端送來的分帳資訊：成員名字去重、限制長度，幣別一定是支援的 */
export function parseDraftContext(input: unknown): DraftContext | undefined {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return undefined;
  const r = input as Record<string, unknown>;
  const names = Array.isArray(r.members) ? r.members.filter((m): m is string => typeof m === 'string') : [];
  const members = [...new Set(names.map((m) => m.replace(/\s+/g, ' ').trim().slice(0, 12)))]
    .filter((m) => m && m !== ME && m !== NONE)
    .slice(0, 20);
  return { members, currency: typeof r.currency === 'string' && CODES.has(r.currency) ? r.currency : 'TWD' };
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
