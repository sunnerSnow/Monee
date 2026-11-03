'use client';

/* eslint-disable @next/next/no-img-element -- 分享圖是本機畫出來的 blob 網址，不經過 next/image 的最佳化 */
import { Check } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { getCategory } from '@/lib/categories';
import { money } from '@/lib/money';
import { useUi } from '@/lib/ui-store';
import type { WrappedSummary } from '@/lib/wrapped-ai';
import type { Wrapped, WrappedTrip } from '@/lib/wrapped';
import { Mascot } from '../Mascot';
import { Badge } from '../Streak';
import { useHidden } from '../ui';
import { drawShareCard, shareImage, type ShareCardData } from './share-card';

// 年度回顧每一張的內容；底色、換頁在 Story.tsx

const parts = (date: string) => date.split('-').map(Number);
/** 11 月 3 日 */
const md = (date: string) => `${parts(date)[1]} 月 ${parts(date)[2]} 日`;
/** 11/3 */
const short = (date: string) => `${parts(date)[1]}/${parts(date)[2]}`;
const monthName = (key: string) => `${Number(key.slice(5, 7))} 月`;
const period = (w: Wrapped) => (w.partial ? '今年到目前為止' : '這一年');
const itemName = (t: { note: string | null; categoryId: string }) => t.note?.trim() || getCategory(t.categoryId).name;

/** 黑底黃字的英文標籤（淺色版用在黑底那張） */
function Tag({ children, light = false }: { children: ReactNode; light?: boolean }) {
  return (
    <span className={`self-start rounded-full px-3.5 py-1 font-fun text-[15px] tracking-[.06em] ${light ? 'bg-[#F7F3E8] text-ink' : 'bg-ink text-brand'}`}>
      {children}
    </span>
  );
}

const Title = ({ children }: { children: ReactNode }) => (
  <h2 className="font-display text-[28px] leading-[1.4] tracking-[.08em] text-balance">{children}</h2>
);

/** 卡通大字：白字黑描邊，換到這張時彈一下 */
const Big = ({ children, className = 'text-[56px]' }: { children: ReactNode; className?: string }) => (
  <span className={`story-pop inline-block fun-text leading-[1.15] text-white ${className}`}>{children}</span>
);

const Card = ({ children, className = '' }: { children: ReactNode; className?: string }) => (
  <div className={`card px-4 py-3 ${className}`}>{children}</div>
);

export function IntroSlide({ w, preview }: { w: Wrapped; preview: boolean }) {
  const late = w.firstDate && w.firstDate > `${w.year}-01-31`;
  return (
    <>
      <Tag>{w.year} WRAPPED</Tag>
      <Title>你的 {w.year} 年<br />金錢故事</Title>
      <p className="font-display text-body tracking-[.08em]">
        {preview ? `偷看版・算到 ${md(w.until)}` : w.partial ? `算到 ${md(w.until)}` : '1 月 1 日到 12 月 31 日'}
      </p>
      <div className="flex flex-1 items-center justify-center py-2">
        <Mascot mood="yay" className="w-[200px] max-w-[60%] rotate-3" />
      </div>
      <p className="font-display text-title-s leading-[1.6] tracking-[.06em]">
        {period(w)}你記了 <Big className="text-[48px]">{w.entries}</Big> 筆帳
      </p>
      {late && <p className="text-body-s leading-[1.8]">從 {md(w.firstDate!)} 開始記帳，一起走到現在</p>}
      <p className="caption">點畫面右邊看下一張</p>
    </>
  );
}

export function MoneySlide({ w, hidden }: { w: Wrapped; hidden: boolean }) {
  const net = w.income - w.expense;
  return (
    <>
      <Tag>MONEY IN & OUT</Tag>
      <Title>{period(w)}<br />你一共花了</Title>
      <Big className="text-[58px]">{money(w.expense, hidden)}</Big>
      <p className="text-body">平均每天 <b className="num">{money(w.dailyAverage, hidden)}</b></p>
      {w.income > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <Card>
            <p className="caption">收入</p>
            <p className="display text-[22px]">{money(w.income, hidden)}</p>
          </Card>
          <Card>
            <p className="caption">結餘</p>
            <p className="display text-[22px]">{net < 0 && !hidden ? '−' : ''}{money(net, hidden)}</p>
          </Card>
        </div>
      )}
      <div className="mt-auto flex items-end justify-between gap-3">
        {w.income > 0 && <p className="font-display text-body leading-[1.7]">{net >= 0 ? '收支是正的，做得好！' : '花得比賺得多一點，明年一起調整'}</p>}
        <Mascot mood={w.income === 0 ? 'ok' : net >= 0 ? 'yay' : 'tight'} className="ml-auto w-[140px] flex-none -rotate-6" />
      </div>
    </>
  );
}

