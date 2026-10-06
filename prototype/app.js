/* Monee 互動原型：資料、畫面與互動
   樣式見 app.css，色彩與尺寸見 ../design-system/monee/tokens.css。 */

// ---------- 圖示（Lucide，線條 1.5） ----------
const P = {
  home: '<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  list: '<path d="M3 12h.01"/><path d="M3 18h.01"/><path d="M3 6h.01"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M8 6h13"/>',
  wallet: '<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>',
  pie: '<path d="M21 12c.552 0 1.005-.449.95-.998a10 10 0 0 0-8.953-8.951c-.55-.055-.998.398-.998.95v8a1 1 0 0 0 1 1z"/><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/>',
  plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
  user: '<circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 0 0-16 0"/>',
  eye: '<path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/>',
  eyeOff: '<path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49"/><path d="M14.084 14.158a3 3 0 0 1-4.242-4.242"/><path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143"/><path d="m2 2 20 20"/>',
  utensils: '<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/>',
  coffee: '<path d="M10 2v2"/><path d="M14 2v2"/><path d="M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1"/><path d="M6 2v2"/>',
  tram: '<rect width="16" height="16" x="4" y="3" rx="2"/><path d="M4 11h16"/><path d="M12 3v8"/><path d="m8 19-2 3"/><path d="m18 22-2-3"/><path d="M8 15h.01"/><path d="M16 15h.01"/>',
  basket: '<path d="m15 11-1 9"/><path d="m19 11-4-7"/><path d="M2 11h20"/><path d="m3.5 11 1.6 7.4a2 2 0 0 0 2 1.6h9.8a2 2 0 0 0 2-1.6l1.7-7.4"/><path d="M4.5 15.5h15"/><path d="m5 11 4-7"/><path d="m9 11 1 9"/>',
  bag: '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>',
  ticket: '<path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/><path d="M13 5v2"/><path d="M13 17v2"/><path d="M13 11v2"/>',
  heart: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/><path d="M3.22 12H9.5l.5-1 2 4.5 2-7 1.5 3.5h5.27"/>',
  dots: '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>',
  banknote: '<rect width="20" height="12" x="2" y="6" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/>',
  swap: '<path d="M8 3 4 7l4 4"/><path d="M4 7h16"/><path d="m16 21 4-4-4-4"/><path d="M20 17H4"/>',
  trend: '<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>',
  external: '<path d="M7 7h10v10"/><path d="M7 17 17 7"/>',
  chevron: '<path d="m9 18 6-6-6-6"/>',
  chevLeft: '<path d="m15 18-6-6 6-6"/>',
  chevDown: '<path d="m6 9 6 6 6-6"/>',
  arrow: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
  mic: '<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/>',
  camera: '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/>',
  calc: '<rect width="16" height="20" x="4" y="2" rx="2"/><line x1="8" x2="16" y1="6" y2="6"/><line x1="16" x2="16" y1="14" y2="18"/><path d="M16 10h.01"/><path d="M12 10h.01"/><path d="M8 10h.01"/><path d="M12 14h.01"/><path d="M8 14h.01"/><path d="M12 18h.01"/><path d="M8 18h.01"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  card: '<rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/>',
  bank: '<line x1="3" x2="21" y1="22" y2="22"/><line x1="6" x2="6" y1="18" y2="11"/><line x1="10" x2="10" y1="18" y2="11"/><line x1="14" x2="14" y1="18" y2="11"/><line x1="18" x2="18" y1="18" y2="11"/><polygon points="12 2 20 7 4 7"/>',
  okCircle: '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
  infoCircle: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  sparkles: '<path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>',
  del: '<path d="M10 5a2 2 0 0 0-1.344.519l-6.328 5.74a1 1 0 0 0 0 1.481l6.328 5.741A2 2 0 0 0 10 19h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2z"/><path d="m12 9 6 6"/><path d="m18 9-6 6"/>',
  target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
  tag: '<path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r=".5" fill="currentColor"/>',
  sheetIcon: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/><path d="M9 9v12"/>',
  cloud: '<path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/>',
};
const icon = (name, size = 20, sw = 1.5) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name]}</svg>`;

// ---------- 常數與資料 ----------
const TODAY = '2026-10-06';
const YESTERDAY = '2026-10-05';
const BUDGET = 24000;
const DAYS = 31;
const DAY = 6;
const WEEK = ['日', '一', '二', '三', '四', '五', '六'];
const MASCOT = '../Monee.png';

const CATS = {
  food: { name: '餐飲', icon: 'utensils', kind: 'expense' },
  transit: { name: '交通', icon: 'tram', kind: 'expense' },
  daily: { name: '日用', icon: 'basket', kind: 'expense' },
  shop: { name: '購物', icon: 'bag', kind: 'expense' },
  fun: { name: '娛樂', icon: 'ticket', kind: 'expense' },
  health: { name: '醫療', icon: 'heart', kind: 'expense' },
  other: { name: '其他', icon: 'dots', kind: 'expense' },
  salary: { name: '薪資', icon: 'banknote', kind: 'income' },
  bonus: { name: '獎金', icon: 'banknote', kind: 'income' },
  incomeOther: { name: '其他收入', icon: 'banknote', kind: 'income' },
  transfer: { name: '轉帳', icon: 'swap', kind: 'transfer' },
};

// 近 5 個完整月份的支出（10 月由交易即時計算）
const PAST_MONTHS = [
  { short: '5月', label: '5 月', value: 22800 },
  { short: '6月', label: '6 月', value: 25600 },
  { short: '7月', label: '7 月', value: 21300 },
  { short: '8月', label: '8 月', value: 23900 },
  { short: '9月', label: '9 月', value: 22100 },
];

const baseAccounts = () => [
  { id: 'cash', name: '現金', type: 'CASH', balance: 3200, sub: '錢包' },
  { id: 'esun', name: '玉山銀行', type: 'BANK', balance: 186400, sub: '活存・上次校準 9/30' },
  { id: 'taishin', name: '台新銀行', type: 'BANK', balance: 56000, sub: '數位帳戶・上次校準 9/30' },
  { id: 'cathay', name: '國泰信用卡', type: 'CREDIT_CARD', balance: -8960, sub: '本期待繳' },
  { id: 'flygo', name: '台新 FlyGo', type: 'CREDIT_CARD', balance: -3400, sub: '本期待繳' },
  { id: 'invest', name: '投資帳戶', type: 'INVESTMENT_MIRROR', balance: 153000, snapshot: { pnl: 11800, pct: 8.4, synced: '今天 08:00' } },
];

let seq = 0;
const tx = (date, time, title, cat, account, amount, extra = {}) =>
  ({ id: `t${++seq}`, date, time, title, cat, account, amount, kind: CATS[cat].kind, ...extra });

const baseTxs = () => [
  tx(TODAY, '12:30', '午餐・拉麵', 'food', 'cathay', 260),
  tx(TODAY, '08:50', '捷運', 'transit', 'flygo', 35),
  tx(TODAY, '08:20', '早餐・蛋餅豆漿', 'food', 'cash', 75),
  tx(YESTERDAY, '19:40', '全聯・日用品', 'daily', 'flygo', 528),
  tx(YESTERDAY, '09:30', '轉入投資帳戶', 'transfer', 'esun', 10000, { to: 'invest' }),
  tx(YESTERDAY, '09:00', '十月薪資', 'salary', 'esun', 48000),
  tx('2026-10-04', '19:30', '電影', 'fun', 'cathay', 650),
  tx('2026-10-04', '17:10', '捷運', 'transit', 'flygo', 60),
  tx('2026-10-04', '11:00', '早午餐', 'food', 'cathay', 320),
  tx('2026-10-03', '22:30', 'Uber', 'transit', 'cathay', 180),
  tx('2026-10-03', '19:00', '晚餐・火鍋', 'food', 'cathay', 580),
  tx('2026-10-03', '15:20', '洗衣精・衛生紙', 'daily', 'flygo', 600),
  tx('2026-10-02', '18:00', '診所掛號', 'health', 'cash', 250),
  tx('2026-10-02', '15:00', '咖啡', 'food', 'cash', 95, { icon: 'coffee' }),
  tx('2026-10-02', '12:20', '午餐・便當', 'food', 'cash', 150),
  tx('2026-10-02', '08:40', '捷運', 'transit', 'flygo', 70),
  tx('2026-10-01', '19:00', '晚餐・滷肉飯', 'food', 'cathay', 136),
  tx('2026-10-01', '12:30', '午餐・義大利麵', 'food', 'cash', 140),
  tx('2026-10-01', '10:00', '電信費', 'other', 'esun', 300),
  tx('2026-10-01', '08:40', '捷運', 'transit', 'flygo', 110),
  tx('2026-10-01', '08:15', '早餐', 'food', 'cash', 65),
];

const QUICK = [
  { title: '早餐・蛋餅豆漿', cat: 'food', account: 'cash', amount: 75 },
  { title: '捷運', cat: 'transit', account: 'flygo', amount: 35 },
  { title: '午餐・便當', cat: 'food', account: 'cash', amount: 150 },
];

function applyToAccounts(accounts, t) {
  const from = accounts.find((a) => a.id === t.account);
  if (!from) return;
  if (t.kind === 'expense') from.balance -= t.amount;
  else if (t.kind === 'income') from.balance += t.amount;
  else {
    from.balance -= t.amount;
    const to = accounts.find((a) => a.id === t.to);
    if (to) to.balance += t.amount;
  }
}

function buildScenario(s) {
  seq = 0;
  if (s === 'empty') return { txs: [], accounts: [] };
  const txs = baseTxs();
  const accounts = baseAccounts();
  const extras = [];
  if (s !== 'onTrack') extras.push(tx(TODAY, '15:10', '下午茶・蛋糕拿鐵', 'food', 'cathay', 300, { icon: 'coffee' }));
  if (s === 'over') extras.push(tx(TODAY, '18:20', '運動鞋', 'shop', 'cathay', 1280));
  extras.forEach((t) => { txs.push(t); applyToAccounts(accounts, t); });
  return { txs, accounts };
}

// ---------- 狀態 ----------
const state = {
  page: 'home',
  prevPage: 'home',
  scenario: 'onTrack',
  theme: 'light',
  hidden: false,
  pnl: 'red',
  txFilter: 'all',
  txQuery: '',
  sheet: null,
  draft: null,
  manual: null,
  reconcile: null,
  flashId: null,
  added: 0,
  ...buildScenario('onTrack'),
};

// ---------- 格式 ----------
const MASK = '$ ••••';
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (n) => '$' + Math.abs(Math.round(n)).toLocaleString('en-US');
const money = (n) => (state.hidden ? MASK : fmt(n));
const debt = (n) => (state.hidden ? MASK : (n < 0 ? '−' : '') + fmt(n));
const bigMoney = (n) => `<small>$</small>${state.hidden ? '••••' : (n < 0 ? '−' : '') + Math.abs(Math.round(n)).toLocaleString('en-US')}`;
const signed = (t) => (state.hidden ? MASK : (t.kind === 'income' ? '+' : t.kind === 'expense' ? '−' : '') + fmt(t.amount));
const sum = (list) => list.reduce((s, t) => s + t.amount, 0);
const acct = (id) => state.accounts.find((a) => a.id === id);
const acctName = (id) => acct(id)?.name ?? '';
const nowTime = () => `20:${String(15 + state.added).padStart(2, '0')}`;

function dayLabel(d) {
  const dt = new Date(`${d}T00:00:00`);
  const md = `${dt.getMonth() + 1}/${dt.getDate()} 週${WEEK[dt.getDay()]}`;
  if (d === TODAY) return `今天 · ${md}`;
  if (d === YESTERDAY) return `昨天 · ${md}`;
  return md;
}

const sortDesc = (list) => [...list].sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
function groupByDay(list) {
  const map = new Map();
  sortDesc(list).forEach((t) => {
    if (!map.has(t.date)) map.set(t.date, []);
    map.get(t.date).push(t);
  });
  return [...map].map(([date, items]) => ({ date, items, spent: sum(items.filter((t) => t.kind === 'expense')) }));
}

function stats() {
  const expenses = state.txs.filter((t) => t.kind === 'expense');
  const todaySpent = sum(expenses.filter((t) => t.date === TODAY));
  const monthExpense = sum(expenses);
  const income = sum(state.txs.filter((t) => t.kind === 'income'));
  const transfer = sum(state.txs.filter((t) => t.kind === 'transfer'));
  const allowance = Math.floor((BUDGET - (monthExpense - todaySpent)) / (DAYS - DAY + 1));
  const left = allowance - todaySpent;
  const over = left < 0;
  const tight = !over && left / allowance < 0.2;
  const usedPct = Math.round((monthExpense / BUDGET) * 100);
  const timePct = (DAY / DAYS) * 100;
  const diff = usedPct - Math.round(timePct);
  const nextDaily = Math.floor((BUDGET - monthExpense) / (DAYS - DAY));
  return { todaySpent, monthExpense, income, transfer, allowance, left, over, tight, usedPct, timePct, diff, nextDaily };
}

function acctStats() {
  const liquid = state.accounts.filter((a) => a.type === 'CASH' || a.type === 'BANK');
  const cards = state.accounts.filter((a) => a.type === 'CREDIT_CARD');
  const invest = state.accounts.find((a) => a.type === 'INVESTMENT_MIRROR');
  const bal = (list) => list.reduce((s, a) => s + a.balance, 0);
  const liquidSum = bal(liquid);
  const cardSum = bal(cards);
  const assets = liquidSum + (invest?.balance ?? 0);
  return { liquid, cards, invest, liquidSum, cardSum, assets, net: assets + cardSum };
}

// ---------- 共用片段 ----------
const pageHead = (title, en) => `<header class="page-head"><h1>${title}<span class="en">${en}</span></h1></header>`;
const emptyBox = (title, text) => `<div class="empty-box"><p class="e1">${title}</p><p class="e2">${text}</p></div>`;
const monthSwitch = () => `
  <div class="month-switch">
    <button type="button" class="icon-btn ghost press" data-demo="示意稿：原型只有 10 月的資料" aria-label="上個月">${icon('chevLeft')}</button>
    <span class="month-label">2026 年 <span class="num">10</span> 月</span>
    <button type="button" class="icon-btn ghost" aria-label="下個月" disabled>${icon('chevron')}</button>
  </div>`;
const hero = (inner, bottom) => `
  <div class="hero-top">
    <span class="hero-blob" aria-hidden="true"></span>
    <img class="chick" src="${MASCOT}" alt="" width="124" height="90" draggable="false">
    ${inner}
  </div>
  <div class="hero-bottom">${bottom}</div>`;
const pnlText = (a) => (state.hidden ? '▲ ••••' : `▲ ${fmt(a.snapshot.pnl)} (+${a.snapshot.pct}%)`);

function txRow(t) {
  const ic = t.icon || CATS[t.cat].icon;
  const cls = t.kind === 'income' ? 'in' : t.kind === 'transfer' ? 'tr' : '';
  const sub = t.kind === 'transfer'
    ? `不算支出 · ${acctName(t.account)} → ${acctName(t.to)}`
    : `${CATS[t.cat].name} · ${acctName(t.account)} · ${t.time}`;
  return `
  <li><button type="button" class="row-btn press${t.id === state.flashId ? ' flash' : ''}" data-demo="示意稿：交易詳情還沒設計">
    <span class="ico ${cls}" aria-hidden="true">${icon(ic)}</span>
    <span class="txt"><span class="t1">${esc(t.title)}</span><span class="t2">${esc(sub)}</span></span>
    <span class="amt ${t.kind === 'transfer' ? 'tr' : ''}">${signed(t)}</span>
  </button></li>`;
}

// ---------- 頁面：首頁 ----------
function renderHome() {
  if (!state.txs.length) return renderHomeEmpty();
  const s = stats();
  const mood = s.over ? `沒關係，明天起每天可花 ${money(s.nextDaily)}` : s.tight ? '今天再省一點點就達標' : '節奏剛剛好，繼續保持';
  const chip = s.over ? ['over', `超出 ${money(-s.left)}`] : s.tight ? ['warn', `只剩 ${money(s.left)}`] : ['', `還能花 ${money(s.left)}`];
  const barColor = s.over ? 'var(--alert)' : s.tight ? 'var(--warn)' : 'var(--text)';
  const recent = sortDesc(state.txs).slice(0, 6);
  const a = acctStats();
  return `
  <header class="top">
    <div class="greet"><span class="caption">10月6日 週二</span><h1>早安</h1></div>
    <div class="top-actions">
      <button type="button" id="eye" class="icon-btn press" data-action="toggle-hidden" aria-pressed="${state.hidden}" aria-label="隱藏金額">${icon(state.hidden ? 'eyeOff' : 'eye')}</button>
      <button type="button" class="icon-btn avatar press" data-action="go" data-page="me" aria-label="我的・設定">${icon('user')}</button>
    </div>
  </header>

  <section class="hero" aria-labelledby="today-title">
    ${hero(`
      <h2 id="today-title" class="hero-label">今天花了</h2>
      <p class="hero-amount">${bigMoney(s.todaySpent)}</p>
      <p class="hero-mood">${mood}</p>`, `
      <div class="bar" aria-hidden="true"><i style="width:${Math.min(100, Math.round((s.todaySpent / s.allowance) * 100))}%;background:${barColor}"></i></div>
      <div class="hero-row"><span>今日額度 <span class="num">${money(s.allowance)}</span></span><span class="chip ${chip[0]}">${chip[1]}</span></div>`)}
  </section>

  <section class="card month" aria-labelledby="month-title">
    <div class="row-between">
      <h2 id="month-title" class="h-sec">10 月結餘<span class="en">October</span></h2>
      <span class="caption">第 6 天・共 31 天</span>
    </div>
    <p class="big">${bigMoney(s.income - s.monthExpense)}</p>
    <div class="stats">
      <div class="stat in"><span class="k">收入</span><span class="v">${state.hidden ? MASK : '+' + fmt(s.income)}</span></div>
      <div class="stat"><span class="k">支出</span><span class="v">${money(s.monthExpense)}</span></div>
    </div>
    <div class="budget">
      <div class="budget-meta"><span>每月預算 <span class="num">${money(BUDGET)}</span></span><span>已用 <span class="num">${s.usedPct}%</span></span></div>
      <div class="track" aria-hidden="true">
        <i style="width:${Math.min(100, s.usedPct)}%"></i>
        <span class="today-mark" style="left:${s.timePct}%"><span>今天</span></span>
      </div>
      <p class="pace ${s.diff <= 2 ? '' : 'warn'}">${icon(s.diff <= 2 ? 'okCircle' : 'infoCircle', 16)}<span>${s.diff <= 2 ? '跟時間進度差不多，剛剛好' : `比時間進度快 ${s.diff}%，留意一下就好`}</span></p>
    </div>
    ${s.transfer ? `<p class="footnote">${icon('swap', 16)}<span>已排除內部轉帳 <span class="num">${money(s.transfer)}</span>，不算進支出</span></p>` : ''}
  </section>

  <section class="sec" aria-labelledby="recent-title">
    <div class="sec-head">
      <h2 id="recent-title" class="h-sec">最近交易<span class="en">Recent</span></h2>
      <a href="#" class="more" data-action="go" data-page="tx">全部明細${icon('arrow', 16)}</a>
    </div>
    <div class="card list-card">
      ${groupByDay(recent).map((g) => `
        <div class="group-head"><span>${dayLabel(g.date)}</span><span class="num">${g.spent ? money(g.spent) : ''}</span></div>
        <ul class="list">${g.items.map(txRow).join('')}</ul>`).join('')}
    </div>
  </section>

  ${a.invest || a.liquid.length ? `
  <section class="sec" aria-labelledby="assets-title">
    <div class="sec-head">
      <h2 id="assets-title" class="h-sec">資產<span class="en">Assets</span></h2>
      <a href="#" class="more" data-action="go" data-page="assets">全部資產${icon('arrow', 16)}</a>
    </div>
    <div class="card list-card">
      <div class="net"><span class="caption">淨資產</span><span class="net-v">${bigMoney(a.net)}</span></div>
      <ul class="list">
        <li><a href="#" class="row-btn press" data-action="go" data-page="assets">
          <span class="ico" aria-hidden="true">${icon('bank')}</span>
          <span class="txt"><span class="t1">現金與存款</span><span class="t2">${a.liquid.map((x) => x.name).join('・')}</span></span>
          <span class="amt">${money(a.liquidSum)}</span>
        </a></li>
        ${a.cards.length ? `<li><a href="#" class="row-btn press" data-action="go" data-page="assets">
          <span class="ico" aria-hidden="true">${icon('card')}</span>
          <span class="txt"><span class="t1">信用卡待繳</span><span class="t2">${a.cards.map((x) => x.name).join('・')}</span></span>
          <span class="amt">${debt(a.cardSum)}</span>
        </a></li>` : ''}
        ${a.invest ? `<li><a href="#" class="row-btn press" data-demo="示意稿：這裡會跳到 Monee Invest">
          <span class="ico" aria-hidden="true">${icon('trend')}</span>
          <span class="txt"><span class="t1 with-icon">外部投資${icon('external', 14)}</span><span class="t2">Monee Invest 同步・08:00</span></span>
          <span class="amt-col"><span class="amt">${money(a.invest.balance)}</span><span class="pnl ${state.pnl}">${pnlText(a.invest)}</span></span>
        </a></li>` : ''}
      </ul>
    </div>
  </section>` : ''}`;
}

function renderHomeEmpty() {
  return `
  <header class="top">
    <div class="greet"><span class="caption">10月6日 週二</span><h1>歡迎來到 Monee</h1></div>
    <div class="top-actions">
      <button type="button" class="icon-btn avatar press" data-action="go" data-page="me" aria-label="我的・設定">${icon('user')}</button>
    </div>
  </header>

  <section class="hero" aria-labelledby="first-title">
    ${hero(`
      <h2 id="first-title" class="hero-title">今天還沒記帳</h2>
      <p class="hero-text">記下第一筆，Monee 就開始幫你看懂錢花去哪。</p>`, `
      <button type="button" class="btn-primary block press" data-action="open-sheet" aria-haspopup="dialog">記下第一筆${icon('arrow', 18)}</button>`)}
  </section>

  <section class="card setup" aria-labelledby="setup-title">
    <div class="setup-head"><h2 id="setup-title" class="h-sec">開始設定<span class="en">Setup</span></h2><span class="caption num">1 / 3</span></div>
    <ol class="steps">
      <li><div class="step done">
        <span class="step-dot" aria-hidden="true">${icon('check', 14, 2)}</span>
        <span class="txt"><span class="t1">建立帳號</span><span class="t2">已完成</span></span>
      </div></li>
      <li><button type="button" class="step press" data-demo="示意稿：新增帳戶還沒設計">
        <span class="step-dot" aria-hidden="true">2</span>
        <span class="txt"><span class="t1">新增帳戶</span><span class="t2">現金、銀行、信用卡都可以加</span></span>
        <span class="chev" aria-hidden="true">${icon('chevron', 18)}</span>
      </button></li>
      <li><button type="button" class="step press" data-action="go" data-page="me">
        <span class="step-dot" aria-hidden="true">3</span>
        <span class="txt"><span class="t1">設定每月預算</span><span class="t2">Monee 會算出你每天能花多少</span></span>
        <span class="chev" aria-hidden="true">${icon('chevron', 18)}</span>
      </button></li>
    </ol>
  </section>

  <section class="sec" aria-labelledby="recent-empty-title">
    <div class="sec-head"><h2 id="recent-empty-title" class="h-sec">最近交易<span class="en">Recent</span></h2></div>
    ${emptyBox('還沒有交易', '點下方 ＋，說一句「早餐 75」、拍張發票，或手動輸入都可以。')}
  </section>`;
}

// ---------- 頁面：明細 ----------
function renderTx() {
  const filters = [['all', '全部'], ['expense', '支出'], ['income', '收入'], ['transfer', '轉帳']];
  return `
  ${pageHead('明細', 'Transactions')}
  ${monthSwitch()}
  <div class="search">
    <label for="q" class="sr-only">搜尋交易</label>
    ${icon('search', 18)}
    <input id="q" type="search" placeholder="搜尋品項、分類或帳戶" value="${esc(state.txQuery)}" autocomplete="off">
  </div>
  <div class="pills" role="group" aria-label="交易類型">
    ${filters.map(([v, l]) => `<button type="button" class="pill press" data-action="tx-filter" data-value="${v}" aria-pressed="${state.txFilter === v}">${l}</button>`).join('')}
  </div>
  <div id="tx-list">${renderTxList()}</div>`;
}

function renderTxList() {
  if (!state.txs.length) return emptyBox('還沒有交易', '點下方 ＋ 記下第一筆，這裡就會依日期列出來。');
  const q = state.txQuery.trim();
  let list = state.txs;
  if (state.txFilter !== 'all') list = list.filter((t) => t.kind === state.txFilter);
  if (q) list = list.filter((t) => [t.title, CATS[t.cat].name, acctName(t.account), acctName(t.to)].join(' ').includes(q));
  if (!list.length) return emptyBox(q ? `找不到「${esc(q)}」` : '這個分類沒有交易', '換個關鍵字，或切回「全部」看看。');
  const exp = sum(list.filter((t) => t.kind === 'expense'));
  const inc = sum(list.filter((t) => t.kind === 'income'));
  return `
  <p class="tx-summary" aria-live="polite"><span>${list.length} 筆</span><span>支出 <span class="num">${money(exp)}</span></span><span>收入 <span class="num">${money(inc)}</span></span></p>
  <div class="days">
    ${groupByDay(list).map((g) => `
    <section class="day" aria-label="${dayLabel(g.date)}">
      <div class="day-head"><span>${dayLabel(g.date)}</span><span class="num">${g.spent ? '支出 ' + money(g.spent) : ''}</span></div>
      <div class="card list-card"><ul class="list">${g.items.map(txRow).join('')}</ul></div>
    </section>`).join('')}
  </div>`;
}

// ---------- 頁面：資產 ----------
function acctRow(a) {
  const ic = a.type === 'CASH' ? 'wallet' : a.type === 'BANK' ? 'bank' : 'card';
  return `
  <li><button type="button" class="row-btn press" data-action="reconcile" data-id="${a.id}">
    <span class="ico" aria-hidden="true">${icon(ic)}</span>
    <span class="txt"><span class="t1">${esc(a.name)}</span><span class="t2">${esc(a.sub)}</span></span>
    <span class="amt-col"><span class="amt">${debt(a.balance)}</span><span class="link-cap">校準餘額</span></span>
  </button></li>`;
}

function renderAssets() {
  if (!state.accounts.length) {
    return `${pageHead('資產', 'Assets')}
    ${emptyBox('還沒有帳戶', '新增現金、銀行或信用卡，Monee 就能幫你算出淨資產。')}
    <button type="button" class="add-btn press" data-demo="示意稿：新增帳戶還沒設計">${icon('plus', 18)}新增帳戶</button>`;
  }
  const a = acctStats();
  const group = (title, list, total) => (list.length ? `
    <section class="acct-group" aria-labelledby="g-${title}">
      <h2 id="g-${title}" class="group-title"><span>${title}</span><span class="num">${debt(total)}</span></h2>
      <div class="card list-card"><ul class="list">${list.map(acctRow).join('')}</ul></div>
    </section>` : '');
  return `
  ${pageHead('資產', 'Assets')}
  <section class="card net-card" aria-labelledby="net-title">
    <span id="net-title" class="caption">淨資產</span>
    <p class="big">${bigMoney(a.net)}</p>
    <div class="stats">
      <div class="stat"><span class="k">資產</span><span class="v">${money(a.assets)}</span></div>
      <div class="stat"><span class="k">負債</span><span class="v">${debt(a.cardSum)}</span></div>
    </div>
  </section>
  ${group('現金與銀行', a.liquid, a.liquidSum)}
  ${group('信用卡待繳', a.cards, a.cardSum)}
  ${a.invest ? `
  <section class="card invest" aria-labelledby="inv-title">
    <div class="row-between"><h2 id="inv-title" class="h-sec">外部投資<span class="en">Monee Invest</span></h2><span class="badge-soft">唯讀同步</span></div>
    <p class="big md">${bigMoney(a.invest.balance)}</p>
    <div class="row-between"><span class="caption">未實現損益</span><span class="pnl ${state.pnl}">${pnlText(a.invest)}</span></div>
    <div class="row-between">
      <span class="caption">同步於 ${a.invest.snapshot.synced}</span>
      <button type="button" class="btn-secondary press" data-demo="示意稿：這裡會跳到 Monee Invest">前往 Monee Invest${icon('external', 14)}</button>
    </div>
  </section>` : ''}
  <p class="note">${icon('infoCircle', 16)}<span>點帳戶可以校準餘額。轉進投資帳戶的錢會記成「轉帳」，不會算進生活支出。</span></p>
  <button type="button" class="add-btn press" data-demo="示意稿：新增帳戶還沒設計">${icon('plus', 18)}新增帳戶</button>`;
}

// ---------- 頁面：報表 ----------
function trendChart(months) {
  const W = 310, H = 186, L = 40, R = 6, T = 22, B = 156;
  const MAX = 30000;
  const y = (v) => B - (v / MAX) * (B - T);
  const slot = (W - L - R) / months.length;
  const bw = 20;
  const ticks = [0, 10000, 20000, 30000];
  const grid = ticks.map((v) => `
    <line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/>
    <text class="tick" x="${L - 8}" y="${y(v) + 4}" text-anchor="end">${state.hidden ? '' : v ? `${v / 1000}k` : '0'}</text>`).join('');
  const marks = months.map((m, i) => {
    const cx = L + slot * i + slot / 2;
    const x = cx - bw / 2;
    const top = y(m.value);
    const r = Math.min(4, B - top);
    const d = `M${x},${B}V${top + r}Q${x},${top} ${x + r},${top}H${x + bw - r}Q${x + bw},${top} ${x + bw},${top + r}V${B}Z`;
    const note = m.partial ? '，月份進行中' : m.value > BUDGET ? `，超出預算 ${money(m.value - BUDGET)}` : '';
    const tip = `${m.label}支出 ${money(m.value)}${note}`;
    return `
      <path class="bar-m${m.partial ? ' partial' : ''}" d="${d}"/>
      <text class="xlab" x="${cx}" y="${B + 20}" text-anchor="middle">${m.short}</text>
      ${m.partial ? `<text class="lbl" x="${cx}" y="${top - 8}" text-anchor="middle">${state.hidden ? '••••' : fmt(m.value)}</text>` : ''}
      <rect class="hit" x="${L + slot * i}" y="${T}" width="${slot}" height="${B - T}" tabindex="0" role="img" aria-label="${tip}" data-tip="${tip}" data-x="${cx}" data-y="${top}"/>`;
  }).join('');
  return `
  <div class="chart" data-w="${W}" data-h="${H}">
    <svg viewBox="0 0 ${W} ${H}" role="group" aria-label="近 6 個月每月支出">
      <g class="grid">${grid}</g>
      <line class="budget" x1="${L}" x2="${W - R}" y1="${y(BUDGET)}" y2="${y(BUDGET)}"/>
      ${marks}
    </svg>
    <div class="tip" aria-hidden="true"></div>
  </div>`;
}

function renderReports() {
  const expenses = state.txs.filter((t) => t.kind === 'expense');
  if (!expenses.length) {
    return `${pageHead('報表', 'Reports')}${monthSwitch()}
    ${emptyBox('還沒有資料', '記帳幾天後，這裡會整理出你的花費分類和每月趨勢。')}`;
  }
  const s = stats();
  const byCat = Object.entries(expenses.reduce((m, t) => ({ ...m, [t.cat]: (m[t.cat] || 0) + t.amount }), {}))
    .map(([cat, amount]) => ({ cat, amount }))
    .sort((a, b) => b.amount - a.amount);
  const max = byCat[0].amount;
  const months = [...PAST_MONTHS, { short: '本月', label: '10 月', value: s.monthExpense, partial: true }];
  const kpi = (k, v) => `<div class="kpi"><span class="k">${k}</span><span class="v">${v}</span></div>`;
  return `
  ${pageHead('報表', 'Reports')}
  ${monthSwitch()}
  <div class="kpis">
    ${kpi('支出', money(s.monthExpense))}
    ${kpi('收入', money(s.income))}
    ${kpi('結餘', money(s.income - s.monthExpense))}
    ${kpi('預算已用', `${s.usedPct}%`)}
  </div>

  <section class="card chart-card" aria-labelledby="cat-title">
    <div class="row-between"><h2 id="cat-title" class="h-sec">支出分類<span class="en">By category</span></h2><span class="caption num">${money(s.monthExpense)}</span></div>
    <ul class="cat-list">
      ${byCat.map((c) => `
      <li class="cat-row">
        <span class="cat-name"><span class="ico sm" aria-hidden="true">${icon(CATS[c.cat].icon, 16)}</span>${CATS[c.cat].name}</span>
        <span class="cat-val">${money(c.amount)}<small>${Math.round((c.amount / s.monthExpense) * 100)}%</small></span>
        <span class="cat-bar" aria-hidden="true"><i style="width:${(c.amount / max) * 100}%"></i></span>
      </li>`).join('')}
    </ul>
  </section>

  <section class="card chart-card" aria-labelledby="trend-title">
    <div class="row-between"><h2 id="trend-title" class="h-sec">每月支出<span class="en">Monthly</span></h2><span class="caption">虛線＝預算 ${money(BUDGET)}</span></div>
    ${trendChart(months)}
    <details class="table-view">
      <summary>看數字</summary>
      <table>
        <thead><tr><th scope="col">月份</th><th scope="col" class="r">支出</th><th scope="col" class="r">與預算差</th></tr></thead>
        <tbody>${months.map((m) => `<tr><td>${m.label}${m.partial ? '（進行中）' : ''}</td><td class="r">${money(m.value)}</td><td class="r">${state.hidden ? MASK : (m.value > BUDGET ? '+' : '−') + fmt(m.value - BUDGET)}</td></tr>`).join('')}</tbody>
      </table>
    </details>
  </section>

  <section class="wrapped" aria-labelledby="wrapped-title">
    <span class="en-label">2026 Wrapped</span>
    <h2 id="wrapped-title">你的年度金錢故事</h2>
    <p>12 月 31 日解鎖：一年花最多的地方、最省的月份，還有 Monee 給你的小結語。</p>
    <img src="${MASCOT}" alt="" width="124" height="90">
  </section>`;
}

// ---------- 頁面：我的 ----------
function renderMe() {
  const row = (ic, label, val, demo) => `
    <button type="button" class="set-row press" data-demo="${demo}">
      <span class="ico sm" aria-hidden="true">${icon(ic, 16)}</span>${label}<span class="val">${val}</span>${icon('chevron', 18)}
    </button>`;
  const seg = (action, options, current) => `
    <div class="pills" role="group">${options.map(([v, l]) => `<button type="button" class="pill press" data-action="${action}" data-value="${v}" aria-pressed="${current === v}">${l}</button>`).join('')}</div>`;
  const expenseCats = Object.values(CATS).filter((c) => c.kind === 'expense').length;
  return `
  <header class="page-head with-back">
    <button type="button" class="icon-btn ghost press" data-action="back" aria-label="返回">${icon('chevLeft')}</button>
    <h1>我的<span class="en">Settings</span></h1>
  </header>
  <section class="card profile">
    <span class="avatar-lg" aria-hidden="true">${icon('user', 24)}</span>
    <span class="txt"><span class="t1">Monee 使用者</span><span class="t2">記帳第 6 天 · ${state.txs.length} 筆紀錄</span></span>
  </section>

  <section class="set-group" aria-labelledby="s-book">
    <h2 id="s-book" class="group-title">記帳設定</h2>
    <div class="card">
      ${row('target', '每月預算', money(BUDGET), '示意稿：預算設定還沒設計')}
      ${row('tag', '分類管理', `${expenseCats} 個支出分類`, '示意稿：分類管理還沒設計')}
      ${row('card', '預設帳戶', '國泰信用卡', '示意稿：預設帳戶還沒設計')}
    </div>
  </section>

  <section class="set-group" aria-labelledby="s-look">
    <h2 id="s-look" class="group-title">外觀</h2>
    <div class="card set-block">${seg('set-theme', [['light', '淺色'], ['dark', '深色'], ['system', '跟隨系統']], state.theme)}</div>
  </section>

  <section class="set-group" aria-labelledby="s-pnl">
    <h2 id="s-pnl" class="group-title">投資漲跌配色</h2>
    <div class="card set-block">${seg('set-pnl', [['red', '紅漲綠跌（台股）'], ['green', '綠漲紅跌']], state.pnl)}</div>
  </section>

  <section class="set-group" aria-labelledby="s-data">
    <h2 id="s-data" class="group-title">資料</h2>
    <div class="card">
      ${row('sheetIcon', '匯出到 Google Sheets', '單向匯出', '示意稿：Phase 2 才會做匯出')}
      ${row('cloud', '資料備份', '上次 10/5 23:00', '示意稿：資料備份還沒設計')}
    </div>
  </section>
  <p class="caption foot-note">Monee 0.1.0・設計原型</p>`;
}

// ---------- 底部導覽 ----------
function renderNav() {
  const tab = (page, ic, label) =>
    `<a href="#" class="tab press" data-action="go" data-page="${page}"${state.page === page ? ' aria-current="page"' : ''}><span class="tab-ico">${icon(ic, 22)}</span><span>${label}</span></a>`;
  return `
    ${tab('home', 'home', '首頁')}
    ${tab('tx', 'list', '明細')}
    <div class="fab-wrap">
      <button type="button" class="fab press" data-action="open-sheet" aria-haspopup="dialog" aria-label="記一筆">${icon('plus', 26, 2)}</button>
      <span aria-hidden="true">記一筆</span>
    </div>
    ${tab('assets', 'wallet', '資產')}
    ${tab('reports', 'pie', '報表')}`;
}

// ---------- 底部面板 ----------
const sheetHead = (title, en, sub, back) => `
  <div class="handle" aria-hidden="true"></div>
  <div class="sheet-head">
    <div class="titles">
      ${back ? `<button type="button" class="icon-btn ghost press" data-action="sheet" data-to="menu" aria-label="回上一步">${icon('chevLeft')}</button>` : ''}
      <div><h2 id="sheet-title">${title}<span class="en">${en}</span></h2>${sub ? `<p class="caption">${sub}</p>` : ''}</div>
    </div>
    <button type="button" class="icon-btn press" data-action="close-sheet" aria-label="關閉">${icon('x')}</button>
  </div>`;

function sheetMenu() {
  return `
  ${sheetHead('記一筆', 'New entry', '想怎麼記都可以，Monee 幫你整理')}
  <ul class="opts">
    <li><button type="button" class="opt featured press" data-action="sheet" data-to="voice">
      <span class="ico mic" aria-hidden="true">${icon('mic', 22)}</span>
      <span class="txt"><span class="t1">說一句<span class="badge">AI</span></span><span class="t2">「晚餐牛肉麵 180，刷國泰」</span></span>
      <span class="chev" aria-hidden="true">${icon('arrow', 18)}</span>
    </button></li>
    <li><button type="button" class="opt press" data-action="sheet" data-to="camera">
      <span class="ico" aria-hidden="true">${icon('camera', 22)}</span>
      <span class="txt"><span class="t1">拍收據／發票<span class="badge">AI</span></span><span class="t2">自動辨識金額、品項與日期</span></span>
      <span class="chev" aria-hidden="true">${icon('arrow', 18)}</span>
    </button></li>
    <li><button type="button" class="opt press" data-action="sheet" data-to="manual">
      <span class="ico" aria-hidden="true">${icon('calc', 22)}</span>
      <span class="txt"><span class="t1">手動輸入</span><span class="t2">用數字鍵盤自己記</span></span>
      <span class="chev" aria-hidden="true">${icon('arrow', 18)}</span>
    </button></li>
  </ul>
  <div class="quick-wrap">
    <h3 class="caption">最近常用・點一下帶入草稿</h3>
    <div class="quick">
      ${QUICK.map((q, i) => `<button type="button" class="cchip press" data-action="quick" data-i="${i}">${icon(CATS[q.cat].icon, 16)}${q.title.split('・')[0]} <span class="num">${fmt(q.amount)}</span></button>`).join('')}
    </div>
  </div>`;
}

const VOICE_TEXT = '晚餐牛肉麵 180，刷國泰';
function sheetVoice() {
  return `
  ${sheetHead('說一句', 'Voice', '說出品項、金額和付款方式', true)}
  <div class="voice">
    <button type="button" class="mic-big" data-action="voice-done" aria-label="說完了，整理成草稿">${icon('mic', 34)}</button>
    <p class="voice-status" id="voice-status">正在聽…</p>
    <p class="transcript" id="transcript" aria-live="polite"><span class="caret"></span></p>
    <button type="button" class="btn-secondary press" data-action="voice-done">說完了</button>
  </div>`;
}

function sheetCamera() {
  return `
  ${sheetHead('拍收據／發票', 'Scan', '對準收據或發票，保持平穩', true)}
  <div class="viewfinder" id="vf" aria-hidden="true">
    <span class="corner tl"></span><span class="corner tr"></span><span class="corner bl"></span><span class="corner br"></span>
    <div class="receipt-mock"><b>全家便利商店</b><i style="width:70%"></i><i style="width:90%"></i><i style="width:55%"></i><i style="width:80%"></i><span class="r-total">$139</span></div>
    <span class="scan-line"></span>
  </div>
  <p class="voice-status" id="cam-status" aria-live="polite" style="text-align:center">準備好就按下快門</p>
  <div class="shutter-row"><button type="button" class="shutter" data-action="shoot" aria-label="拍照"></button></div>`;
}

function sheetManual() {
  const m = state.manual;
  const cats = Object.entries(CATS).filter(([, c]) => c.kind === m.type);
  const accounts = selectableAccounts();
  const types = [['expense', '支出'], ['income', '收入'], ['transfer', '轉帳']];
  const chips = (action, list, current) => list.map(([v, l, ic]) =>
    `<button type="button" class="cchip press" data-action="${action}" data-value="${v}" aria-pressed="${current === v}">${ic ? icon(ic, 16) : ''}${l}</button>`).join('');
  const amount = Number(m.amount) || 0;
  return `
  ${sheetHead('手動輸入', 'Manual', '', true)}
  <div class="pills" role="group" aria-label="類型">${chips('m-type', types, m.type)}</div>
  <div class="amount-display${amount ? '' : ' placeholder'}" aria-live="polite"><small>$</small><span>${amount ? amount.toLocaleString('en-US') : '0'}</span></div>
  ${m.type !== 'transfer' ? `
  <div class="manual-group"><span class="field-label" id="m-cat-l">分類</span>
    <div class="pills" role="group" aria-labelledby="m-cat-l">${chips('m-cat', cats.map(([id, c]) => [id, c.name, c.icon]), m.cat)}</div></div>` : ''}
  <div class="manual-group"><span class="field-label" id="m-acct-l">${m.type === 'transfer' ? '轉出帳戶' : '帳戶'}</span>
    <div class="pills" role="group" aria-labelledby="m-acct-l">${chips('m-acct', accounts.map((a) => [a.id, a.name]), m.account)}</div></div>
  ${m.type === 'transfer' ? `
  <div class="manual-group"><span class="field-label" id="m-to-l">轉入帳戶</span>
    <div class="pills" role="group" aria-labelledby="m-to-l">${chips('m-to', state.accounts.filter((a) => a.id !== m.account).map((a) => [a.id, a.name]), m.to)}</div></div>` : ''}
  <label for="m-note" class="sr-only">品項或備註</label>
  <input id="m-note" class="note-input" placeholder="品項或備註（選填）" value="${esc(m.note)}" autocomplete="off">
  <div class="keypad" role="group" aria-label="數字鍵盤">
    ${['1', '2', '3', '4', '5', '6', '7', '8', '9', '00', '0', 'del'].map((k) =>
      `<button type="button" class="key press" data-action="m-key" data-value="${k}"${k === 'del' ? ' aria-label="刪除一位"' : ''}>${k === 'del' ? icon('del', 22) : k}</button>`).join('')}
  </div>
  <button type="button" class="btn-primary block press" data-action="m-save"${amount > 0 && (m.type !== 'transfer' || m.to) ? '' : ' disabled'}>記下${amount ? ` ${fmt(amount)}` : ''}</button>`;
}

function sheetDraft() {
  const d = state.draft;
  const src = { voice: '來自語音', ocr: '來自發票辨識', quick: '來自最近常用' }[d.source];
  const expenseCats = Object.entries(CATS).filter(([, c]) => c.kind === 'expense');
  const accounts = selectableAccounts();
  const low = (f) => d.low.includes(f);
  const select = (id, options, current) => `
    <span class="ctl"><select id="${id}">${options.map(([v, l]) => `<option value="${v}"${v === current ? ' selected' : ''}>${l}</option>`).join('')}</select>${icon('chevDown', 16)}</span>`;
  return `
  ${sheetHead('確認草稿', 'Draft', '')}
  <div class="draft-src"><span class="src-k">${icon('sparkles', 14)}${src}</span><q>${esc(d.raw)}</q></div>
  <p class="conf">辨識信心 <span class="num">${Math.round(d.confidence * 100)}%</span>${d.low.length ? '・有欄位需要你確認' : ''}</p>
  <div class="fields">
    <div class="field amount"><label for="d-amount">金額</label><span class="ctl"><span class="cur">$</span><input id="d-amount" inputmode="numeric" value="${d.amount}" autocomplete="off"></span></div>
    <div class="field"><label for="d-title">品項</label><span class="ctl"><input id="d-title" value="${esc(d.title)}" autocomplete="off"></span></div>
    <div class="field"><label for="d-cat">分類</label>${select('d-cat', expenseCats.map(([id, c]) => [id, c.name]), d.cat)}</div>
    <div class="field${low('account') ? ' low' : ''}"><label for="d-account">帳戶${low('account') ? '<span class="flag">請確認</span>' : ''}</label>${select('d-account', accounts.map((a) => [a.id, a.name]), d.account)}</div>
    <div class="field"><span class="lbl-static">日期</span><span class="static">今天 10/6・${nowTime()}</span></div>
  </div>
  <p class="field-error" id="d-error" role="alert"></p>
  <div class="btn-col">
    <button type="button" class="btn-primary block press" data-action="draft-save">確認寫入</button>
    <button type="button" class="btn-secondary block press" data-action="sheet" data-to="menu">重新輸入</button>
  </div>`;
}

function recDiff() {
  const a = acct(state.reconcile.id);
  const digits = state.reconcile.input.replace(/\D/g, '');
  if (!digits) return null;
  const v = Number(digits);
  const actual = a.type === 'CREDIT_CARD' ? -v : v;
  return actual - a.balance;
}
function recResult() {
  const d = recDiff();
  if (d === null) return '<p class="caption">輸入後，Monee 會幫你算出跟紀錄的差額。</p>';
  if (d === 0) return `<p class="ok">${icon('okCircle', 16)}跟紀錄一致，不用調整。</p>`;
  return `<p class="diff-line">與紀錄相差 <b>${fmt(d)}</b></p>
    <p class="caption">${d < 0 ? '實際比紀錄少，可能有漏記的花費。要用「未記錄雜項」補一筆支出嗎？' : '實際比紀錄多，可能有漏記的收入。要用「未記錄收入」補一筆嗎？'}</p>`;
}
function recActions() {
  const d = recDiff();
  if (d === null) return '<button type="button" class="btn-primary block" disabled>補齊差額</button>';
  if (d === 0) return '<button type="button" class="btn-primary block press" data-action="close-sheet">完成</button>';
  return `<button type="button" class="btn-primary block press" data-action="rec-apply">${d < 0 ? '以未記錄雜項補齊' : '以未記錄收入補齊'}</button>
    <button type="button" class="btn-secondary block press" data-action="close-sheet">我再檢查一下</button>`;
}
function sheetReconcile() {
  const a = acct(state.reconcile.id);
  const card = a.type === 'CREDIT_CARD';
  return `
  ${sheetHead('校準餘額', 'Reconcile', esc(a.name))}
  <div class="rec-row"><span class="caption">Monee 紀錄的${card ? '待繳金額' : '餘額'}</span><span class="num">${fmt(Math.abs(a.balance))}</span></div>
  <div class="rec-field">
    <label for="rec-input" class="field-label">${card ? '信用卡 App 顯示的待繳金額' : '銀行 App 顯示的餘額'}</label>
    <div class="rec-input"><span>$</span><input id="rec-input" inputmode="numeric" placeholder="0" autocomplete="off" value="${esc(state.reconcile.input)}" data-autofocus></div>
  </div>
  <div class="rec-result" id="rec-result" aria-live="polite">${recResult()}</div>
  <div class="btn-col" id="rec-actions">${recActions()}</div>`;
}

function selectableAccounts() {
  const list = state.accounts.filter((a) => a.type !== 'INVESTMENT_MIRROR');
  return list.length ? list : [{ id: 'cash', name: '現金' }];
}

const SHEETS = { menu: sheetMenu, voice: sheetVoice, camera: sheetCamera, manual: sheetManual, draft: sheetDraft, reconcile: sheetReconcile };

// ---------- 畫面更新 ----------
const phone = document.getElementById('phone');
const scroll = document.getElementById('scroll');
const nav = document.getElementById('nav');
const sheet = document.getElementById('sheet');
const toastEl = document.getElementById('toast');
const PAGES = { home: renderHome, tx: renderTx, assets: renderAssets, reports: renderReports, me: renderMe };
const PAGE_NAMES = { home: 'Monee 首頁', tx: '明細', assets: '資產', reports: '報表', me: '我的' };

function render(keepScroll = false) {
  const top = scroll.scrollTop;
  scroll.innerHTML = PAGES[state.page]();
  scroll.setAttribute('aria-label', PAGE_NAMES[state.page]);
  scroll.scrollTop = keepScroll ? top : 0;
  nav.innerHTML = renderNav();
}

function refocus(selector) {
  document.querySelector(selector)?.focus();
}

function go(page) {
  if (page === state.page) {
    scroll.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    return;
  }
  if (page === 'me') state.prevPage = state.page;
  state.page = page;
  render();
  scroll.focus({ preventScroll: true });
}

let toastTimer;
function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2400);
}

// ---------- 面板開關與流程 ----------
let opener = null;
let timers = [];
const later = (fn, ms) => timers.push(setTimeout(fn, ms));
const clearTimers = () => { timers.forEach(clearTimeout); timers = []; };

function renderSheet(focusSelector) {
  sheet.innerHTML = SHEETS[state.sheet]();
  const target = (focusSelector && sheet.querySelector(focusSelector))
    || sheet.querySelector('[data-autofocus]')
    || sheet.querySelector('[data-action="close-sheet"]');
  target?.focus();
}

function openSheet(view, from) {
  if (!phone.classList.contains('open')) opener = from;
  showSheet(view);
  phone.classList.add('open');
  scroll.inert = true;
  nav.inert = true;
  sheet.inert = false;
}

function showSheet(view, focusSelector) {
  clearTimers();
  if (view === 'manual') state.manual = { type: 'expense', amount: '', cat: 'food', account: selectableAccounts()[0].id, to: '', note: '' };
  state.sheet = view;
  sheet.scrollTop = 0;
  renderSheet(focusSelector);
  if (view === 'voice') startVoice();
}

function closeSheet() {
  clearTimers();
  phone.classList.remove('open');
  scroll.inert = false;
  nav.inert = false;
  sheet.inert = true;
  state.sheet = null;
  (opener && document.contains(opener) ? opener : document.querySelector('.fab'))?.focus();
}

function startVoice() {
  const out = document.getElementById('transcript');
  [...VOICE_TEXT].forEach((_, i) => later(() => {
    out.innerHTML = `${esc(VOICE_TEXT.slice(0, i + 1))}<span class="caret"></span>`;
  }, 400 + i * 90));
  later(finishVoice, 400 + VOICE_TEXT.length * 90 + 700);
}
function finishVoice() {
  clearTimers();
  const status = document.getElementById('voice-status');
  if (status) status.textContent = '整理中…';
  later(() => {
    state.draft = { source: 'voice', raw: VOICE_TEXT, confidence: 0.94, title: '晚餐・牛肉麵', amount: 180, cat: 'food', account: 'cathay', low: [] };
    showSheet('draft');
  }, 600);
}

function shoot() {
  const vf = document.getElementById('vf');
  if (vf.classList.contains('scanning')) return;
  vf.classList.add('scanning');
  document.getElementById('cam-status').textContent = '辨識中…';
  later(() => {
    state.draft = { source: 'ocr', raw: '全家便利商店／排骨便當 89／綠茶 50／合計 139', confidence: 0.78, title: '全家・便當＋綠茶', amount: 139, cat: 'food', account: 'cash', low: ['account'] };
    showSheet('draft');
  }, 1500);
}

function addTx(t, { stay = false } = {}) {
  if (!state.accounts.length) state.accounts.push({ id: 'cash', name: '現金', type: 'CASH', balance: 0, sub: '錢包' });
  state.txs.push(t);
  applyToAccounts(state.accounts, t);
  state.added += 1;
  state.flashId = t.id;
  closeSheet();
  if (!stay && state.page !== 'tx') state.page = 'home';
  render(stay);
  setTimeout(() => { state.flashId = null; }, 1600);
}

function saveDraft() {
  const amount = Number(document.getElementById('d-amount').value.replace(/\D/g, ''));
  const error = document.getElementById('d-error');
  if (!amount) {
    error.textContent = '請輸入金額';
    document.getElementById('d-amount').focus();
    return;
  }
  const title = document.getElementById('d-title').value.trim() || '未命名';
  const cat = document.getElementById('d-cat').value;
  const account = document.getElementById('d-account').value;
  const t = { id: `n${state.added}`, date: TODAY, time: nowTime(), title, cat, account, amount, kind: 'expense' };
  addTx(t);
  toast(`已記下：${title} ${fmt(amount)}`);
}

function saveManual() {
  const m = state.manual;
  const amount = Number(m.amount);
  const cat = m.type === 'transfer' ? 'transfer' : m.cat;
  const title = m.note.trim() || CATS[cat].name;
  const t = { id: `n${state.added}`, date: TODAY, time: nowTime(), title, cat, account: m.account, amount, kind: m.type, ...(m.type === 'transfer' ? { to: m.to } : {}) };
  addTx(t);
  toast(`已記下：${title} ${fmt(amount)}`);
}

function applyReconcile() {
  const a = acct(state.reconcile.id);
  const d = recDiff();
  const expense = d < 0;
  const t = {
    id: `n${state.added}`, date: TODAY, time: nowTime(),
    title: expense ? '未記錄雜項' : '未記錄收入', cat: expense ? 'other' : 'incomeOther',
    account: a.id, amount: Math.abs(d), kind: expense ? 'expense' : 'income',
  };
  a.sub = a.sub.replace(/上次校準 [\d/]+/, '上次校準 10/6');
  addTx(t, { stay: true });
  toast(`已補記${t.title} ${fmt(t.amount)}，餘額已校準`);
}

// ---------- 事件 ----------
phone.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action], [data-demo], a[href="#"]');
  if (!el || el.disabled) return;
  if (el.tagName === 'A') e.preventDefault();
  const { action, value } = el.dataset;
  const m = state.manual;

  switch (action) {
    case 'go': go(el.dataset.page); return;
    case 'back': go(state.prevPage || 'home'); return;
    case 'toggle-hidden': state.hidden = !state.hidden; render(true); refocus('#eye'); return;
    case 'open-sheet': openSheet('menu', el); return;
    case 'close-sheet': closeSheet(); return;
    case 'sheet': showSheet(el.dataset.to); return;
    case 'quick': {
      const q = QUICK[Number(el.dataset.i)];
      state.draft = { source: 'quick', raw: `${q.title}・${fmt(q.amount)}`, confidence: 1, ...q, low: [] };
      showSheet('draft');
      return;
    }
    case 'voice-done': finishVoice(); return;
    case 'shoot': shoot(); return;
    case 'm-type': {
      m.type = value;
      m.cat = Object.keys(CATS).find((k) => CATS[k].kind === value);
      m.to = '';
      renderSheet(`[data-action="m-type"][data-value="${value}"]`);
      return;
    }
    case 'm-cat': m.cat = value; renderSheet(`[data-action="m-cat"][data-value="${value}"]`); return;
    case 'm-acct': m.account = value; if (m.to === value) m.to = ''; renderSheet(`[data-action="m-acct"][data-value="${value}"]`); return;
    case 'm-to': m.to = value; renderSheet(`[data-action="m-to"][data-value="${value}"]`); return;
    case 'm-key': {
      if (value === 'del') m.amount = m.amount.slice(0, -1);
      else if (m.amount.length < 8 && !(m.amount === '' && value.startsWith('0'))) m.amount += value;
      renderSheet(`[data-action="m-key"][data-value="${value}"]`);
      return;
    }
    case 'm-save': saveManual(); return;
    case 'draft-save': saveDraft(); return;
    case 'reconcile': state.reconcile = { id: el.dataset.id, input: '' }; openSheet('reconcile', el); return;
    case 'rec-apply': applyReconcile(); return;
    case 'tx-filter': state.txFilter = value; render(true); refocus(`[data-action="tx-filter"][data-value="${value}"]`); return;
    case 'set-theme': setTheme(value); render(true); refocus(`[data-action="set-theme"][data-value="${value}"]`); return;
    case 'set-pnl': state.pnl = value; render(true); refocus(`[data-action="set-pnl"][data-value="${value}"]`); return;
    default: break;
  }
  if (el.dataset.demo) toast(el.dataset.demo);
  else toast('示意稿：這一頁還沒設計');
});

phone.addEventListener('input', (e) => {
  const { id, value } = e.target;
  if (id === 'q') {
    state.txQuery = value;
    document.getElementById('tx-list').innerHTML = renderTxList();
  } else if (id === 'm-note') {
    state.manual.note = value;
  } else if (id === 'rec-input') {
    state.reconcile.input = value;
    document.getElementById('rec-result').innerHTML = recResult();
    document.getElementById('rec-actions').innerHTML = recActions();
  } else if (id === 'd-amount') {
    document.getElementById('d-error').textContent = '';
  }
});

phone.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && phone.classList.contains('open')) closeSheet();
});

// 報表直條的提示框：滑鼠移入或鍵盤聚焦都會顯示
function showTip(hit) {
  const chart = hit.closest('.chart');
  const tip = chart.querySelector('.tip');
  tip.textContent = hit.dataset.tip;
  tip.style.left = `${(hit.dataset.x / chart.dataset.w) * 100}%`;
  tip.style.top = `${(hit.dataset.y / chart.dataset.h) * 100}%`;
  tip.classList.add('show');
}
function hideTip(hit) {
  hit.closest('.chart')?.querySelector('.tip')?.classList.remove('show');
}
scroll.addEventListener('pointerover', (e) => { if (e.target.classList?.contains('hit')) showTip(e.target); });
scroll.addEventListener('pointerout', (e) => { if (e.target.classList?.contains('hit')) hideTip(e.target); });
scroll.addEventListener('focusin', (e) => { if (e.target.classList?.contains('hit')) showTip(e.target); });
scroll.addEventListener('focusout', (e) => { if (e.target.classList?.contains('hit')) hideTip(e.target); });

// ---------- 外觀與右側面板 ----------
const darkMQ = matchMedia('(prefers-color-scheme: dark)');
function setTheme(value) {
  state.theme = value;
  const dark = value === 'dark' || (value === 'system' && darkMQ.matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  const radio = document.querySelector(`input[name="theme"][value="${value}"]`);
  if (radio) radio.checked = true;
}
darkMQ.addEventListener('change', () => setTheme(state.theme));

document.querySelectorAll('input[name="theme"]').forEach((r) => r.addEventListener('change', () => {
  setTheme(r.value);
  if (state.page === 'me') render(true);
}));
document.querySelectorAll('input[name="scenario"]').forEach((r) => r.addEventListener('change', () => {
  if (phone.classList.contains('open')) closeSheet();
  Object.assign(state, buildScenario(r.value), { scenario: r.value, added: 0, txQuery: '', txFilter: 'all' });
  render();
}));

scroll.tabIndex = -1;
setTheme('light');
render();
