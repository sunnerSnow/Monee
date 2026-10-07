// Monee 分帳互動原型：左邊是你的 App，右邊是朋友點分享連結看到的網頁，兩邊共用同一份資料。

// ---------- 圖示（Lucide） ----------
const P = {
  home: '<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  list: '<path d="M3 12h.01"/><path d="M3 18h.01"/><path d="M3 6h.01"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M8 6h13"/>',
  wallet: '<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>',
  pie: '<path d="M21 12c.552 0 1.005-.449.95-.998a10 10 0 0 0-8.953-8.951c-.55-.055-.998.398-.998.95v8a1 1 0 0 0 1 1z"/><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/>',
  plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
  minus: '<path d="M5 12h14"/>',
  utensils: '<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/>',
  tram: '<rect width="16" height="16" x="4" y="3" rx="2"/><path d="M4 11h16"/><path d="M12 3v8"/><path d="m8 19-2 3"/><path d="m18 22-2-3"/><path d="M8 15h.01"/><path d="M16 15h.01"/>',
  basket: '<path d="m15 11-1 9"/><path d="m19 11-4-7"/><path d="M2 11h20"/><path d="m3.5 11 1.6 7.4a2 2 0 0 0 2 1.6h9.8a2 2 0 0 0 2-1.6l1.7-7.4"/><path d="M4.5 15.5h15"/><path d="m5 11 4-7"/><path d="m9 11 1 9"/>',
  bag: '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>',
  ticket: '<path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/><path d="M13 5v2"/><path d="M13 17v2"/><path d="M13 11v2"/>',
  heart: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
  dots: '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>',
  banknote: '<rect width="20" height="12" x="2" y="6" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/>',
  card: '<rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/>',
  bank: '<line x1="3" x2="21" y1="22" y2="22"/><line x1="6" x2="6" y1="18" y2="11"/><line x1="10" x2="10" y1="18" y2="11"/><line x1="14" x2="14" y1="18" y2="11"/><line x1="18" x2="18" y1="18" y2="11"/><polygon points="12 2 20 7 4 7"/>',
  chevron: '<path d="m9 18 6-6-6-6"/>',
  chevLeft: '<path d="m15 18-6-6 6-6"/>',
  arrow: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" x2="15.42" y1="13.51" y2="17.49"/><line x1="15.41" x2="8.59" y1="6.51" y2="10.49"/>',
  copy: '<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
  inbox: '<polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
  sparkles: '<path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>',
  trash: '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
  pencil: '<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/>',
};
const icon = (name, size = 20, sw = 1.5) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name]}</svg>`;

// ---------- 常數 ----------
const ME = '我';
const OWNER = 'Yuki'; // 朋友頁上看到的你
const TODAY = '2026-10-07';
const NOW = '21:30';
const MASCOT = '../Monee.png';
const WEEK = ['日', '一', '二', '三', '四', '五', '六'];
const SHARE_URL = 'monee.app/s/8fK2x9Qa';
const BASE_NET = 177070; // 你的帳戶淨額（不含朋友往來）

// 跟正式版的分類一致
const CATS = {
  food: { name: '餐飲', icon: 'utensils' },
  transit: { name: '交通', icon: 'tram' },
  daily: { name: '日用', icon: 'basket' },
  shopping: { name: '購物', icon: 'bag' },
  fun: { name: '娛樂', icon: 'ticket' },
  health: { name: '醫療', icon: 'heart' },
  other: { name: '其他', icon: 'dots' },
};
const ACCOUNTS = [
  { id: 'cash', name: '現金', icon: 'banknote', balance: 3250 },
  { id: 'cathay', name: '國泰信用卡', icon: 'card', balance: -12480 },
  { id: 'esun', name: '玉山銀行', icon: 'bank', balance: 186300 },
];
const MODES = [['equal', '平分'], ['exact', '指定金額'], ['shares', '份數']];

// ---------- 範例資料 ----------
let seq = 100;
const uid = (p) => `${p}${++seq}`;
const ex = (id, date, time, title, cat, amount, payer, split, extra = {}) =>
  ({ id, date, time, title, cat, amount, payer, account: payer === ME ? 'cathay' : null, addedBy: ME, pending: false, ...split, ...extra });
/** 一輪結算：全部還清時，那段期間的花費和還款會一起收進來 */
const round = (id, closedAt, expenses, settlements) => ({ id, closedAt, expenses, settlements });
const stl = (from, to, amount, date, account = null) => ({ id: uid('s'), from, to, amount, status: 'confirmed', account, date });

function seed() {
  const yms = [ME, '小明', '小華', '阿美'];
  return {
    groups: [
      {
        id: 'g1', name: '週六陽明山', kind: 'event', date: '2026-10-03', members: yms, allowFriendAdd: true, settlements: [], rounds: [],
        expenses: [
          ex('e1', '2026-10-03', '08:30', '早餐・永和豆漿', 'food', 360, '小明', { mode: 'equal', who: yms }),
          ex('e2', '2026-10-03', '09:40', '停車費', 'transit', 200, ME, { mode: 'equal', who: yms }, { account: 'cash' }),
          ex('e3', '2026-10-03', '12:20', '午餐・野菜鍋', 'food', 1840, ME, { mode: 'exact', exact: { [ME]: 520, 小明: 480, 小華: 410, 阿美: 430 } }),
          ex('e4', '2026-10-03', '15:10', '擎天崗・咖啡', 'food', 480, '阿美', { mode: 'equal', who: [ME, '小華', '阿美'] }),
          ex('e5', '2026-10-03', '18:30', '晚餐・士林夜市', 'food', 1200, '小華', { mode: 'equal', who: yms }),
          ex('e6', '2026-10-03', '20:50', '計程車回家', 'transit', 380, '小明', { mode: 'shares', shares: { [ME]: 1, 小明: 1 } }, { addedBy: '小明', pending: true }),
        ],
      },
      {
        id: 'g2', name: '室友', kind: 'daily', members: [ME, '阿凱'], allowFriendAdd: true, settlements: [],
        expenses: [
          ex('r1', '2026-10-01', '20:10', '9 月電費', 'other', 1860, ME, { mode: 'equal', who: [ME, '阿凱'] }, { account: 'esun' }),
          ex('r2', '2026-10-03', '19:30', '衛生紙・洗碗精', 'daily', 389, '阿凱', { mode: 'equal', who: [ME, '阿凱'] }),
          ex('r3', '2026-10-05', '10:00', '網路費', 'other', 599, ME, { mode: 'equal', who: [ME, '阿凱'] }),
        ],
        rounds: [round('rd1', '2026-09-30', [
          ex('rp1', '2026-09-02', '20:00', '8 月電費', 'other', 1720, ME, { mode: 'equal', who: [ME, '阿凱'] }, { account: 'esun' }),
          ex('rp2', '2026-09-14', '18:40', '衛生紙・垃圾袋', 'daily', 420, '阿凱', { mode: 'equal', who: [ME, '阿凱'] }),
        ], [stl('阿凱', ME, 650, '9/30', 'esun')])],
      },
      {
        id: 'g3', name: '公司午餐團', kind: 'daily', members: [ME, 'Joy', 'Ken', 'Mia'], allowFriendAdd: false, settlements: [],
        expenses: [
          ex('l1', '2026-10-06', '12:15', '午餐・便當', 'food', 480, 'Joy', { mode: 'equal', who: [ME, 'Joy', 'Ken', 'Mia'] }),
          ex('l2', '2026-10-07', '15:00', '下午茶・飲料', 'food', 200, 'Ken', { mode: 'equal', who: [ME, 'Joy', 'Ken', 'Mia'] }),
        ],
        rounds: [round('rd2', '2026-09-30', [
          ex('lp1', '2026-09-23', '12:10', '午餐・牛肉麵', 'food', 720, ME, { mode: 'equal', who: [ME, 'Joy', 'Ken', 'Mia'] }),
          ex('lp2', '2026-09-26', '15:20', '下午茶・蛋糕', 'food', 400, 'Mia', { mode: 'equal', who: [ME, 'Joy', 'Ken', 'Mia'] }),
        ], [stl('Joy', ME, 280, '9/29', 'esun'), stl('Ken', ME, 160, '9/30', 'cash'), stl('Ken', 'Mia', 120, '9/30')])],
      },
      {
        id: 'g4', name: '中秋烤肉', kind: 'event', date: '2026-09-26', members: [ME, '阿凱', '小美', 'Joy'], allowFriendAdd: true, settlements: [], expenses: [],
        rounds: [round('rd3', '2026-09-28', [
          ex('bp1', '2026-09-26', '16:00', '烤肉食材', 'food', 2400, ME, { mode: 'equal', who: [ME, '阿凱', '小美', 'Joy'] }),
          ex('bp2', '2026-09-26', '17:30', '飲料・冰塊', 'food', 360, '小美', { mode: 'equal', who: [ME, '阿凱', '小美', 'Joy'] }),
        ], [stl('阿凱', ME, 690, '9/27', 'esun'), stl('Joy', ME, 690, '9/28', 'esun'), stl('小美', ME, 330, '9/28', 'cash')])],
      },
    ],
    inbox: [{ id: 'i1', type: 'expense', groupId: 'g1', expenseId: 'e6', from: '小明' }],
    pay: { bank: '國泰世華 013・0123-4567-8901', linepay: 'monee-yuki' },
    me: { page: 'assets', groupId: 'g1', tab: 'expenses' },
    friend: { groupId: 'g1', who: null },
  };
}
let state = seed();

// ---------- 小工具 ----------
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (n) => '$' + Math.abs(Math.round(n)).toLocaleString('en-US');
const sumOf = (arr) => arr.reduce((s, v) => s + v, 0);
const groupById = (id) => state.groups.find((g) => g.id === id);
const allExpenses = (g) => [...g.expenses, ...g.rounds.flatMap((r) => r.expenses)];
const allSettlements = (g) => [...g.settlements, ...g.rounds.flatMap((r) => r.settlements)];
/** 已結清：目前沒有未結清的花費，而且結算過（剛建好的空群組不算） */
const isSettled = (g) => !g.expenses.length && g.rounds.length > 0;
const openGroups = () => state.groups.filter((g) => !isSettled(g));
const settledGroups = () => state.groups.filter(isSettled);
const md = (iso) => { const [, m, d] = iso.split('-').map(Number); return `${m}/${d}`; };
/** 這個人有沒有出現在任何花費或還款裡（包含已結清的；有的話不能移除，不然帳會對不起來） */
const involved = (g, m) => allExpenses(g).some((e) => e.payer === m || shareMap(e)[m]) || allSettlements(g).some((s) => s.from === m || s.to === m);
const acctName = (id) => ACCOUNTS.find((a) => a.id === id)?.name ?? '';
const shortDate = (iso) => { const d = new Date(`${iso}T00:00:00Z`); return `${d.getUTCMonth() + 1}/${d.getUTCDate()} 週${WEEK[d.getUTCDay()]}`; };
const kindText = (g) => (g.kind === 'event' ? `活動・${shortDate(g.date)}` : '日常');

/** 名字在不同畫面的顯示：你的 App 裡你是「我」，朋友頁上你是 Yuki、正在看的朋友是「你」 */
const nameIn = (view, n) => (view === 'me' ? n : n === ME ? OWNER : n === state.friend.who ? '你' : n);
/** 頭像字：中文名取最後一個字（小明→明、小華→華，比較分得出來），英文取第一個字母 */
const initial = (label) => (/^[一-鿿]{2,}$/.test(label) ? label.slice(-1) : label.slice(0, 1).toUpperCase());
const av = (view, n, cls = '') => {
  const label = nameIn(view, n);
  const isOwner = view === 'me' ? n === ME : n === state.friend.who;
  return `<span class="av ${isOwner ? 'me' : ''} ${cls}" aria-hidden="true">${esc(initial(label))}</span>`;
};
const avs = (view, members) => `<span class="avs">${members.slice(0, 5).map((m) => av(view, m)).join('')}</span>`;

// ---------- 分帳計算 ----------
/** 依權重分配整數金額；除不盡的零頭給小數最大的人（同分時排前面的人） */
function allocate(total, weights) {
  const names = Object.keys(weights).filter((n) => weights[n] > 0);
  const W = sumOf(names.map((n) => weights[n]));
  if (!W || !total) return Object.fromEntries(names.map((n) => [n, 0]));
  const raw = names.map((n) => (total * weights[n]) / W);
  const base = raw.map(Math.floor);
  const order = names.map((_, i) => i).sort((a, b) => (raw[b] - base[b]) - (raw[a] - base[a]) || a - b);
  for (let k = 0; k < total - sumOf(base); k++) base[order[k]] += 1;
  return Object.fromEntries(names.map((n, i) => [n, base[i]]));
}

/** 每個人在這筆花費要負擔多少 */
function shareMap(e) {
  if (e.mode === 'exact') return Object.fromEntries(Object.entries(e.exact).filter(([, v]) => v > 0));
  if (e.mode === 'shares') return allocate(e.amount, e.shares);
  return allocate(e.amount, Object.fromEntries(e.who.map((n) => [n, 1])));
}
const participants = (e) => Object.keys(shareMap(e));

/** 每個人的淨額：正數是別人欠他，負數是他欠別人。只算已確認的還款 */
function balances(g) {
  const net = Object.fromEntries(g.members.map((m) => [m, 0]));
  for (const e of g.expenses) {
    net[e.payer] += e.amount;
    for (const [n, v] of Object.entries(shareMap(e))) net[n] -= v;
  }
  for (const s of g.settlements) {
    if (s.status !== 'confirmed') continue;
    net[s.from] += s.amount;
    net[s.to] -= s.amount;
  }
  return net;
}

/** 建議的還款方式：每次讓欠最多的人還給被欠最多的人，轉帳次數最少（最多 人數−1 筆） */
function suggest(net) {
  const cred = Object.entries(net).filter(([, v]) => v > 0).map(([n, v]) => ({ n, v }));
  const debt = Object.entries(net).filter(([, v]) => v < 0).map(([n, v]) => ({ n, v: -v }));
  const out = [];
  while (cred.length && debt.length) {
    cred.sort((a, b) => b.v - a.v);
    debt.sort((a, b) => b.v - a.v);
    const c = cred[0];
    const d = debt[0];
    const x = Math.min(c.v, d.v);
    out.push({ from: d.n, to: c.n, amount: x });
    c.v -= x;
    d.v -= x;
    if (!c.v) cred.shift();
    if (!d.v) debt.shift();
  }
  return out;
}

/** 全部還清就把這一輪收起來：花費和還款移進「已結清的紀錄」，列表只留還沒結清的 */
function closeIfSettled(g) {
  if (!g.expenses.length || g.expenses.some((e) => e.pending) || g.settlements.some((s) => s.status === 'waiting')) return false;
  if (Object.values(balances(g)).some((v) => v !== 0)) return false;
  g.rounds.unshift(round(uid('r'), TODAY, g.expenses, g.settlements));
  g.expenses = [];
  g.settlements = [];
  return true;
}
const closedToast = (g) => `都結清了！「${g.name}」這 ${g.rounds[0].expenses.length} 筆收進已結清的紀錄`;

function friendTotals() {
  let recv = 0;
  let pay = 0;
  for (const g of state.groups) {
    const v = balances(g)[ME];
    if (v > 0) recv += v;
    else pay -= v;
  }
  return { recv, pay, net: recv - pay };
}

const modeText = (e) => {
  const n = participants(e).length;
  return e.mode === 'exact' ? `${n} 人指定金額` : e.mode === 'shares' ? `${n} 人依份數分` : `${n} 人平分`;
};

/** 這筆花費怎麼記進你的個人帳 */
function effectLines(e) {
  const mine = shareMap(e)[ME] || 0;
  const cat = CATS[e.cat]?.name ?? '其他';
  if (e.payer === ME) {
    const lent = e.amount - mine;
    return [
      `${esc(acctName(e.account))}實付 <b>${fmt(e.amount)}</b>`,
      mine ? `你的支出 <b>${fmt(mine)}</b>（${cat}），報表和預算只算這個` : '你沒有參與，不算你的支出',
      lent ? `代墊 <b>${fmt(lent)}</b> 記在朋友往來，等朋友還你` : '',
    ].filter(Boolean);
  }
  if (mine) return [`${esc(e.payer)}先付，你這次不用掏錢`, `你的支出 <b>${fmt(mine)}</b>（${cat}）`, `欠 ${esc(e.payer)} <b>${fmt(mine)}</b>，記在朋友往來`];
  return ['你沒有參與，不影響你的帳'];
}

// ---------- 手機外殼 ----------
const phones = {};
for (const id of ['me', 'friend']) {
  const el = document.getElementById(id);
  phones[id] = {
    id, el,
    scroll: el.querySelector('[data-role="scroll"]'),
    nav: el.querySelector('[data-role="nav"]'),
    sheet: el.querySelector('[data-role="sheet"]'),
    toastEl: el.querySelector('[data-role="toast"]'),
    view: null, opener: null, timer: null,
  };
}

function toast(ph, msg) {
  ph.toastEl.textContent = msg;
  ph.toastEl.classList.add('show');
  clearTimeout(ph.timer);
  ph.timer = setTimeout(() => ph.toastEl.classList.remove('show'), 2600);
}

function openSheet(ph, view, opener) {
  if (!ph.el.classList.contains('open')) ph.opener = opener ?? document.activeElement;
  ph.view = view;
  renderSheet(ph, false);
  ph.el.classList.add('open');
  ph.scroll.inert = true;
  if (ph.nav) ph.nav.inert = true;
  ph.sheet.inert = false;
  ph.sheet.scrollTop = 0;
  requestAnimationFrame(() => (ph.sheet.querySelector('[data-autofocus]') ?? ph.sheet.querySelector('button, input'))?.focus());
}

function closeSheet(ph) {
  ph.el.classList.remove('open');
  ph.scroll.inert = false;
  if (ph.nav) ph.nav.inert = false;
  ph.sheet.inert = true;
  ph.view = null;
  if (ph.opener && document.contains(ph.opener)) ph.opener.focus();
}

/** 重畫面板內容，並把焦點放回原本的控制項（用 data-fk 對應） */
function renderSheet(ph, keepFocus = true) {
  const fk = keepFocus ? document.activeElement?.dataset?.fk : null;
  const top = ph.sheet.scrollTop;
  ph.sheet.innerHTML = SHEETS[ph.view.kind](ph, ph.view);
  if (keepFocus) ph.sheet.scrollTop = top;
  if (fk) ph.sheet.querySelector(`[data-fk="${fk}"]`)?.focus();
}

const sheetHead = (ph, title, en, sub) => `
  <div class="handle" aria-hidden="true"></div>
  <div class="sheet-head">
    <div class="titles"><div><h2 id="${ph.id}-sheet-title">${title}<span class="en">${en}</span></h2>${sub ? `<p class="caption">${sub}</p>` : ''}</div></div>
    <button type="button" class="icon-btn press" data-action="close-sheet" aria-label="關閉">${icon('x')}</button>
  </div>`;

function renderAll() {
  renderMe();
  renderFriend();
}

// ---------- 你的 App：頁面 ----------
function renderMe() {
  const ph = phones.me;
  const page = state.me.page;
  const keep = ph.scroll.dataset.page === page + (state.me.groupId ?? '') ? ph.scroll.scrollTop : 0;
  ph.scroll.innerHTML = page === 'home' ? pageHome() : page === 'tx' ? pageTx() : page === 'assets' ? pageAssets() : page === 'split' ? pageSplit() : page === 'group' ? pageGroup() : pageOther();
  ph.scroll.dataset.page = page + (state.me.groupId ?? '');
  ph.scroll.scrollTop = keep;
  const active = ['assets', 'split', 'group'].includes(page) ? 'assets' : page;
  const tab = (p, ic, label) => `<a href="#" class="tab press" data-action="go" data-page="${p}"${active === p ? ' aria-current="page"' : ''}><span class="tab-ico">${icon(ic, 22)}</span><span>${label}</span></a>`;
  ph.nav.innerHTML = `${tab('home', 'home', '首頁')}${tab('tx', 'list', '明細')}
    <div class="fab-wrap"><button type="button" class="fab press" data-action="fab" aria-haspopup="dialog" aria-label="記一筆">${icon('plus', 26, 2)}</button><span aria-hidden="true">記一筆</span></div>
    ${tab('assets', 'wallet', '資產')}${tab('reports', 'pie', '報表')}`;
}

const oweText = (v) => {
  if (v > 0) return `<span class="owe"><span class="owe-k">你應收</span>${fmt(v)}</span>`;
  if (v < 0) return `<span class="owe neg"><span class="owe-k">你應付</span>${fmt(v)}</span>`;
  return '<span class="owe zero">已結清</span>';
};

function pageAssets() {
  const f = friendTotals();
  return `
  <header class="page-head"><h1>資產<span class="en">Assets</span></h1></header>
  <section class="card net-card" aria-labelledby="nw-title">
    <span class="caption" id="nw-title">淨資產</span>
    <p class="big md"><small>$</small>${(BASE_NET + f.net).toLocaleString('en-US')}</p>
    <p class="caption" style="margin:0;line-height:1.8">含朋友欠你的 ${fmt(f.recv)}，已扣掉你欠朋友的 ${fmt(f.pay)}</p>
  </section>
  <section class="acct-group" aria-labelledby="acc-title">
    <h2 class="group-title" id="acc-title">帳戶</h2>
    <ul class="card list list-card">${ACCOUNTS.map((a) => `
      <li><div class="row-btn"><span class="ico">${icon(a.icon)}</span><span class="txt"><span class="t1">${a.name}</span></span>
      <span class="amt">${a.balance < 0 ? '−' : ''}${fmt(a.balance)}</span></div></li>`).join('')}
    </ul>
  </section>
  <section class="acct-group" aria-labelledby="fr-title">
    <h2 class="group-title" id="fr-title"><span>朋友往來</span><span class="num">淨額 ${f.net < 0 ? '−' : '+'}${fmt(f.net)}</span></h2>
    <ul class="card list list-card">${openGroups().map((g) => `
      <li><button type="button" class="row-btn press" data-action="open-group" data-id="${g.id}">
        ${avs('me', g.members.filter((m) => m !== ME))}
        <span class="txt"><span class="t1">${esc(g.name)}</span><span class="t2">${kindText(g)}・${g.members.length} 人</span></span>
        ${oweText(balances(g)[ME])}
      </button></li>`).join('')}
    </ul>
    <a href="#" class="more" data-action="go" data-page="split" style="align-self:flex-end">${settledGroups().length ? `已結清 ${settledGroups().length} 個・` : ''}全部分帳${icon('arrow', 16)}</a>
  </section>`;
}

const inboxBtn = (items) => items.length ? `
  <button type="button" class="inbox-btn press" data-action="open-inbox">
    ${icon('inbox')}<span style="flex:1">有 ${items.length} 件分帳等你確認</span><span class="count">${items.length}</span>
  </button>` : '';

function pageSplit() {
  const f = friendTotals();
  const settled = settledGroups();
  return `
  <header class="page-head with-back">
    <button type="button" class="icon-btn ghost press" data-action="go" data-page="assets" aria-label="返回資產">${icon('chevLeft')}</button>
    <h1>分帳<span class="en">Split</span></h1>
  </header>
  <div class="stats">
    <div class="stat in"><span class="k">朋友欠你</span><span class="v">${fmt(f.recv)}</span></div>
    <div class="stat"><span class="k">你欠朋友</span><span class="v">${fmt(f.pay)}</span></div>
  </div>
  ${inboxBtn(state.inbox)}
  <section class="sec" aria-labelledby="groups-title">
    <div class="sec-head"><h2 class="h-sec" id="groups-title">群組<span class="en">Groups</span></h2></div>
    ${openGroups().map((g) => `
      <button type="button" class="group-card press" data-action="open-group" data-id="${g.id}">
        <span class="gc-top"><span class="gc-name">${esc(g.name)}</span><span class="badge-soft">${kindText(g)}</span></span>
        <span class="gc-bottom">
          <span style="display:flex;align-items:center;gap:10px">${avs('me', g.members)}<span class="caption">${g.expenses.length ? `未結清 ${g.expenses.length} 筆・${fmt(sumOf(g.expenses.map((e) => e.amount)))}` : '還沒有花費'}</span></span>
          ${oweText(balances(g)[ME])}
        </span>
      </button>`).join('')}
    <button type="button" class="add-btn press" data-action="new-group">${icon('plus', 18)}建立群組</button>
  </section>
  ${settled.length ? `<details class="table-view">
    <summary>已結清 ${settled.length} 個群組</summary>
    <ul class="card list list-card">${settled.map((g) => `
      <li><button type="button" class="row-btn press" data-action="open-group" data-id="${g.id}">${avs('me', g.members.filter((m) => m !== ME))}
        <span class="txt"><span class="t1">${esc(g.name)}</span><span class="t2">${md(g.rounds[0].closedAt)} 結清・共 ${allExpenses(g).length} 筆</span></span>
        <span class="owe zero">已結清</span></button></li>`).join('')}
    </ul></details>` : ''}
  <p class="note">${icon('info', 14)}全部還清的群組會自動收到「已結清」，有新花費就會回到上面。群組右上角「⋯」可以改名、加人；按分享用 LINE 傳連結給朋友。</p>`;
}

function pageHome() {
  const f = friendTotals();
  const open = openGroups().filter((g) => balances(g)[ME] !== 0).length;
  return `
  <header class="page-head"><h1>早安<span class="en">Home</span></h1></header>
  <div class="empty-box"><p class="e1">今日額度・本月預算</p><p class="e2">沿用正式版，原型省略。下面是分帳在首頁的樣子。</p></div>
  ${inboxBtn(state.inbox)}
  ${open ? `<section class="sec" aria-labelledby="home-split">
    <div class="sec-head"><h2 class="h-sec" id="home-split">朋友往來<span class="en">Split</span></h2>
      <a href="#" class="more" data-action="go" data-page="split">分帳${icon('arrow', 16)}</a></div>
    <button type="button" class="group-card press" data-action="go" data-page="split">
      <span class="gc-top"><span class="gc-name">${open} 個群組還沒結清</span>${icon('chevron', 18)}</span>
      <span class="gc-bottom"><span class="owe"><span class="owe-k">朋友欠你</span>${fmt(f.recv)}</span><span class="owe neg"><span class="owe-k">你欠朋友</span>${fmt(f.pay)}</span></span>
    </button>
  </section>` : ''}
  <p class="note">${icon('info', 14)}首頁只在有待確認、或還沒結清時才出現分帳；都結清就收起來。平常的入口在「資產 → 朋友往來」。</p>`;
}

function pageGroup() {
  const g = groupById(state.me.groupId);
  const net = balances(g);
  const mine = net[ME];
  const total = sumOf(g.expenses.map((e) => e.amount));
  const tab = state.me.tab;
  return `
  <header class="page-head with-back">
    <button type="button" class="icon-btn ghost press" data-action="go" data-page="split" aria-label="返回分帳">${icon('chevLeft')}</button>
    <h1 style="flex:1;min-width:0">${esc(g.name)}</h1>
    <button type="button" class="icon-btn press" data-action="share" aria-label="分享給朋友" aria-haspopup="dialog">${icon('share')}</button>
    <button type="button" class="icon-btn press" data-action="group-settings" aria-label="群組設定" aria-haspopup="dialog">${icon('dots')}</button>
  </header>
  <section class="card g-hero" aria-label="你在這個群組">
    <span class="caption">${mine > 0 ? '朋友總共欠你' : mine < 0 ? '你總共要付' : '你在這個群組'}</span>
    <p class="big ${mine < 0 ? 'neg' : ''}">${mine ? `<small>$</small>${Math.abs(mine).toLocaleString('en-US')}` : '已結清'}</p>
    <div class="g-meta">${avs('me', g.members)}<span class="caption">${g.members.length} 人・${g.expenses.length ? `未結清 ${g.expenses.length} 筆・${fmt(total)}` : g.rounds.length ? `${md(g.rounds[0].closedAt)} 結清` : '還沒有花費'}</span></div>
  </section>
  ${inboxBtn(state.inbox.filter((i) => i.groupId === g.id))}
  <div class="tabs" role="tablist" aria-label="群組內容">
    <button type="button" role="tab" aria-selected="${tab === 'expenses'}" data-action="tab" data-tab="expenses">花費 ${g.expenses.length}</button>
    <button type="button" role="tab" aria-selected="${tab === 'settle'}" data-action="tab" data-tab="settle">結算</button>
  </div>
  ${tab === 'expenses' ? groupExpenses(g) : groupSettle(g, net)}`;
}

function groupExpenses(g) {
  const days = {};
  for (const e of g.expenses) (days[e.date] ??= []).push(e);
  const dates = Object.keys(days).sort().reverse();
  return `
  <button type="button" class="add-btn press" data-action="add-expense">${icon('plus', 18)}新增花費</button>
  ${dates.length ? `<div class="days">${dates.map((d) => {
    const list = days[d].sort((a, b) => b.time.localeCompare(a.time));
    return `<section class="day" aria-label="${shortDate(d)}">
      <div class="day-head"><span>${shortDate(d)}</span><span class="num">${fmt(sumOf(list.map((e) => e.amount)))}</span></div>
      <ul class="card list list-card">${list.map((e) => {
        const mine = shareMap(e)[ME];
        return `<li><button type="button" class="row-btn press" data-action="open-expense" data-id="${e.id}">
          <span class="ico">${icon(CATS[e.cat]?.icon ?? 'dots')}</span>
          <span class="txt">
            <span class="t1 with-icon">${esc(e.title)}${e.pending ? ' <span class="tag">待確認</span>' : ''}</span>
            <span class="t2">${esc(e.payer)}付 ${fmt(e.amount)}・${modeText(e)}</span>
          </span>
          <span class="amt-col">${mine ? `<span class="mine">${fmt(mine)}</span><span class="link-cap">你的部分</span>` : '<span class="mine none">沒參與</span>'}</span>
        </button></li>`;
      }).join('')}</ul></section>`;
  }).join('')}</div>` : g.rounds.length
    ? `<div class="empty-box"><p class="e1">目前沒有未結清的花費</p><p class="e2">${md(g.rounds[0].closedAt)} 全部結清了。新的花費記在這裡，之前的收在下面。</p></div>`
    : `<div class="empty-box"><p class="e1">還沒有花費</p><p class="e2">出去玩的一整天可以一筆一筆記，每筆可以是不同人先付，最後再一起結算。</p></div>`}
  ${roundsSection(g)}`;
}

/** 已結清的紀錄：一輪一列，點進去看那次的花費和還款 */
function roundsSection(g) {
  if (!g.rounds.length) return '';
  return `<section class="sec" aria-labelledby="rounds-title">
    <div class="sec-head"><h2 class="h-sec" id="rounds-title">已結清的紀錄<span class="en">History</span></h2></div>
    <ul class="card list list-card">${g.rounds.map((r) => {
      const dates = r.expenses.map((e) => e.date).sort();
      const mine = sumOf(r.expenses.map((e) => shareMap(e)[ME] || 0));
      return `<li><button type="button" class="row-btn press" data-action="open-round" data-id="${r.id}">
        <span class="ico tr">${icon('check')}</span>
        <span class="txt"><span class="t1">${md(r.closedAt)} 結清</span><span class="t2">${md(dates[0])}${dates[0] !== dates.at(-1) ? `–${md(dates.at(-1))}` : ''}・${r.expenses.length} 筆・總花費 ${fmt(sumOf(r.expenses.map((e) => e.amount)))}</span></span>
        <span class="amt-col"><span class="mine">${fmt(mine)}</span><span class="link-cap">你的部分</span></span>
      </button></li>`;
    }).join('')}</ul>
    <p class="note">${icon('info', 14)}全部還清時，那段期間的花費會自動收到這裡，列表只留還沒結清的。你的明細裡每一筆都還在。</p>
  </section>`;
}

function groupSettle(g, net) {
  const sugg = suggest(net);
  const max = Math.max(1, ...Object.values(net).map(Math.abs));
  const waiting = g.settlements.filter((s) => s.status === 'waiting');
  const done = g.settlements.filter((s) => s.status === 'confirmed');
  const history = done.length ? `
    <section class="sec" aria-labelledby="hist-title">
      <div class="sec-head"><h2 class="h-sec" id="hist-title">已還款<span class="en">Paid</span></h2></div>
      <ul class="xfer-list">${done.map((s) => `
        <li class="xfer done"><span class="who">${esc(s.from)} <span class="arrow">${icon('arrow', 14)}</span> ${esc(s.to)}<span class="caption">・${s.date}${s.account ? `・${esc(acctName(s.account))}` : ''}</span></span>
        <span class="amt num">${fmt(s.amount)}</span></li>`).join('')}</ul>
    </section>` : '';
  if (!sugg.length) {
    return `<div class="card done-box"><img src="${MASCOT}" alt=""><p class="h-sec">都結清了</p><p class="caption">這個群組沒有人欠錢。${g.rounds.length ? '之前的花費收在「花費」分頁下面的已結清紀錄，' : ''}之後有新花費繼續記在這裡就好。</p></div>${history}`;
  }
  return `
  <section class="card" aria-labelledby="bal-title">
    <h2 class="sr-only" id="bal-title">每個人的淨額</h2>
    <ul class="bal-list">${g.members.map((m) => {
      const v = net[m];
      const w = (Math.abs(v) / max) * 50;
      return `<li class="bal">${av('me', m)}
        <span class="mid"><span class="name">${esc(m)}</span><span class="bar2" aria-hidden="true">${v ? `<i class="${v > 0 ? 'pos' : 'neg'}" style="width:${w}%"></i>` : ''}</span></span>
        ${v > 0 ? `<span class="owe"><span class="owe-k">應收</span>${fmt(v)}</span>` : v < 0 ? `<span class="owe neg"><span class="owe-k">應付</span>${fmt(v)}</span>` : '<span class="owe zero">已結清</span>'}
      </li>`;
    }).join('')}</ul>
  </section>
  <section class="sec" aria-labelledby="sugg-title">
    <div class="sec-head"><h2 class="h-sec" id="sugg-title">建議怎麼還<span class="en">Settle up</span></h2></div>
    <p class="caption" style="margin:-4px 4px 0">${sugg.length} 筆轉帳就能全部結清（不用每筆花費各自還）</p>
    <ul class="xfer-list">${sugg.map((s) => {
      const w = waiting.find((x) => x.from === s.from && x.to === s.to);
      let btn;
      if (s.to === ME) btn = w ? `<button type="button" class="btn-secondary press" data-action="open-inbox">確認收款</button>` : `<button type="button" class="btn-secondary press" data-action="receive" data-from="${esc(s.from)}" data-amount="${s.amount}">記錄已收款</button>`;
      else if (s.from === ME) btn = `<button type="button" class="btn-secondary press" data-action="pay" data-to="${esc(s.to)}" data-amount="${s.amount}">我已付款</button>`;
      else btn = `<button type="button" class="btn-secondary press" data-action="mark-friend" data-from="${esc(s.from)}" data-to="${esc(s.to)}" data-amount="${s.amount}">標記已付</button>`;
      return `<li class="xfer ${w ? 'waiting' : ''}">
        <span class="who">${esc(s.from)} <span class="arrow">${icon('arrow', 14)}</span> ${esc(s.to)}${w ? '<span class="tag">說已付款</span>' : ''}</span>
        <span class="amt num">${fmt(s.amount)}</span>${btn}</li>`;
    }).join('')}</ul>
    <p class="note">${icon('info', 14)}朋友之間的還款他們自己處理就好，任何人都可以幫忙標記已付。</p>
  </section>
  ${history}`;
}

function pageTx() {
  const rows = state.groups.flatMap((g) => allExpenses(g)
    .filter((e) => shareMap(e)[ME] && !e.pending)
    .map((e) => ({ e, g, settled: !g.expenses.includes(e) })));
  rows.sort((a, b) => (b.e.date + b.e.time).localeCompare(a.e.date + a.e.time));
  const days = {};
  for (const r of rows) (days[r.e.date] ??= []).push(r);
  return `
  <header class="page-head"><h1>明細<span class="en">Transactions</span></h1></header>
  <p class="note">${icon('info', 14)}原型只列分帳的花費（正式版跟一般記帳混在一起）。只算你的部分；群組結清後會收起來，但這裡每一筆都還在。待確認的花費確認後才會出現。</p>
  <div class="days">${Object.keys(days).sort().reverse().map((d) => `
    <section class="day" aria-label="${shortDate(d)}">
      <div class="day-head"><span>${shortDate(d)}</span><span class="num">−${fmt(sumOf(days[d].map((r) => shareMap(r.e)[ME])))}</span></div>
      <ul class="card list list-card">${days[d].map(({ e, g, settled }) => `
        <li><div class="row-btn"><span class="ico">${icon(CATS[e.cat]?.icon ?? 'dots')}</span>
          <span class="txt"><span class="t1">${esc(e.title)}</span><span class="t2">分帳・${esc(g.name)}${settled ? '・已結清' : ''}</span></span>
          <span class="amt">−${fmt(shareMap(e)[ME])}</span></div></li>`).join('')}</ul>
    </section>`).join('')}</div>`;
}

function pageOther() {
  return `<header class="page-head"><h1>原型只做分帳<span class="en">Prototype</span></h1></header>
    <div class="empty-box"><p class="e1">這頁沿用正式版</p><p class="e2">分帳的入口在「資產」最下面的「朋友往來」，或按底部 ＋ 記一筆時打開「分帳」。</p></div>
    <button type="button" class="btn-primary block press" data-action="go" data-page="assets">到資產頁${icon('arrow', 18)}</button>`;
}

// ---------- 朋友看到的頁面 ----------
function renderFriend() {
  const ph = phones.friend;
  const g = groupById(state.friend.groupId);
  const who = state.friend.who;
  ph.scroll.innerHTML = !who || !g.members.includes(who) ? friendPick(g) : friendMain(g, who);
}

function friendPick(g) {
  return `
  <header class="f-head">
    <span class="caption">${OWNER} 分享給你的分帳</span>
    <h1>${esc(g.name)}</h1>
    <span class="caption">${kindText(g)}・${g.members.length} 人・${g.expenses.length ? `未結清 ${g.expenses.length} 筆` : '都結清了'}</span>
  </header>
  <section class="sec" aria-labelledby="who-title">
    <h2 class="h-sec" id="who-title">你是誰？</h2>
    <div class="who-grid">${g.members.filter((m) => m !== ME).map((m) => `
      <button type="button" class="who-btn press" data-action="pick-who" data-name="${esc(m)}"><span class="av lg" aria-hidden="true">${esc(initial(m))}</span>${esc(m)}</button>`).join('')}
    </div>
    <p class="note">${icon('info', 14)}不用下載 App、不用註冊。選了之後這支手機會記住你是誰。</p>
  </section>
  <p class="f-foot"><img src="${MASCOT}" alt="">Monee 分帳</p>`;
}

function friendMain(g, who) {
  const net = balances(g);
  const sugg = suggest(net);
  const pays = sugg.filter((s) => s.from === who);
  const gets = sugg.filter((s) => s.to === who);
  const waitOwner = g.settlements.find((s) => s.status === 'waiting' && s.from === who && s.to === ME);
  const myExp = g.expenses.filter((e) => shareMap(e)[who]);
  const myTotal = sumOf(myExp.map((e) => shareMap(e)[who]));

  let hero;
  if (pays.length) {
    hero = `<p class="k">你要付</p><p class="big"><small>$</small>${sumOf(pays.map((s) => s.amount)).toLocaleString('en-US')}</p>
      <p class="caption" style="margin:0;line-height:1.8">${pays.map((s) => `給 ${esc(nameIn('friend', s.to))} ${fmt(s.amount)}`).join('、')}${waitOwner ? `<br>付給 ${OWNER} 的 ${fmt(waitOwner.amount)} 等 ${OWNER} 確認中` : ''}</p>`;
  } else if (gets.length) {
    hero = `<p class="k">你會收到</p><p class="big"><small>$</small>${sumOf(gets.map((s) => s.amount)).toLocaleString('en-US')}</p>
      <p class="caption" style="margin:0">${gets.map((s) => `${esc(nameIn('friend', s.from))} 會給你 ${fmt(s.amount)}`).join('、')}</p>`;
  } else {
    hero = `<p class="k">你的狀態</p><p class="big">已結清</p><p class="caption" style="margin:0">這個群組你不欠錢，也沒人欠你。</p>`;
  }

  const toOwner = pays.find((s) => s.to === ME);
  const toFriends = pays.filter((s) => s.to !== ME);
  const payCard = toOwner ? `
    <section class="card" style="padding:var(--space-4) var(--space-5);display:flex;flex-direction:column;gap:var(--space-3)" aria-labelledby="payto-title">
      <h2 class="h-sec" id="payto-title">付給 ${OWNER}<span class="num" style="margin-left:auto;font-weight:300">${fmt(toOwner.amount)}</span></h2>
      <ul class="pay-list">
        <li class="pay-row"><span class="txt"><span class="t2">銀行轉帳</span><span class="t1 num" style="font-size:14px">${esc(state.pay.bank)}</span></span><button type="button" class="btn-secondary press" data-action="copy" data-text="${esc(state.pay.bank)}">${icon('copy', 14)}複製</button></li>
        <li class="pay-row"><span class="txt"><span class="t2">LINE Pay ID</span><span class="t1 num" style="font-size:14px">${esc(state.pay.linepay)}</span></span><button type="button" class="btn-secondary press" data-action="copy" data-text="${esc(state.pay.linepay)}">${icon('copy', 14)}複製</button></li>
      </ul>
      ${waitOwner
        ? `<p class="caption" style="margin:0;display:flex;align-items:center;gap:6px">${icon('check', 16)}已通知 ${OWNER}，等 ${OWNER} 確認收到</p>`
        : `<button type="button" class="btn-primary block press" data-action="friend-paid" data-amount="${toOwner.amount}">我已付款給 ${OWNER}</button>`}
    </section>` : '';
  const friendPays = toFriends.length ? `
    <section class="card" style="padding:var(--space-4) var(--space-5);display:flex;flex-direction:column;gap:var(--space-2)">
      ${toFriends.map((s) => `<div class="pay-row"><span class="txt"><span class="t1">付給 ${esc(s.to)} ${fmt(s.amount)}</span><span class="t2">收款方式請直接問 ${esc(s.to)}</span></span>
        <button type="button" class="btn-secondary press" data-action="mark-friend" data-from="${esc(s.from)}" data-to="${esc(s.to)}" data-amount="${s.amount}">標記已付</button></div>`).join('')}
    </section>` : '';

  return `
  <header class="f-head">
    <span class="caption">${OWNER} 分享給你的分帳</span>
    <h1 tabindex="-1" data-focus-after-pick>${esc(g.name)}</h1>
    <span class="caption" style="display:flex;align-items:center;gap:8px">嗨，${esc(who)}・<a href="#" data-action="switch-who" style="color:var(--text)">不是你？</a></span>
  </header>
  <section class="owe-hero" aria-label="你的結算"><span class="hero-blob" aria-hidden="true"></span>${hero}</section>
  ${payCard}${friendPays}
  ${g.allowFriendAdd ? `<button type="button" class="add-btn press" data-action="friend-add">${icon('plus', 18)}新增一筆（你先付的也可以記）</button>` : ''}
  <section class="sec" aria-labelledby="mine-title">
    <div class="sec-head"><h2 class="h-sec" id="mine-title">你的花費</h2><span class="caption num">共 ${fmt(myTotal)}</span></div>
    ${myExp.length ? `<ul class="card list list-card">${myExp.map((e) => `
      <li><div class="row-btn"><span class="ico">${icon(CATS[e.cat]?.icon ?? 'dots')}</span>
        <span class="txt"><span class="t1">${esc(e.title)}</span><span class="t2">${esc(nameIn('friend', e.payer))}付 ${fmt(e.amount)}・${modeText(e)}</span></span>
        <span class="amt">${fmt(shareMap(e)[who])}</span></div></li>`).join('')}</ul>` : `<p class="caption">${g.rounds.length ? '目前沒有未結清的花費。' : '這個群組還沒有你的花費。'}</p>`}
  </section>
  ${g.expenses.length ? `<details class="table-view">
    <summary>看這次全部 ${g.expenses.length} 筆花費</summary>
    <table><thead><tr><th>品項</th><th>誰付</th><th class="r">金額</th></tr></thead>
    <tbody>${g.expenses.map((e) => `<tr><td>${esc(e.title)}</td><td>${esc(nameIn('friend', e.payer))}</td><td class="r">${fmt(e.amount)}</td></tr>`).join('')}</tbody></table>
  </details>` : ''}
  ${g.rounds.length ? `<details class="table-view">
    <summary>之前已結清 ${g.rounds.length} 次・${sumOf(g.rounds.map((r) => r.expenses.length))} 筆</summary>
    <table><thead><tr><th>日期</th><th>品項</th><th>誰付</th><th class="r">金額</th></tr></thead>
    <tbody>${g.rounds.flatMap((r) => r.expenses).map((e) => `<tr><td class="num">${md(e.date)}</td><td>${esc(e.title)}</td><td>${esc(nameIn('friend', e.payer))}</td><td class="r">${fmt(e.amount)}</td></tr>`).join('')}</tbody></table>
  </details>` : ''}
  <p class="f-foot"><img src="${MASCOT}" alt="">Monee 分帳・只看得到這個群組</p>`;
}

// ---------- 新增／編輯花費的表單 ----------
/** 表單狀態放在 ph.view.form；打字只更新金額相關的區塊，按按鈕才重畫整個面板 */
function newForm({ groupId, editId = null, fromFab = false, simple = false, payer = ME, keep = null }) {
  const g = groupById(groupId);
  const e = editId ? g.expenses.find((x) => x.id === editId) : null;
  const members = g ? g.members : [ME];
  const base = {
    groupId, editId, fromFab, simple,
    splitOn: !fromFab,
    amount: e ? String(e.amount) : '',
    title: e ? e.title : '',
    cat: e ? e.cat : 'food',
    payer: e ? e.payer : payer,
    account: e?.account ?? 'cathay',
    mode: e ? e.mode : 'equal',
    who: new Set(e ? participants(e) : members),
    exact: e?.mode === 'exact' ? { ...e.exact } : {},
    shares: e?.mode === 'shares' ? { ...e.shares } : Object.fromEntries(members.map((m) => [m, 1])),
    confirmDel: false,
  };
  if (keep) Object.assign(base, { payer: keep.payer, account: keep.account, mode: keep.mode, who: new Set(keep.who), cat: keep.cat, shares: { ...keep.shares } });
  return base;
}

const formAmount = (f) => Math.max(0, parseInt(f.amount || '0', 10) || 0);

function formExpense(f) {
  const g = groupById(f.groupId);
  const amount = formAmount(f);
  const members = g.members;
  const split = f.mode === 'exact'
    ? { exact: Object.fromEntries(members.map((m) => [m, parseInt(f.exact[m] || '0', 10) || 0])) }
    : f.mode === 'shares'
      ? { shares: Object.fromEntries(members.map((m) => [m, f.who.has(m) ? f.shares[m] || 0 : 0])) }
      : { who: members.filter((m) => f.who.has(m)) };
  return { amount, payer: f.payer, account: f.payer === ME ? f.account : null, mode: f.simple ? 'equal' : f.mode, cat: f.cat, title: f.title.trim() || CATS[f.cat].name, ...split };
}

function formProblem(f) {
  const amount = formAmount(f);
  if (!amount) return '請輸入金額';
  if (f.fromFab && !f.splitOn) return '';
  if (f.quick || !groupById(f.groupId)) return '先選一個群組';
  const e = formExpense(f);
  if (e.mode === 'exact') {
    const diff = amount - sumOf(Object.values(e.exact));
    if (diff > 0) return `還有 ${fmt(diff)} 沒分到`;
    if (diff < 0) return `多分了 ${fmt(diff)}`;
    return '';
  }
  if (!participants({ ...e, amount }).length) return '至少選一個人分';
  return '';
}

function splitRows(ph, f) {
  const g = groupById(f.groupId);
  const e = formExpense(f);
  const map = f.mode === 'exact' ? {} : shareMap(e);
  const view = ph.id;
  return `<ul class="split-rows">${g.members.map((m) => {
    const on = f.mode === 'exact' ? (parseInt(f.exact[m] || '0', 10) || 0) > 0 : f.who.has(m);
    const label = esc(nameIn(view, m));
    let right;
    if (f.mode === 'exact') {
      right = `<label class="sr-only" for="${view}-ex-${esc(m)}">${label}要付多少</label><input class="exact" id="${view}-ex-${esc(m)}" inputmode="numeric" placeholder="0" value="${esc(f.exact[m] ?? '')}" data-input="exact" data-name="${esc(m)}" data-fk="ex-${esc(m)}">`;
    } else if (f.mode === 'shares') {
      right = on ? `<span class="stepper" role="group" aria-label="${label}的份數">
          <button type="button" data-action="share-step" data-name="${esc(m)}" data-d="-1" aria-label="少一份" data-fk="sm-${esc(m)}">${icon('minus', 16)}</button>
          <output aria-live="polite">${f.shares[m] || 0}</output>
          <button type="button" data-action="share-step" data-name="${esc(m)}" data-d="1" aria-label="多一份" data-fk="sp-${esc(m)}">${icon('plus', 16)}</button>
        </span>` : '';
    } else {
      right = '';
    }
    const valText = f.mode === 'exact' ? '' : on ? fmt(map[m] || 0) : '不分';
    return `<li class="split-row ${on ? '' : 'off'}">
      ${f.mode === 'exact' ? av(view, m) : `<button type="button" class="check press" aria-pressed="${on}" aria-label="${label}${on ? '有' : '沒有'}分這筆" data-action="toggle-who" data-name="${esc(m)}" data-fk="who-${esc(m)}">${icon('check', 18, 2)}</button>`}
      <span class="txt"><span class="t1">${label}${m === f.payer ? ' <span class="tag soft">付款</span>' : ''}</span>${f.mode === 'shares' && on ? `<span class="sub-val" data-live="val-${esc(m)}">${valText}</span>` : ''}</span>
      ${f.mode === 'shares' ? right : f.mode === 'exact' ? right : `<span class="val" data-live="val-${esc(m)}">${valText}</span>`}
    </li>`;
  }).join('')}</ul>`;
}

function effectBox(ph, f) {
  if (ph.id === 'friend') {
    const e = formExpense(f);
    const map = shareMap({ ...e, amount: formAmount(f) });
    const n = Object.keys(map).length;
    return `<div class="effect" data-live="effect"><span class="k">${icon('users', 14)}分攤結果</span><p>${n ? `${n} 人平分，每人約 <b>${fmt(formAmount(f) / n)}</b>。` : '還沒選人。'}${f.who.has(ME) || f.payer === ME ? `<br>跟 ${OWNER} 有關，${OWNER} 確認後才會記進 ${OWNER} 的帳。` : ''}</p></div>`;
  }
  if (f.fromFab && !f.splitOn) {
    return `<div class="effect" data-live="effect"><span class="k">${icon('wallet', 14)}記進你的帳</span><p>一般支出 <b>${fmt(formAmount(f))}</b>，從${esc(acctName(f.account))}付。</p></div>`;
  }
  if (!groupById(f.groupId)) return `<div class="effect" data-live="effect"><span class="k">${icon('wallet', 14)}記進你的帳</span><p>選一個群組，或按「新群組」輸入朋友名字。</p></div>`;
  const e = { ...formExpense(f), amount: formAmount(f) };
  const problem = formProblem(f);
  const lines = problem && e.mode === 'exact' ? ['分配好金額後，這裡會顯示怎麼記進你的帳'] : effectLines(e);
  return `<div class="effect" data-live="effect"><span class="k">${icon('wallet', 14)}記進你的帳</span>${lines.map((l) => `<p>${l}</p>`).join('')}</div>`;
}

function saveButtons(ph, f) {
  const problem = formProblem(f);
  const amount = formAmount(f);
  if (ph.id === 'friend') return `<div data-live="save"><button type="button" class="btn-primary block press" data-action="save-expense" ${problem ? 'disabled' : ''}>新增到群組${amount ? ` ${fmt(amount)}` : ''}</button></div>`;
  if (f.editId) return `<div data-live="save"><button type="button" class="btn-primary block press" data-action="save-expense" ${problem ? 'disabled' : ''}>儲存變更</button></div>`;
  return `<div class="btn-pair" data-live="save">
    <button type="button" class="btn-secondary press" data-action="save-expense" data-again="1" ${problem ? 'disabled' : ''} style="min-height:52px">記下並再記一筆</button>
    <button type="button" class="btn-primary press" data-action="save-expense" ${problem ? 'disabled' : ''}>記下${amount ? ` ${fmt(amount)}` : ''}</button>
  </div>`;
}

function expenseForm(ph, view) {
  const f = view.form;
  const g = groupById(f.groupId);
  const viewer = ph.id;
  const title = f.editId ? '編輯花費' : f.fromFab ? '記一筆' : '新增花費';
  const sub = f.fromFab ? '' : `${esc(g.name)}・${g.members.length} 人`;
  const pills = (items, current, action, label) => `<div class="pills" role="group" aria-label="${label}">${items.map(([v, l]) =>
    `<button type="button" class="pill press" aria-pressed="${current === v}" data-action="${action}" data-value="${esc(v)}" data-fk="${action}-${esc(v)}">${l}</button>`).join('')}</div>`;
  const problem = formProblem(f);
  const showSplit = (!f.fromFab || f.splitOn) && !f.quick;

  return `${sheetHead(ph, title, f.editId ? 'Edit' : 'New', sub)}
  <div class="fgroup">
    <label class="field-label" for="${viewer}-amt">金額</label>
    <div class="amount-in"><span>$</span><input id="${viewer}-amt" inputmode="numeric" placeholder="0" value="${esc(f.amount)}" data-input="amount" data-fk="amount" data-autofocus autocomplete="off"></div>
  </div>
  <div class="fgroup">
    <label class="field-label" for="${viewer}-title">品項</label>
    <input class="text-in" id="${viewer}-title" value="${esc(f.title)}" placeholder="例如：午餐・野菜鍋" data-input="title" data-fk="title" maxlength="40" autocomplete="off">
    ${f.simple ? '' : pills(Object.entries(CATS).map(([k, c]) => [k, c.name]), f.cat, 'set-cat', '分類')}
  </div>
  ${f.fromFab ? `
    <div class="switch-row">
      <span class="txt"><span class="t1">分帳</span><span class="t2">跟朋友一起付的，只算你的部分</span></span>
      <button type="button" class="switch" role="switch" aria-checked="${f.splitOn}" aria-label="分帳" data-action="toggle-split" data-fk="split"></button>
    </div>
    ${f.splitOn ? `<div class="fgroup"><span class="field-label">跟誰分（選群組）</span>
      <div class="pills" role="group" aria-label="群組" style="flex-wrap:wrap">${[...openGroups(), ...settledGroups()].map((x) =>
        `<button type="button" class="pill press" aria-pressed="${f.groupId === x.id && !f.quick}" data-action="set-group" data-value="${x.id}" data-fk="set-group-${x.id}">${esc(x.name)}</button>`).join('')}
        <button type="button" class="pill press" aria-pressed="${Boolean(f.quick)}" data-action="quick-group" data-fk="quick-group">${icon('plus', 16)}新群組</button>
      </div>
      ${f.quick ? quickGroupBox(ph, f.quick) : ''}
    </div>` : ''}` : ''}
  ${showSplit && g ? `
    <div class="fgroup"><span class="field-label">誰先付的</span>${pills(g.members.map((m) => [m, esc(nameIn(viewer, m))]), f.payer, 'set-payer', '誰先付的')}</div>
    ${f.payer === ME && viewer === 'me' ? `<div class="fgroup"><span class="field-label">從哪個帳戶付</span>${pills(ACCOUNTS.map((a) => [a.id, a.name]), f.account, 'set-account', '付款帳戶')}</div>` : ''}
    <div class="fgroup">
      <span class="field-label">怎麼分</span>
      ${f.simple ? '' : pills(MODES, f.mode, 'set-mode', '怎麼分')}
      ${splitRows(ph, f)}
      <p class="remain ${problem && f.mode === 'exact' ? 'bad' : ''}" data-live="remain">${f.mode === 'exact' ? (problem || '剛好分完') : f.mode === 'shares' ? '例如有人點兩杯，就給他 2 份' : '除不盡的零頭會由前面的人多付 $1'}</p>
    </div>` : f.fromFab && !f.splitOn ? `<div class="fgroup"><span class="field-label">從哪個帳戶付</span>${pills(ACCOUNTS.map((a) => [a.id, a.name]), f.account, 'set-account', '付款帳戶')}</div>` : ''}
  ${f.quick ? '' : `${effectBox(ph, f)}${saveButtons(ph, f)}`}`;
}

/** 打字時只更新會變的區塊，輸入框不重畫（避免游標跳掉） */
function updateLive(ph) {
  const f = ph.view.form;
  const g = groupById(f.groupId);
  if (g && (!f.fromFab || f.splitOn) && f.mode !== 'exact') {
    const map = shareMap({ ...formExpense(f), amount: formAmount(f) });
    for (const m of g.members) {
      const el = ph.sheet.querySelector(`[data-live="val-${CSS.escape(m)}"]`);
      if (el) el.textContent = f.who.has(m) ? fmt(map[m] || 0) : '不分';
    }
  }
  const remain = ph.sheet.querySelector('[data-live="remain"]');
  if (remain && f.mode === 'exact') {
    const problem = formProblem(f);
    remain.textContent = problem || '剛好分完';
    remain.classList.toggle('bad', Boolean(problem));
  }
  const tmp = document.createElement('div');
  tmp.innerHTML = effectBox(ph, f);
  ph.sheet.querySelector('[data-live="effect"]').replaceWith(tmp.firstElementChild);
  tmp.innerHTML = saveButtons(ph, f);
  ph.sheet.querySelector('[data-live="save"]').replaceWith(tmp.firstElementChild);
}

// ---------- 其他面板 ----------
function expenseDetail(ph, view) {
  const g = groupById(state.me.groupId);
  const e = g.expenses.find((x) => x.id === view.id);
  if (!e) return sheetHead(ph, '找不到這筆', 'Missing', '');
  const map = shareMap(e);
  const mine = map[ME] || 0;
  return `${sheetHead(ph, esc(e.title), 'Expense', `${shortDate(e.date)} ${e.time}・${esc(g.name)}`)}
  ${e.pending ? `<div class="inbox-item"><p><b>${esc(e.addedBy)}</b> 新增了這筆，跟你有關，確認後才會記進你的帳。</p>
    <div class="btn-row"><button type="button" class="btn-secondary press" data-action="dispute" data-id="${e.id}">有問題</button><button type="button" class="btn-primary press" data-action="accept-expense" data-id="${e.id}">記入我的帳</button></div></div>` : ''}
  <div class="rec-row"><span class="caption">${esc(e.payer)}付${e.payer === ME ? `（${esc(acctName(e.account))}）` : ''}</span><span class="num">${fmt(e.amount)}</span></div>
  <div class="fgroup">
    <span class="field-label">${modeText(e)}</span>
    <ul class="split-rows">${g.members.filter((m) => map[m] || m === e.payer).map((m) => `
      <li class="split-row">${av('me', m)}<span class="txt"><span class="t1">${esc(m)}${m === e.payer ? ' <span class="tag soft">付款</span>' : ''}</span>${e.mode === 'shares' ? `<span class="sub-val">${e.shares[m] || 0} 份</span>` : ''}</span>
      <span class="val">${map[m] ? fmt(map[m]) : '不分'}</span></li>`).join('')}</ul>
  </div>
  <div class="effect"><span class="k">${icon('wallet', 14)}記進你的帳</span>${effectLines(e).map((l) => `<p>${l}</p>`).join('')}</div>
  ${mine ? `<div class="fgroup"><span class="field-label">在你的明細會顯示成</span>
    <div class="card"><div class="row-btn"><span class="ico">${icon(CATS[e.cat]?.icon ?? 'dots')}</span>
      <span class="txt"><span class="t1">${esc(e.title)}</span><span class="t2">分帳・${esc(g.name)}・${e.payer === ME ? `實付 ${fmt(e.amount)}` : `${esc(e.payer)}先付`}</span></span>
      <span class="amt">−${fmt(mine)}</span></div></div></div>` : ''}
  ${view.confirmDel ? `<div role="alertdialog" aria-labelledby="del-q" class="inbox-item" style="background:var(--alert-tint);border-color:transparent">
      <p id="del-q" style="color:var(--alert)">確定刪除「${esc(e.title)}」？每個人的結算會重新計算。</p>
      <div class="btn-row"><button type="button" class="btn-secondary press" data-action="del-cancel" data-autofocus>取消</button><button type="button" class="btn-secondary press" data-action="del-expense" data-id="${e.id}" style="color:var(--alert);border-color:var(--alert)">刪除</button></div></div>`
    : `<div class="btn-pair"><button type="button" class="btn-secondary press" data-action="del-ask" style="min-height:52px;color:var(--alert)">${icon('trash', 16)}刪除</button><button type="button" class="btn-primary press" data-action="edit-expense" data-id="${e.id}">${icon('pencil', 16)}編輯</button></div>`}`;
}

function inboxSheet(ph) {
  const items = state.inbox;
  return `${sheetHead(ph, '待確認', 'Inbox', '朋友新增的花費、說已付款，都要你確認才會記進你的帳')}
  ${items.length ? items.map((i) => {
    const g = groupById(i.groupId);
    if (i.type === 'expense') {
      const e = g.expenses.find((x) => x.id === i.expenseId);
      const mine = shareMap(e)[ME] || 0;
      return `<div class="inbox-item"><p><b>${esc(i.from)}</b> 在「${esc(g.name)}」新增了「${esc(e.title)} ${fmt(e.amount)}」，${esc(e.payer === ME ? '你' : e.payer)}先付${mine ? `，你的部分 <b class="num">${fmt(mine)}</b>` : ''}。</p>
        <div class="btn-row"><button type="button" class="btn-secondary press" data-action="dispute" data-id="${e.id}">有問題</button><button type="button" class="btn-primary press" data-action="accept-expense" data-id="${e.id}">記入我的帳</button></div></div>`;
    }
    const s = g.settlements.find((x) => x.id === i.settlementId);
    return `<div class="inbox-item"><p><b>${esc(i.from)}</b> 說已經付給你 <b class="num">${fmt(s.amount)}</b>（${esc(g.name)}）。</p>
      <div class="fgroup"><span class="field-label">存進哪個帳戶</span><div class="pills" role="group" aria-label="存入帳戶">${ACCOUNTS.filter((a) => a.id !== 'cathay').map((a) =>
        `<button type="button" class="pill press" aria-pressed="${(i.account ?? 'esun') === a.id}" data-action="inbox-account" data-id="${i.id}" data-value="${a.id}" data-fk="ia-${i.id}-${a.id}">${a.name}</button>`).join('')}</div></div>
      <div class="btn-row"><button type="button" class="btn-secondary press" data-action="reject-paid" data-id="${i.id}">還沒收到</button><button type="button" class="btn-primary press" data-action="accept-paid" data-id="${i.id}">確認收到</button></div></div>`;
  }).join('') : `<div class="empty-box"><p class="e1">都處理好了</p><p class="e2">朋友從分享連結新增花費或說已付款時，會出現在這裡。</p></div>`}`;
}

function settleSheet(ph, view) {
  const receiving = view.kind === 'receive';
  const other = receiving ? view.from : view.to;
  const accts = receiving ? ACCOUNTS.filter((a) => a.id !== 'cathay') : ACCOUNTS;
  view.account ??= receiving ? 'esun' : 'esun';
  return `${sheetHead(ph, receiving ? `${esc(other)} 還你錢` : `你還 ${esc(other)} 錢`, 'Settle', '可以只還一部分，剩下的會留在結算裡')}
  <div class="fgroup">
    <label class="field-label" for="settle-amt">金額</label>
    <div class="amount-in"><span>$</span><input id="settle-amt" inputmode="numeric" value="${esc(view.amount)}" data-input="settle-amount" data-autofocus autocomplete="off"></div>
  </div>
  <div class="fgroup"><span class="field-label">${receiving ? '存進哪個帳戶' : '從哪個帳戶付'}</span>
    <div class="pills" role="group" aria-label="帳戶">${accts.map((a) => `<button type="button" class="pill press" aria-pressed="${view.account === a.id}" data-action="settle-account" data-value="${a.id}" data-fk="sa-${a.id}">${a.name}</button>`).join('')}</div>
  </div>
  <div class="effect"><span class="k">${icon('wallet', 14)}記進你的帳</span><p>記成一筆轉帳：${receiving ? `朋友往來 → ${esc(acctName(view.account))}` : `${esc(acctName(view.account))} → 朋友往來`}，不算收入也不算支出。</p></div>
  <button type="button" class="btn-primary block press" data-action="settle-save">確認</button>`;
}

function shareSheet(ph) {
  const g = groupById(state.me.groupId);
  return `${sheetHead(ph, '分享給朋友', 'Share', esc(g.name))}
  <p class="caption" style="margin:-6px 0 0;line-height:1.8">朋友點連結就能看這個群組的帳、知道要付誰多少，不用下載、不用註冊。</p>
  <div class="linkbox"><code>${SHARE_URL}</code><button type="button" class="btn-secondary press" data-action="copy" data-text="https://${SHARE_URL}">${icon('copy', 14)}複製</button></div>
  <button type="button" class="btn-primary block press btn-line" data-action="share-line">用 LINE 傳給朋友</button>
  <div class="switch-row">
    <span class="txt"><span class="t1">朋友可以新增花費</span><span class="t2">誰先付都能自己記；跟你有關的要你確認</span></span>
    <button type="button" class="switch" role="switch" aria-checked="${g.allowFriendAdd}" aria-label="朋友可以新增花費" data-action="toggle-friend-add" data-fk="fadd"></button>
  </div>
  <div class="fgroup">
    <span class="field-label">你的收款方式（只有要付你錢的朋友看得到）</span>
    <label class="sr-only" for="pay-bank">銀行帳號</label>
    <input class="text-in" id="pay-bank" value="${esc(state.pay.bank)}" data-input="pay-bank" autocomplete="off">
    <label class="sr-only" for="pay-line">LINE Pay ID</label>
    <input class="text-in" id="pay-line" value="${esc(state.pay.linepay)}" data-input="pay-line" autocomplete="off">
  </div>
  <p class="note">${icon('info', 14)}朋友只看得到這個群組的花費和結算，看不到你的個人記帳。連結外流的話可以重設。</p>
  <button type="button" class="btn-secondary block press" data-action="reset-link" style="color:var(--alert)">重設連結（舊連結立刻失效）</button>`;
}

function newGroupSheet(ph, view) {
  const v = view;
  return `${sheetHead(ph, '建立群組', 'New group', '室友、午餐團、一起出遊的朋友都可以')}
  <div class="fgroup"><label class="field-label" for="ng-name">群組名稱</label>
    <input class="text-in" id="ng-name" value="${esc(v.name)}" placeholder="例如：墾丁三天兩夜" data-input="ng-name" data-autofocus maxlength="30" autocomplete="off"></div>
  <div class="fgroup"><span class="field-label">類型</span>
    <div class="pills" role="group" aria-label="類型">${[['daily', '日常（室友、午餐團）'], ['event', '活動・旅程']].map(([k, l]) =>
      `<button type="button" class="pill press" aria-pressed="${v.gkind === k}" data-action="ng-kind" data-value="${k}" data-fk="ngk-${k}">${l}</button>`).join('')}</div>
    ${v.gkind === 'event' ? '<p class="caption" style="margin:0">之後做旅程時，這裡會再加上日期、國家和外幣。</p>' : ''}
  </div>
  <div class="fgroup"><span class="field-label">成員（只要名字，不用帳號）</span>
    <div class="member-chips"><span class="member-chip" style="padding-right:var(--space-4)">${av('me', ME)} 我</span>${v.members.map((m, i) => `
      <span class="member-chip">${esc(m)}<button type="button" data-action="ng-remove" data-i="${i}" aria-label="移除${esc(m)}">${icon('x', 14)}</button></span>`).join('')}</div>
    <div style="display:grid;grid-template-columns:minmax(0,1fr) auto;gap:var(--space-2)">
      <label class="sr-only" for="ng-member">朋友的名字</label>
      <input class="text-in" id="ng-member" value="${esc(v.draft)}" placeholder="朋友的名字" data-input="ng-member" data-fk="ng-member" maxlength="12" autocomplete="off">
      <button type="button" class="btn-secondary press" data-action="ng-add" data-fk="ng-add">加入</button>
    </div>
  </div>
  <button type="button" class="btn-primary block press" data-action="ng-save" ${v.name.trim() && v.members.length ? '' : 'disabled'} data-live="ng-save">建立</button>`;
}

/** 記一筆時當場建立群組：只跟一個朋友分也一樣，群組名稱不填就用朋友名字 */
function quickGroupBox(ph, q) {
  return `<div class="card" style="padding:var(--space-4);display:flex;flex-direction:column;gap:var(--space-3)">
    <div class="fgroup"><label class="field-label" for="qg-names">朋友的名字（多個人用空白或逗號分開）</label>
      <input class="text-in" id="qg-names" value="${esc(q.names)}" placeholder="例如：阿凱 小美" data-input="qg-names" data-fk="qg-names" autocomplete="off"></div>
    <div class="fgroup"><label class="field-label" for="qg-name">群組名稱（可不填）</label>
      <input class="text-in" id="qg-name" value="${esc(q.name)}" placeholder="不填就叫「${esc(quickNames(q).join('、') || '朋友名字')}」" data-input="qg-name" data-fk="qg-name" autocomplete="off"></div>
    <div class="btn-pair"><button type="button" class="btn-secondary press" data-action="quick-cancel" style="min-height:48px">取消</button>
      <button type="button" class="btn-primary press" data-action="quick-save" data-live="qg-save" ${quickNames(q).length ? '' : 'disabled'} style="min-height:48px">建立並選取</button></div>
  </div>`;
}
const quickNames = (q) => [...new Set(q.names.split(/[\s,，、]+/).map((n) => n.trim()).filter((n) => n && n !== ME))].slice(0, 12);

function groupSettingsSheet(ph, v) {
  const g = groupById(v.groupId);
  return `${sheetHead(ph, '群組設定', 'Settings', esc(g.name))}
  <div class="fgroup"><label class="field-label" for="gs-name">群組名稱</label>
    <input class="text-in" id="gs-name" value="${esc(v.name)}" data-input="gs-name" data-fk="gs-name" maxlength="30" autocomplete="off"></div>
  <div class="fgroup"><span class="field-label">類型</span>
    <div class="pills" role="group" aria-label="類型">${[['daily', '日常'], ['event', '活動・旅程']].map(([k, l]) =>
      `<button type="button" class="pill press" aria-pressed="${v.gkind === k}" data-action="gs-kind" data-value="${k}" data-fk="gsk-${k}">${l}</button>`).join('')}</div></div>
  <div class="fgroup"><span class="field-label">成員</span>
    <ul class="split-rows">
      <li class="split-row">${av('me', ME)}<span class="txt"><span class="t1">我</span><span class="t2">你自己，分享頁上顯示 ${OWNER}</span></span><span></span></li>
      ${v.rows.map((r, i) => r.removed ? '' : `<li class="split-row">
        <span class="av" aria-hidden="true">${esc(initial(r.name || '?'))}</span>
        <span class="txt"><label class="sr-only" for="gs-m-${i}">成員名字</label>
          <input class="member-in" id="gs-m-${i}" value="${esc(r.name)}" maxlength="12" data-input="gs-member" data-i="${i}" data-fk="gs-m-${i}" autocomplete="off">
          ${r.locked ? '<span class="t2">有花費紀錄，只能改名</span>' : ''}</span>
        <button type="button" class="icon-btn ghost press" data-action="gs-remove" data-i="${i}" ${r.locked ? 'disabled' : ''} aria-label="移除${esc(r.name)}">${icon('x', 18)}</button>
      </li>`).join('')}
    </ul>
    <div style="display:grid;grid-template-columns:minmax(0,1fr) auto;gap:var(--space-2)">
      <label class="sr-only" for="gs-new">新成員名字</label>
      <input class="text-in" id="gs-new" value="${esc(v.draft)}" placeholder="加入朋友的名字" data-input="gs-draft" data-fk="gs-new" maxlength="12" autocomplete="off">
      <button type="button" class="btn-secondary press" data-action="gs-add" data-fk="gs-add">加入</button>
    </div>
    <p class="caption" style="margin:0;line-height:1.8">改名字會同步更新所有花費（例如「小名」改成「小明」）。中途加入的人不會被算進之前的花費。</p>
  </div>
  <div class="switch-row">
    <span class="txt"><span class="t1">朋友可以新增花費</span><span class="t2">從分享連結新增；跟你有關的要你確認</span></span>
    <button type="button" class="switch" role="switch" aria-checked="${v.allowFriendAdd}" aria-label="朋友可以新增花費" data-action="gs-friend-add" data-fk="gs-fadd"></button>
  </div>
  ${v.error ? `<p role="alert" class="field-error" style="margin:0">${esc(v.error)}</p>` : ''}
  <button type="button" class="btn-primary block press" data-action="gs-save">儲存</button>
  <section class="fgroup" aria-labelledby="gs-danger" style="padding-top:var(--space-4);border-top:1px solid var(--line)">
    <h3 class="field-label" id="gs-danger" style="margin:0">管理</h3>
    <button type="button" class="btn-secondary block press" data-action="delete-group" ${allExpenses(g).length ? 'disabled' : ''} style="color:var(--alert)">刪除群組</button>
    <p class="caption" style="margin:0 4px">${allExpenses(g).length ? '有花費紀錄的群組不能刪除（會影響你的帳）。全部結清後會自動收到「已結清」，不會佔列表。' : '還沒有任何花費，可以直接刪除。'}</p>
  </section>`;
}

/** 成員改名：花費、還款、待確認、分享頁身分全部一起改。先換成暫時名稱，避免兩個人互換名字時撞名 */
function renameMembers(g, pairs) {
  const tmp = pairs.map((_, i) => `\u0000${i}`);
  const swap = (from, to) => {
    for (const e of allExpenses(g)) {
      if (e.payer === from) e.payer = to;
      if (e.addedBy === from) e.addedBy = to;
      if (e.who) e.who = e.who.map((n) => (n === from ? to : n));
      for (const k of ['exact', 'shares']) if (e[k] && from in e[k]) { e[k][to] = e[k][from]; delete e[k][from]; }
    }
    for (const s of allSettlements(g)) { if (s.from === from) s.from = to; if (s.to === from) s.to = to; }
    for (const i of state.inbox) if (i.groupId === g.id && i.from === from) i.from = to;
    if (state.friend.groupId === g.id && state.friend.who === from) state.friend.who = to;
  };
  pairs.forEach(([from], i) => swap(from, tmp[i]));
  pairs.forEach(([, to], i) => swap(tmp[i], to));
}

function roundSheet(ph, v) {
  const g = groupById(state.me.groupId);
  const r = g.rounds.find((x) => x.id === v.id);
  if (!r) return sheetHead(ph, '找不到這次結算', 'Missing', '');
  const total = sumOf(r.expenses.map((e) => e.amount));
  const mine = sumOf(r.expenses.map((e) => shareMap(e)[ME] || 0));
  const list = [...r.expenses].sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
  return `${sheetHead(ph, `${md(r.closedAt)} 結清`, 'Settled', `${esc(g.name)}・${r.expenses.length} 筆・總花費 ${fmt(total)}`)}
  <div class="rec-row"><span class="caption">你這次的支出</span><span class="num">${fmt(mine)}</span></div>
  <div class="fgroup"><span class="field-label">花費</span>
    <ul class="card list list-card">${list.map((e) => `
      <li><div class="row-btn"><span class="ico">${icon(CATS[e.cat]?.icon ?? 'dots')}</span>
        <span class="txt"><span class="t1">${esc(e.title)}</span><span class="t2">${md(e.date)}・${esc(e.payer)}付 ${fmt(e.amount)}・${modeText(e)}</span></span>
        <span class="amt-col">${shareMap(e)[ME] ? `<span class="mine">${fmt(shareMap(e)[ME])}</span><span class="link-cap">你的部分</span>` : '<span class="mine none">沒參與</span>'}</span></div></li>`).join('')}
    </ul></div>
  <div class="fgroup"><span class="field-label">還款</span>
    <ul class="xfer-list">${r.settlements.map((s) => `
      <li class="xfer done"><span class="who">${esc(s.from)} <span class="arrow">${icon('arrow', 14)}</span> ${esc(s.to)}<span class="caption">・${s.date}${s.account ? `・${esc(acctName(s.account))}` : ''}</span></span>
      <span class="amt num">${fmt(s.amount)}</span></li>`).join('')}</ul></div>
  <p class="note">${icon('info', 14)}結算記錯了才需要重新打開，這些花費和還款會回到目前的帳。</p>
  <button type="button" class="btn-secondary block press" data-action="reopen-round" data-id="${r.id}">重新打開這次結算</button>`;
}

const SHEETS = { form: expenseForm, detail: expenseDetail, inbox: inboxSheet, receive: settleSheet, pay: settleSheet, share: shareSheet, newGroup: newGroupSheet, groupSettings: groupSettingsSheet, round: roundSheet };

// ---------- 動作 ----------
function go(page) {
  state.me.page = page;
  if (page === 'group') state.me.tab ??= 'expenses';
  renderMe();
  phones.me.scroll.scrollTop = 0;
  phones.me.scroll.querySelector('h1, button')?.focus({ preventScroll: true });
}

function saveExpense(ph, again) {
  const f = ph.view.form;
  if (formProblem(f)) return;
  if (f.fromFab && !f.splitOn) {
    closeSheet(ph);
    toast(ph, `已記下：${f.title.trim() || CATS[f.cat].name} ${fmt(formAmount(f))}（一般支出）`);
    return;
  }
  const g = groupById(f.groupId);
  const data = formExpense(f);
  const viewer = ph.id;
  if (f.editId) {
    const e = g.expenses.find((x) => x.id === f.editId);
    delete e.who;
    delete e.exact;
    delete e.shares;
    Object.assign(e, data);
    closeSheet(ph);
    toast(ph, `已更新：${e.title}，結算重新計算了`);
  } else {
    const e = { id: uid('n'), date: TODAY, time: NOW, addedBy: viewer === 'me' ? ME : state.friend.who, pending: false, ...data };
    const involvesMe = viewer === 'friend' && (shareMap(e)[ME] || e.payer === ME);
    if (involvesMe) {
      e.pending = true;
      state.inbox.push({ id: uid('i'), type: 'expense', groupId: g.id, expenseId: e.id, from: state.friend.who });
    }
    g.expenses.push(e);
    const mine = shareMap(e)[viewer === 'me' ? ME : state.friend.who] || 0;
    if (again) {
      ph.view.form = newForm({ groupId: g.id, fromFab: f.fromFab, keep: f });
      ph.view.form.splitOn = f.splitOn;
      renderSheet(ph, false);
      ph.sheet.scrollTop = 0;
      ph.sheet.querySelector('[data-fk="amount"]')?.focus();
      toast(ph, `已記下「${e.title}」，繼續記下一筆`);
    } else {
      closeSheet(ph);
      toast(ph, viewer === 'friend' ? (involvesMe ? `已新增，${OWNER} 確認後會記進 ${OWNER} 的帳` : '已新增到群組') : `已記下：${e.title}，你的部分 ${fmt(mine)}`);
    }
    if (viewer === 'friend' && involvesMe) toast(phones.me, `${state.friend.who} 新增了一筆，等你確認`);
  }
  renderAll();
}

function handle(ph, action, t) {
  const v = ph.view;
  const f = v?.form;
  switch (action) {
    case 'close-sheet': return closeSheet(ph);
    case 'go': return go(t.dataset.page);
    case 'open-group':
      state.me.groupId = t.dataset.id;
      state.me.tab = 'expenses';
      return go('group');
    case 'tab':
      state.me.tab = t.dataset.tab;
      renderMe();
      return phones.me.scroll.querySelector(`[data-tab="${t.dataset.tab}"]`)?.focus();
    case 'fab': {
      const recent = openGroups()[0]?.id ?? state.groups[0]?.id;
      const form = newForm({ groupId: recent, fromFab: true });
      return openSheet(ph, { kind: 'form', form }, t);
    }
    case 'add-expense':
      return openSheet(ph, { kind: 'form', form: newForm({ groupId: state.me.groupId }) }, t);
    case 'friend-add':
      return openSheet(ph, { kind: 'form', form: newForm({ groupId: state.friend.groupId, simple: true, payer: state.friend.who }) }, t);
    case 'open-expense':
      return openSheet(ph, { kind: 'detail', id: t.dataset.id }, t);
    case 'edit-expense':
      ph.view = { kind: 'form', form: newForm({ groupId: state.me.groupId, editId: t.dataset.id }) };
      renderSheet(ph, false);
      return ph.sheet.querySelector('[data-autofocus]')?.focus();
    case 'del-ask':
      v.confirmDel = true;
      renderSheet(ph, false);
      return ph.sheet.querySelector('[data-autofocus]')?.focus();
    case 'del-cancel': v.confirmDel = false; return renderSheet(ph, false);
    case 'del-expense': {
      const g = groupById(state.me.groupId);
      const e = g.expenses.find((x) => x.id === t.dataset.id);
      g.expenses = g.expenses.filter((x) => x.id !== e.id);
      state.inbox = state.inbox.filter((i) => i.expenseId !== e.id);
      closeSheet(ph);
      toast(ph, `已刪除：${e.title}`);
      return renderAll();
    }
    case 'set-cat': f.cat = t.dataset.value; return renderSheet(ph);
    case 'set-payer': f.payer = t.dataset.value; return renderSheet(ph);
    case 'set-account': f.account = t.dataset.value; return renderSheet(ph);
    case 'set-mode':
      f.mode = t.dataset.value;
      if (f.mode === 'exact' && !Object.keys(f.exact).length && formAmount(f)) {
        // 從平分的結果開始改，比從零開始填快
        const map = shareMap({ amount: formAmount(f), mode: 'equal', who: [...f.who] });
        f.exact = Object.fromEntries(Object.entries(map).map(([k, val]) => [k, String(val)]));
      }
      return renderSheet(ph);
    case 'set-group': {
      const keepAmt = f.amount;
      const keepTitle = f.title;
      const keepCat = f.cat;
      ph.view.form = newForm({ groupId: t.dataset.value, fromFab: true });
      Object.assign(ph.view.form, { amount: keepAmt, title: keepTitle, cat: keepCat, splitOn: true });
      return renderSheet(ph);
    }
    case 'toggle-split': f.splitOn = !f.splitOn; return renderSheet(ph);
    case 'toggle-who': {
      const n = t.dataset.name;
      if (f.who.has(n)) f.who.delete(n);
      else f.who.add(n);
      if (f.mode === 'shares' && f.who.has(n) && !f.shares[n]) f.shares[n] = 1;
      return renderSheet(ph);
    }
    case 'share-step': {
      const n = t.dataset.name;
      f.shares[n] = Math.max(0, (f.shares[n] || 0) + Number(t.dataset.d));
      if (!f.shares[n]) f.who.delete(n);
      return renderSheet(ph);
    }
    case 'save-expense': return saveExpense(ph, t.dataset.again === '1');
    case 'open-inbox': return openSheet(phones.me, { kind: 'inbox' }, t);
    case 'inbox-account': {
      const item = state.inbox.find((i) => i.id === t.dataset.id);
      item.account = t.dataset.value;
      return renderSheet(ph);
    }
    case 'accept-expense': {
      const g = state.groups.find((x) => x.expenses.some((e) => e.id === t.dataset.id));
      const e = g.expenses.find((x) => x.id === t.dataset.id);
      e.pending = false;
      state.inbox = state.inbox.filter((i) => i.expenseId !== e.id);
      toast(ph, `已記入：${e.title}，你的部分 ${fmt(shareMap(e)[ME] || 0)}`);
      renderAll();
      return ph.view?.kind === 'inbox' && state.inbox.length ? renderSheet(ph, false) : closeSheet(ph);
    }
    case 'dispute': {
      const g = state.groups.find((x) => x.expenses.some((e) => e.id === t.dataset.id));
      const e = g.expenses.find((x) => x.id === t.dataset.id);
      toast(ph, `（原型）會通知 ${e.addedBy}，請他修改或刪除`);
      return undefined;
    }
    case 'accept-paid': {
      const item = state.inbox.find((i) => i.id === t.dataset.id);
      const g = groupById(item.groupId);
      const s = g.settlements.find((x) => x.id === item.settlementId);
      Object.assign(s, { status: 'confirmed', account: item.account ?? 'esun' });
      state.inbox = state.inbox.filter((i) => i.id !== item.id);
      toast(ph, closeIfSettled(g) ? closedToast(g) : `已記錄：${s.from}還你 ${fmt(s.amount)}，存進${acctName(s.account)}`);
      toast(phones.friend, `${OWNER} 確認收到了`);
      renderAll();
      return state.inbox.length ? renderSheet(ph, false) : closeSheet(ph);
    }
    case 'reject-paid': {
      const item = state.inbox.find((i) => i.id === t.dataset.id);
      const g = groupById(item.groupId);
      g.settlements = g.settlements.filter((x) => x.id !== item.settlementId);
      state.inbox = state.inbox.filter((i) => i.id !== item.id);
      toast(ph, `已告訴 ${item.from} 還沒收到`);
      toast(phones.friend, `${OWNER} 說還沒收到，請再確認一下`);
      renderAll();
      return state.inbox.length ? renderSheet(ph, false) : closeSheet(ph);
    }
    case 'receive': return openSheet(ph, { kind: 'receive', from: t.dataset.from, amount: t.dataset.amount }, t);
    case 'pay': return openSheet(ph, { kind: 'pay', to: t.dataset.to, amount: t.dataset.amount }, t);
    case 'settle-account': v.account = t.dataset.value; return renderSheet(ph);
    case 'settle-save': {
      const g = groupById(state.me.groupId);
      const amount = parseInt(v.amount, 10) || 0;
      if (!amount) return toast(ph, '請輸入金額');
      const receiving = v.kind === 'receive';
      g.settlements.push({ id: uid('s'), from: receiving ? v.from : ME, to: receiving ? ME : v.to, amount, status: 'confirmed', account: v.account, date: '10/7' });
      closeSheet(ph);
      toast(ph, closeIfSettled(g) ? closedToast(g) : receiving ? `已記錄：${v.from}還你 ${fmt(amount)}` : `已記錄：你還 ${v.to} ${fmt(amount)}`);
      return renderAll();
    }
    case 'mark-friend': {
      const g = groupById(ph.id === 'me' ? state.me.groupId : state.friend.groupId);
      const amount = Number(t.dataset.amount);
      g.settlements.push({ id: uid('s'), from: t.dataset.from, to: t.dataset.to, amount, status: 'confirmed', date: '10/7' });
      const closed = closeIfSettled(g);
      toast(ph, closed ? closedToast(g) : `已標記：${t.dataset.from} 付給 ${t.dataset.to} ${fmt(amount)}`);
      if (closed && ph.id === 'friend') toast(phones.me, closedToast(g));
      return renderAll();
    }
    case 'share': {
      state.friend.groupId = state.me.groupId;
      state.friend.who = null;
      renderFriend();
      return openSheet(ph, { kind: 'share' }, t);
    }
    case 'share-line': return toast(ph, '（原型）會打開 LINE 的分享選單');
    case 'copy': return toast(ph, '已複製');
    case 'reset-link': return toast(ph, '（原型）已產生新連結，舊連結失效了');
    case 'toggle-friend-add': {
      const g = groupById(state.me.groupId);
      g.allowFriendAdd = !g.allowFriendAdd;
      renderSheet(ph);
      return renderFriend();
    }
    case 'quick-group':
      f.quick = { names: '', name: '' };
      renderSheet(ph, false);
      return ph.sheet.querySelector('[data-fk="qg-names"]')?.focus();
    case 'quick-cancel':
      f.quick = null;
      return renderSheet(ph, false);
    case 'quick-save': {
      const names = quickNames(f.quick);
      if (!names.length) return undefined;
      const g = { id: uid('g'), name: f.quick.name.trim() || names.join('、'), kind: 'daily', date: TODAY, members: [ME, ...names], allowFriendAdd: true, settlements: [], expenses: [], rounds: [] };
      state.groups.unshift(g);
      const keepForm = { amount: f.amount, title: f.title, cat: f.cat };
      ph.view.form = newForm({ groupId: g.id, fromFab: true });
      Object.assign(ph.view.form, keepForm, { splitOn: true });
      renderSheet(ph, false);
      ph.sheet.querySelector('[data-fk="set-payer-我"]')?.focus();
      toast(ph, `已建立「${g.name}」，接著選誰付、怎麼分`);
      return renderMe();
    }
    case 'group-settings': {
      const g = groupById(state.me.groupId);
      return openSheet(ph, {
        kind: 'groupSettings', groupId: g.id, name: g.name, gkind: g.kind, allowFriendAdd: g.allowFriendAdd, draft: '', error: '',
        rows: g.members.filter((m) => m !== ME).map((m) => ({ orig: m, name: m, removed: false, locked: involved(g, m) })),
      }, t);
    }
    case 'gs-kind': v.gkind = t.dataset.value; return renderSheet(ph);
    case 'gs-friend-add': v.allowFriendAdd = !v.allowFriendAdd; return renderSheet(ph);
    case 'gs-remove': v.rows[Number(t.dataset.i)].removed = true; return renderSheet(ph, false);
    case 'gs-add': {
      const name = v.draft.trim();
      if (!name) return undefined;
      v.rows.push({ orig: null, name, removed: false, locked: false });
      v.draft = '';
      renderSheet(ph);
      return ph.sheet.querySelector('[data-fk="gs-new"]')?.focus();
    }
    case 'gs-save': {
      const g = groupById(v.groupId);
      const rows = v.rows.filter((r) => !r.removed).map((r) => ({ ...r, name: r.name.trim() }));
      const names = rows.map((r) => r.name);
      v.error = !v.name.trim() ? '群組名稱不能空白'
        : names.some((n) => !n) ? '成員名字不能空白'
          : names.includes(ME) || new Set(names).size !== names.length ? '成員名字重複了'
            : !names.length ? '至少要有一位朋友' : '';
      if (v.error) return renderSheet(ph, false);
      renameMembers(g, rows.filter((r) => r.orig && r.orig !== r.name).map((r) => [r.orig, r.name]));
      Object.assign(g, { name: v.name.trim(), kind: v.gkind, allowFriendAdd: v.allowFriendAdd, members: [ME, ...names] });
      closeSheet(ph);
      toast(ph, '已儲存群組設定');
      return renderAll();
    }
    case 'open-round': return openSheet(ph, { kind: 'round', id: t.dataset.id }, t);
    case 'reopen-round': {
      const g = groupById(state.me.groupId);
      const r = g.rounds.find((x) => x.id === t.dataset.id);
      g.rounds = g.rounds.filter((x) => x.id !== r.id);
      g.expenses = [...r.expenses, ...g.expenses];
      g.settlements = [...r.settlements, ...g.settlements];
      closeSheet(ph);
      renderAll();
      return toast(ph, `已重新打開，這 ${r.expenses.length} 筆回到花費列表`);
    }
    case 'delete-group': {
      const g = groupById(state.me.groupId);
      state.groups = state.groups.filter((x) => x.id !== g.id);
      if (state.friend.groupId === g.id) Object.assign(state.friend, { groupId: 'g1', who: null });
      closeSheet(ph);
      go('split');
      renderFriend();
      return toast(ph, `已刪除「${g.name}」`);
    }
    case 'new-group': return openSheet(ph, { kind: 'newGroup', name: '', gkind: 'daily', members: [], draft: '' }, t);
    case 'ng-kind': v.gkind = t.dataset.value; return renderSheet(ph);
    case 'ng-add': {
      const name = v.draft.trim();
      if (!name) return undefined;
      if (name === ME || v.members.includes(name)) return toast(ph, '已經有這個名字了');
      v.members.push(name);
      v.draft = '';
      renderSheet(ph);
      return ph.sheet.querySelector('[data-fk="ng-member"]')?.focus();
    }
    case 'ng-remove': v.members.splice(Number(t.dataset.i), 1); return renderSheet(ph);
    case 'ng-save': {
      const g = { id: uid('g'), name: v.name.trim(), kind: v.gkind, date: TODAY, members: [ME, ...v.members], allowFriendAdd: true, settlements: [], expenses: [], rounds: [] };
      state.groups.unshift(g);
      closeSheet(ph);
      state.me.groupId = g.id;
      state.me.tab = 'expenses';
      go('group');
      return toast(ph, `已建立「${g.name}」，可以開始記花費了`);
    }
    // 朋友頁
    case 'pick-who':
      state.friend.who = t.dataset.name;
      renderFriend();
      return ph.scroll.querySelector('[data-focus-after-pick]')?.focus();
    case 'switch-who':
      state.friend.who = null;
      return renderFriend();
    case 'friend-paid': {
      const g = groupById(state.friend.groupId);
      const who = state.friend.who;
      const s = { id: uid('s'), from: who, to: ME, amount: Number(t.dataset.amount), status: 'waiting', date: '10/7' };
      g.settlements.push(s);
      state.inbox.push({ id: uid('i'), type: 'paid', groupId: g.id, settlementId: s.id, from: who });
      toast(ph, `已通知 ${OWNER}`);
      toast(phones.me, `${who} 說已經付給你 ${fmt(s.amount)}`);
      return renderAll();
    }
    default: return undefined;
  }
}

for (const ph of Object.values(phones)) {
  ph.el.addEventListener('click', (e) => {
    const t = e.target.closest('[data-action]');
    if (!t || !ph.el.contains(t)) return;
    if (t.tagName === 'A') e.preventDefault();
    handle(ph, t.dataset.action, t);
  });
  ph.el.addEventListener('input', (e) => {
    const t = e.target;
    const v = ph.view;
    if (!t.dataset.input || !v) return;
    const digits = () => t.value.replace(/\D/g, '').slice(0, 8);
    switch (t.dataset.input) {
      case 'amount': t.value = digits(); v.form.amount = t.value; return updateLive(ph);
      case 'title': v.form.title = t.value; return undefined;
      case 'exact': t.value = digits(); v.form.exact[t.dataset.name] = t.value; return updateLive(ph);
      case 'settle-amount': t.value = digits(); v.amount = t.value; return undefined;
      case 'pay-bank': state.pay.bank = t.value; return renderFriend();
      case 'pay-line': state.pay.linepay = t.value; return renderFriend();
      case 'ng-name': v.name = t.value; ph.sheet.querySelector('[data-live="ng-save"]').disabled = !(v.name.trim() && v.members.length); return undefined;
      case 'ng-member': v.draft = t.value; return undefined;
      case 'qg-names': {
        v.form.quick.names = t.value;
        const ok = quickNames(v.form.quick).length;
        ph.sheet.querySelector('[data-live="qg-save"]').disabled = !ok;
        ph.sheet.querySelector('#qg-name').placeholder = `不填就叫「${quickNames(v.form.quick).join('、') || '朋友名字'}」`;
        return undefined;
      }
      case 'qg-name': v.form.quick.name = t.value; return undefined;
      case 'gs-name': v.name = t.value; return undefined;
      case 'gs-member': v.rows[Number(t.dataset.i)].name = t.value; return undefined;
      case 'gs-draft': v.draft = t.value; return undefined;
      default: return undefined;
    }
  });
  ph.el.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && ph.view) closeSheet(ph);
    const input = e.target.dataset?.input;
    if (e.key === 'Enter' && input === 'ng-member') handle(ph, 'ng-add', e.target);
    if (e.key === 'Enter' && input === 'gs-draft') handle(ph, 'gs-add', e.target);
    if (e.key === 'Enter' && (input === 'qg-names' || input === 'qg-name')) handle(ph, 'quick-save', e.target);
  });
}

// ---------- 說明面板 ----------
document.querySelectorAll('input[name="theme"]').forEach((r) => r.addEventListener('change', () => {
  document.documentElement.dataset.theme = r.value;
}));
document.getElementById('reset').addEventListener('click', () => {
  for (const ph of Object.values(phones)) if (ph.view) closeSheet(ph);
  state = seed();
  renderAll();
  toast(phones.me, '已重設原型資料');
});

renderAll();