export function CategoriesSlide({ w, hidden }: { w: Wrapped; hidden: boolean }) {
  const [first, ...rest] = w.categories;
  const top = getCategory(first.categoryId);
  const TopIcon = top.icon;
  return (
    <>
      <Tag>TOP SPENDING</Tag>
      <Title>錢最常花在</Title>
      <div className="flex items-center gap-4">
        <span aria-hidden className="ico story-pop rounded-2xl" style={{ background: top.color, width: 76, height: 76 }}>
          <TopIcon size={38} strokeWidth={1.5} />
        </span>
        <div className="flex min-w-0 flex-col">
          <p className="font-display text-[38px] leading-tight break-words">{top.name}</p>
          <p className="font-display text-body">佔了 <Big className="text-[36px]">{first.share}%</Big></p>
        </div>
      </div>
      <p className="text-body">一共 <b className="num">{money(first.amount, hidden)}</b></p>
      {rest.length > 0 && (
        <Card className="flex flex-col gap-3">
          {rest.slice(0, 2).map((c, n) => {
            const cat = getCategory(c.categoryId);
            const Icon = cat.icon;
            return (
              <div key={c.categoryId} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5">
                <span className="num w-5 text-body-s">#{n + 2}</span>
                <span className="flex min-w-0 items-center gap-2 text-[15px]">
                  <span aria-hidden className="ico sm" style={{ background: cat.color }}><Icon size={16} strokeWidth={1.5} /></span>
                  <span className="truncate">{cat.name}</span>
                </span>
                <span className="num text-[15px]">{c.share}%</span>
                <span aria-hidden className="col-span-3 h-2">
                  <i className="block h-full rounded-r-[4px] bg-ink" style={{ width: `${(c.amount / first.amount) * 100}%` }} />
                </span>
              </div>
            );
          })}
        </Card>
      )}
      <p className="caption mt-auto">{period(w)}一共花在 {w.categories.length} 種分類</p>
    </>
  );
}

export function MonthsSlide({ w, hidden }: { w: Wrapped; hidden: boolean }) {
  const max = Math.max(1, ...w.months.map((m) => m.expense));
  const amount = (key: string | null) => w.months.find((m) => m.key === key)?.expense ?? 0;
  return (
    <>
      <Tag>MONTH BY MONTH</Tag>
      <Title>每個月花多少</Title>
      <div aria-hidden className="card flex h-[230px] items-stretch gap-1 px-3 pt-4 pb-2">
        {w.months.map((m) => {
          const color = m.key === w.peakMonth ? 'var(--hot)' : m.key === w.lowMonth ? 'var(--teal)' : 'var(--fill)';
          return (
            <div key={m.key} className="flex flex-1 flex-col items-center gap-1">
              <div className="flex w-full flex-1 items-end">
                <span
                  className={`story-grow block w-full rounded-t-[4px] border-2 ${m.future ? 'border-dashed border-dash' : 'border-ink'}`}
                  style={{ height: m.future ? 6 : `${Math.max(3, (m.expense / max) * 100)}%`, background: m.future ? 'transparent' : color }}
                />
              </div>
              <span className="num text-[11px]">{Number(m.key.slice(5, 7))}</span>
            </div>
          );
        })}
      </div>
      <ul className="sr-only">
        {w.months.filter((m) => !m.future).map((m) => <li key={m.key}>{monthName(m.key)}：{money(m.expense, hidden)}</li>)}
      </ul>
      <div className="flex flex-col gap-2">
        {w.peakMonth && (
          <p className="flex items-center gap-2 font-display text-title-s tracking-[.06em]">
            <i aria-hidden className="inline-block size-4 rounded-[4px] border-2 border-ink bg-hot" />
            {monthName(w.peakMonth)}花最多<b className="num ml-auto">{money(amount(w.peakMonth), hidden)}</b>
          </p>
        )}
        {w.lowMonth && (
          <p className="flex items-center gap-2 font-display text-title-s tracking-[.06em]">
            <i aria-hidden className="inline-block size-4 rounded-[4px] border-2 border-ink bg-teal" />
            {monthName(w.lowMonth)}最省<b className="num ml-auto">{money(amount(w.lowMonth), hidden)}</b>
          </p>
        )}
      </div>
      {w.partial && <p className="caption mt-auto">這個月還沒過完，不拿來比最省</p>}
    </>
  );
}

