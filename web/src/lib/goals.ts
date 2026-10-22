// 存錢目標：每個目標有名稱、金額、可以不填的日期；按「存入」記一筆（拿出來是負的），像把錢放進存錢罐，
// 不動帳戶餘額、不算支出。這裡只放進度、首頁要顯示哪一個、排序（純函式，有測試）。

export interface SavingsGoal {
  id: string;
  name: string;
  target: number;
  /** 想在哪天前存到；沒填是 null */
  deadline: string | null;
  /** GOAL_ICONS 的 key */
  icon: string;
  /** 釘選在首頁 */
  pinned: boolean;
  /** 收起來（不在清單和首頁，存的紀錄都還在） */
  archived: boolean;
  createdAt: string;
  /** 存入的加總（資料庫的 savings_goal_totals 算好） */
  saved: number;
}

export interface SavingsDeposit {
  id: string;
  goalId: string;
  /** 存入是正的，拿出來是負的 */
  amount: number;
  date: string;
  note: string | null;
  createdAt: string;
}

export const MAX_GOAL_NAME = 20;

export function progress(g: Pick<SavingsGoal, 'target' | 'saved'>) {
  const saved = Math.max(0, g.saved);
  return {
    saved,
    remaining: Math.max(0, g.target - saved),
    /** 0～1 */
    ratio: g.target > 0 ? Math.min(1, saved / g.target) : 0,
    achieved: g.target > 0 && saved >= g.target,
  };
}

const parse = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};

/** 離日期還有幾天（今天是 0，過了是負的）；沒有日期是 null */
export const daysLeft = (deadline: string | null, today: string) =>
  deadline ? Math.round((parse(deadline) - parse(today)) / 86_400_000) : null;

/** 「還有 45 天」「今天到期」「過了 3 天」 */
export function deadlineText(deadline: string | null, today: string) {
  const d = daysLeft(deadline, today);
  if (d === null) return null;
  if (d > 0) return `還有 ${d} 天`;
  if (d === 0) return '今天到期';
  return `過了 ${-d} 天`;
}

/** 清單順序：還在存的（有日期的照日期、沒日期的照建立時間）在前，存到了的在後；收起來的不列 */
export function sortGoals(goals: SavingsGoal[]) {
  const key = (g: SavingsGoal) => [progress(g).achieved ? 1 : 0, g.deadline ? 0 : 1, g.deadline ?? '', g.createdAt] as const;
  return goals.filter((g) => !g.archived).sort((a, b) => {
    const ka = key(a);
    const kb = key(b);
    for (let i = 0; i < ka.length; i++) if (ka[i] !== kb[i]) return ka[i] < kb[i] ? -1 : 1;
    return 0;
  });
}

/** 首頁顯示哪一個：釘選的優先；沒有就是還在存、最近到期的；都存到了就是最後存到的那個；沒有目標是 null */
export function homeGoal(goals: SavingsGoal[]) {
  const active = goals.filter((g) => !g.archived);
  const pinned = active.find((g) => g.pinned);
  if (pinned) return pinned;
  return sortGoals(active)[0] ?? null;
}

/** 存入或拿出來：金額要是正整數，拿出來不能超過已經存的 */
export function depositError(amount: number, withdraw: boolean, saved: number) {
  if (!Number.isFinite(amount) || amount <= 0) return '請輸入金額';
  if (withdraw && amount > saved) return `最多只能拿出 ${saved.toLocaleString('en-US')}`;
  return null;
}
