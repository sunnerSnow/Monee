/** 記一筆的金額算式：數字（最多兩位小數）和 + − × ÷，先乘除後加減；結果四捨五入到整數 */

export const OPERATORS = ['+', '−', '×', '÷'] as const;
export type Operator = (typeof OPERATORS)[number];
export type Digit = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '00';
export type CalcKey = Digit | '.' | Operator | 'del' | 'clear';

/** 一個數字整數最多 8 位、小數最多 2 位，整條算式最多 40 個字；金額上限跟其他輸入框一樣是 8 位數 */
export const MAX_DIGITS = 8;
export const MAX_DECIMALS = 2;
export const MAX_EXPRESSION = 40;
export const MAX_AMOUNT = 99_999_999;

const OP = /[+−×÷]/;
const SPLIT = /([+−×÷])/;
const NUMBER = /^\d+\.?\d*$/;

const isOperator = (s: string): s is Operator => s.length === 1 && OP.test(s);

/** 算式裡有沒有運算符號 */
export const hasOperator = (expr: string) => OP.test(expr);

/** 要不要顯示成算式加結果：有運算符號，或有小數（記下的是四捨五入後的整數） */
export const isExpression = (expr: string) => OP.test(expr) || expr.includes('.');

/** 按下一個鍵之後的算式 */
export function pressKey(expr: string, key: CalcKey): string {
  if (key === 'del') return expr.slice(0, -1);
  if (key === 'clear') return '';
  if (isOperator(key)) {
    // 連按兩個符號＝換成後面那個；「12.」後面接符號就把多的小數點拿掉
    const base = expr.replace(/[+−×÷.]$/, '');
    if (!base) return expr;
    return base.length >= MAX_EXPRESSION ? expr : base + key;
  }
  const operand = expr.split(OP).pop() ?? '';
  if (key === '.') {
    // 一個數字只能有一個小數點；還沒打數字就按，自動補成 0.
    const next = expr + (operand ? '.' : '0.');
    return operand.includes('.') || next.length > MAX_EXPRESSION ? expr : next;
  }
  if (operand.includes('.')) {
    const decimals = operand.length - operand.indexOf('.') - 1;
    return decimals + key.length > MAX_DECIMALS || expr.length + key.length > MAX_EXPRESSION ? expr : expr + key;
  }
  // 整數部分不能用 0 開頭（要打 0.5 就按小數點）
  if (key.startsWith('0') && (operand === '' || operand === '0')) return expr;
  const head = operand === '0' ? expr.slice(0, -1) : expr;
  const digits = operand === '0' ? 0 : operand.length;
  if (digits + key.length > MAX_DIGITS || head.length + key.length > MAX_EXPRESSION) return expr;
  return head + key;
}

/** 算出結果（四捨五入到整數）；空的、看不懂的、除以 0 回傳 null。最後多一個符號當作還沒打完，先不算它 */
export function evaluate(expr: string): number | null {
  const parts = expr.replace(/[+−×÷]$/, '').split(SPLIT);
  if (parts.some((p, i) => (i % 2 ? !isOperator(p) : !NUMBER.test(p)))) return null;
  const terms = [Number(parts[0])];
  for (let i = 1; i < parts.length; i += 2) {
    const n = Number(parts[i + 1]);
    const last = terms.length - 1;
    if (parts[i] === '×') terms[last] *= n;
    else if (parts[i] === '÷') {
      if (n === 0) return null;
      terms[last] /= n;
    } else terms.push(parts[i] === '−' ? -n : n);
  }
  const total = terms.reduce((a, b) => a + b, 0);
  // 先收到小數六位再取整數，避免 35×1.1 這種浮點誤差讓 .5 進位進錯
  return Number.isFinite(total) ? Math.round(Math.round(total * 1e6) / 1e6) : null;
}

/** 可以記下的金額：大於 0、不超過 8 位數；其他回傳 0 */
export function amountOf(expr: string): number {
  const n = evaluate(expr);
  return n !== null && n > 0 && n <= MAX_AMOUNT ? n : 0;
}

/** 算得出來但不能記的原因，顯示在金額下面；可以記、還沒打完就回傳空字串 */
export function amountHint(expr: string): string {
  const n = evaluate(expr);
  if (n === null || amountOf(expr)) return '';
  if (n > MAX_AMOUNT) return '金額太大了，最多 8 位數';
  // 只打了 0.4 這種還沒打完的數字不提示，算式算出 0 或負數才說
  return hasOperator(expr) ? '算出來要大於 0 才能記' : '';
}

/** 按 =：算式（或小數）可以記的話收成結果，可以接著算；其他維持原樣 */
export const collapse = (expr: string) => (isExpression(expr) && amountOf(expr) ? String(amountOf(expr)) : expr);

/** 顯示用：整數部分加千分位（打到一半的小數點和小數照樣留著），符號前後留空隙 */
export const formatExpression = (expr: string) =>
  expr
    .split(SPLIT)
    .map((p) => {
      if (isOperator(p)) return ` ${p} `;
      if (!NUMBER.test(p)) return p;
      const dot = p.indexOf('.');
      return dot < 0 ? Number(p).toLocaleString('en-US') : Number(p.slice(0, dot)).toLocaleString('en-US') + p.slice(dot);
    })
    .join('')
    .trimEnd();