export function ItemSlide({ w, hidden }: { w: Wrapped; hidden: boolean }) {
  const { topItem, biggest } = w;
  return (
    <>
      <Tag>FAVORITE</Tag>
      {topItem ? (
        <>
          <Title>你最常買的是</Title>
          <p className="story-pop font-display text-[42px] leading-tight break-words">「{topItem.note}」</p>
          <p className="font-display text-title-s tracking-[.06em]">一共 <Big className="text-[44px]">{topItem.count}</Big> 次</p>
          <p className="text-body">花了 <b className="num">{money(topItem.total, hidden)}</b></p>
        </>
      ) : (
        <Title>{period(w)}<br />最大的一筆</Title>
      )}
      {biggest && (
        <Card className="-rotate-1">
          <p className="caption">{topItem ? '最大手筆' : md(biggest.date)}</p>
          <p className="font-display text-title-s break-words">{itemName(biggest)}</p>
          <p className="display text-[26px]">{money(biggest.amount, hidden)}{topItem && <small className="caption ml-2 align-middle">{md(biggest.date)}</small>}</p>
        </Card>
      )}
      <Mascot mood="yay" className="mt-auto ml-auto w-[130px] flex-none rotate-6" />
    </>
  );
}

export function HabitsSlide({ w }: { w: Wrapped }) {
  const stats: [string, number][] = [['記帳', w.recordedDays], ['最長連續', w.longestStreak], ['無消費日', w.noSpendDays]];
  return (
    <>
      <Tag>HABITS</Tag>
      <Title>記帳習慣</Title>
      <div className="grid grid-cols-3 gap-2.5">
        {stats.map(([k, v]) => (
          <Card key={k} className="flex flex-col items-center gap-0.5 !px-2 text-center">
            <span className="caption">{k}</span>
            <span className="story-pop fun-text text-[34px] leading-[1.2] text-brand">{v}</span>
            <span className="text-body-s">天</span>
          </Card>
        ))}
      </div>
      {w.badges.length ? (
        <div className="flex flex-col gap-2">
          <p className="font-display text-body tracking-[.06em]">{period(w)}拿到的徽章</p>
          <div className="flex flex-wrap gap-3">{w.badges.map((d) => <Badge key={d} days={d} earned />)}</div>
        </div>
      ) : (
        <p className="text-body-s leading-[1.8]">連續記 7 天就能拿第一個徽章，明年一起拚！</p>
      )}
      {w.recurring > 0 && <p className="text-body-s leading-[1.8]">固定收支幫你自動記了 {w.recurring} 筆</p>}
      <Mascot mood={w.longestStreak >= 7 ? 'yay' : 'ok'} className="mt-auto ml-auto w-[130px] flex-none -rotate-3" />
    </>
  );
}

const tripDates = (t: WrappedTrip) =>
  t.startDate && t.endDate ? `${short(t.startDate)}–${short(t.endDate)}` : t.startDate ? `${short(t.startDate)} 出發` : '旅程';

export function TripsSlide({ w, hidden }: { w: Wrapped; hidden: boolean }) {
  return (
    <>
      <Tag>TRIPS & FRIENDS</Tag>
      <Title>{w.trips.length ? <>{period(w)}<br />去了 {w.trips.length} 趟旅程</> : '一起分帳的朋友'}</Title>
      {w.trips.slice(0, 3).map((t) => (
        <Card key={t.id} className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-col">
            <p className="truncate font-display text-body">{t.name}</p>
            <p className="caption">{tripDates(t)}</p>
          </div>
          <div className="flex flex-none flex-col items-end">
            <p className="caption">你花了</p>
            <p className="display text-[20px]">{money(t.spent, hidden)}</p>
          </div>
        </Card>
      ))}
      {w.trips.length > 3 && <p className="caption">還有 {w.trips.length - 3} 趟</p>}
      {w.friends > 0 && (
        <p className="font-display text-title-s leading-[1.6] tracking-[.06em]">
          跟 <Big className="text-[40px]">{w.friends}</Big> 位朋友一起分帳{w.splitGroups ? `・${w.splitGroups} 個群組` : ''}
        </p>
      )}
      <Mascot mood="yay" className="mt-auto ml-auto w-[130px] flex-none rotate-3" />
    </>
  );
}

export function SavingsSlide({ w, hidden }: { w: Wrapped; hidden: boolean }) {
  return (
    <>
      <Tag>SAVINGS</Tag>
      {w.saved > 0 ? (
        <>
          <Title>{period(w)}<br />存進存錢罐</Title>
          <Big className="text-[56px]">{money(w.saved, hidden)}</Big>
        </>
      ) : (
        <Title>{period(w)}<br />存到的目標</Title>
      )}
      {w.goalsAchieved.length > 0 && (
        <Card className="flex flex-col gap-2.5">
          {w.saved > 0 && <p className="caption">存到的目標</p>}
          {w.goalsAchieved.map((g) => (
            <p key={g} className="flex items-center gap-2.5 font-display text-body">
              <span aria-hidden className="check-btn on !size-8"><Check size={16} strokeWidth={2.5} /></span>
              <span className="min-w-0 break-words">{g}</span>
            </p>
          ))}
        </Card>
      )}
      <Mascot kind="piggy" mood="yay" className="mt-auto ml-auto w-[150px] flex-none rotate-6" />
    </>
  );
}

export function AiSlide({ summary, fromAi }: { summary: WrappedSummary | null; fromAi: boolean }) {
  return (
    <>
      <Tag>MONEE SAYS</Tag>
      <Title>Monee 給你的小結語</Title>
      {!summary ? (
        <div aria-busy="true" className="flex flex-col gap-3">
          <p className="font-display text-body">Monee 正在想…</p>
          <div className="skeleton h-16 w-3/5" />
          <div className="skeleton h-28" />
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-1.5">
            <span className="caption">年度稱號</span>
            <p className="story-pop panel self-start -rotate-2 bg-pink px-5 py-3 font-display text-[30px] leading-tight break-words">「{summary.title}」</p>
          </div>
          <p className="text-[17px] leading-[1.9]">{summary.summary}</p>
          {summary.tip && (
            <Card>
              <p className="caption">明年小提醒</p>
              <p className="text-body leading-[1.8]">{summary.tip}</p>
            </Card>
          )}
        </>
      )}
      <div className="mt-auto flex items-end justify-between gap-3">
        {summary && <p className="caption leading-[1.7]">{fromAi ? '由 AI（Gemini）看你的統計數字寫的' : 'AI 暫時連不上，這段是 Monee 自己整理的'}</p>}
        <Mascot mood="yay" className="ml-auto w-[110px] flex-none rotate-6" />
      </div>
    </>
  );
}

/** 最後一張：畫好分享圖給你看，可以隱藏金額，按「存成圖片」叫出分享選單（存到相簿）或下載 */
export function ShareSlide({ w, title, preview }: { w: Wrapped; title: string; preview: boolean }) {
  const showToast = useUi((s) => s.showToast);
  const appHidden = useHidden();
  // 預設跟 App 的「隱藏金額」一樣，這裡改不影響 App
  const [hide, setHide] = useState(appHidden);
  const [card, setCard] = useState<{ blob: Blob; url: string } | null>(null);
  const [failed, setFailed] = useState(false);
  const mascot = useRef<HTMLSpanElement>(null);
  const url = useRef<string | null>(null);

  const data = useMemo((): ShareCardData => ({
    year: w.year,
    partialLabel: w.partial ? `${preview ? '偷看版・' : ''}算到 ${md(w.until)}` : null,
    title,
    expense: hide ? null : w.expense,
    topCategory: w.categories[0] ? { name: getCategory(w.categories[0].categoryId).name, share: w.categories[0].share } : null,
    recordedDays: w.recordedDays,
    longestStreak: w.longestStreak,
    topItem: w.topItem && { note: w.topItem.note, count: w.topItem.count },
    entries: w.entries,
  }), [w, title, hide, preview]);

  useEffect(() => {
    let alive = true;
    drawShareCard(data, mascot.current?.querySelector('svg') ?? null)
      .then((blob) => {
        if (!alive) return;
        if (url.current) URL.revokeObjectURL(url.current);
        url.current = URL.createObjectURL(blob);
        setCard({ blob, url: url.current });
      })
      .catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, [data]);
  useEffect(() => () => { if (url.current) URL.revokeObjectURL(url.current); }, []);

  // 圖已經畫好，按下去馬上叫分享選單（iPhone 要在點擊當下叫，等太久會被擋）
  const save = async () => {
    if (!card) return;
    const result = await shareImage(card.blob, `monee-${w.year}-wrapped.png`, `${w.year} 年度回顧`);
    if (result === 'saved') showToast('圖片下載好了');
  };

  return (
    <>
      <Tag light>SHARE</Tag>
      <Title>存成圖片<br />分享你的 {w.year}</Title>
      <div className="flex min-h-0 flex-1 items-center justify-center">
        {card ? (
          <img src={card.url} alt={`${w.year} 年度回顧分享圖：年度稱號「${title}」${hide ? '' : `，花了 ${money(w.expense, false)}`}`} className="max-h-[46dvh] w-auto rounded-md border-2 border-[#F7F3E8]" />
        ) : failed ? (
          <p className="text-body-s">圖片產生失敗，換個瀏覽器試試</p>
        ) : (
          <div aria-busy="true" aria-label="圖片產生中" className="skeleton aspect-[9/16] h-[46dvh]" />
        )}
      </div>
      <div className="flex flex-col items-center gap-3">
        <button type="button" aria-pressed={hide} onClick={() => setHide((h) => !h)} className="pill press">
          隱藏金額
        </button>
        <button type="button" disabled={!card} onClick={save} className="btn-primary press w-full">存成圖片</button>
        <Link href="/reports" className="press inline-flex min-h-11 items-center text-body-s tracking-[.08em] underline underline-offset-4">回到報表</Link>
      </div>
      <span ref={mascot} className="hidden"><Mascot mood="yay" /></span>
    </>
  );
}
