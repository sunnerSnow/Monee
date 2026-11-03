'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useMemo } from 'react';
import { requestWrappedSummary } from '@/lib/ai-client';
import { getCategory, useCategories } from '@/lib/categories';
import { useActivity, useDepositsUntil, useGoals, useSplitGroups, useYearTransactions } from '@/lib/data';
import { toISODate } from '@/lib/dates';
import { useNow } from '@/lib/use-now';
import { computeWrapped, hasWrapped, isPreview, parseYear, type Wrapped } from '@/lib/wrapped';
import { fallbackSummary, sanitizeWrappedSummary, wrappedStats, type WrappedStats, type WrappedSummary } from '@/lib/wrapped-ai';
import { Mascot } from '../Mascot';
import { ErrorBox, useHidden } from '../ui';
import {
  AiSlide, CategoriesSlide, HabitsSlide, IntroSlide, ItemSlide, MoneySlide, MonthsSlide, SavingsSlide, ShareSlide, TripsSlide,
} from '../wrapped/Slides';
import { Story, StoryFrame, type StorySlide } from '../wrapped/Story';

const AI_CACHE = 'monee-wrapped-ai';

/** 同樣的統計就用上次 AI 寫的（存在這支手機）；又記了帳、統計變了才重寫 */
async function summaryFor(stats: WrappedStats, signal: AbortSignal): Promise<WrappedSummary> {
  const stamp = JSON.stringify(stats);
  const read = () => {
    try {
      return (JSON.parse(localStorage.getItem(AI_CACHE) ?? '{}') ?? {}) as Record<string, { stamp?: string; summary?: unknown }>;
    } catch {
      return {};
    }
  };
  const hit = read()[stats.year];
  const cached = hit?.stamp === stamp ? sanitizeWrappedSummary(hit.summary) : null;
  if (cached) return cached;
  const summary = await requestWrappedSummary(stats, signal);
  try {
    localStorage.setItem(AI_CACHE, JSON.stringify({ ...read(), [stats.year]: { stamp, summary } }));
  } catch {
    // 存不了（無痕模式）就下次再問一次
  }
  return summary;
}

function slidesOf(w: Wrapped, o: { hidden: boolean; preview: boolean; summary: WrappedSummary | null; fromAi: boolean; title: string }): StorySlide[] {
  const { hidden } = o;
  const list: (StorySlide | false)[] = [
    { key: 'intro', label: '開場', bg: 'var(--yellow)', content: <IntroSlide w={w} preview={o.preview} /> },
    (w.expense > 0 || w.income > 0) && { key: 'money', label: '一年的收支', bg: 'var(--teal)', content: <MoneySlide w={w} hidden={hidden} /> },
    w.categories.length > 0 && { key: 'categories', label: '花最多的分類', bg: 'var(--pink)', content: <CategoriesSlide w={w} hidden={hidden} /> },
    Boolean(w.peakMonth) && { key: 'months', label: '每個月花多少', bg: 'var(--orange)', content: <MonthsSlide w={w} hidden={hidden} /> },
    Boolean(w.topItem || w.biggest) && { key: 'item', label: '最常買的', bg: 'var(--purple)', content: <ItemSlide w={w} hidden={hidden} /> },
    w.recordedDays > 0 && { key: 'habits', label: '記帳習慣', bg: 'var(--green)', content: <HabitsSlide w={w} /> },
    (w.trips.length > 0 || w.friends > 0) && { key: 'trips', label: '旅程與分帳', bg: 'var(--blue)', content: <TripsSlide w={w} hidden={hidden} /> },
    (w.saved > 0 || w.goalsAchieved.length > 0) && { key: 'savings', label: '存錢目標', bg: 'var(--cream)', content: <SavingsSlide w={w} hidden={hidden} /> },
    { key: 'ai', label: 'Monee 的小結語', bg: 'var(--yellow)', content: <AiSlide summary={o.summary} fromAi={o.fromAi} /> },
    { key: 'share', label: '分享圖', bg: 'var(--ink)', dark: true, content: <ShareSlide w={w} title={o.title} preview={o.preview} /> },
  ];
  return list.filter((s): s is StorySlide => Boolean(s));
}

/** 年度回顧：yearParam 是網址的 ?year=；沒帶或不對時 12 月看今年、其他月份看去年 */
export function WrappedScreen({ yearParam }: { yearParam?: string }) {
  useCategories(); // 分類改名時名稱跟著換
  const hidden = useHidden();
  const now = useNow();
  const today = now ? toISODate(now) : null;
  const year = today ? parseYear(yearParam, today) : 0;
  const txQ = useYearTransactions(year);
  const depositsQ = useDepositsUntil(year);
  const activityQ = useActivity();
  const groupsQ = useSplitGroups();
  const goalsQ = useGoals();
  const queries = [txQ, depositsQ, activityQ, groupsQ, goalsQ];

  const w = useMemo(() => (today && txQ.data && depositsQ.data && activityQ.data && groupsQ.data && goalsQ.data
    ? computeWrapped({
      year, today, transactions: txQ.data, deposits: depositsQ.data, activity: activityQ.data, groups: groupsQ.data, goals: goalsQ.data,
    })
    : null), [year, today, txQ.data, depositsQ.data, activityQ.data, groupsQ.data, goalsQ.data]);
  const stats = w && hasWrapped(w) ? wrappedStats(w, (id) => getCategory(id).name) : null;
  const ai = useQuery({
    queryKey: ['wrapped-ai', stats],
    enabled: Boolean(stats),
    staleTime: Infinity,
    retry: false,
    queryFn: ({ signal }) => summaryFor(stats!, signal),
  });

  if (!today || queries.some((q) => q.isPending)) {
    return (
      <StoryFrame label="年度回顧載入中">
        <div aria-busy="true" className="flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
          <Mascot mood="ok" className="w-[150px] motion-safe:animate-[wiggle_1.2s_ease-in-out_infinite]" />
          <p className="font-display text-body tracking-[.08em]">翻帳本中…</p>
        </div>
      </StoryFrame>
    );
  }
  const error = queries.find((q) => q.error)?.error;
  if (error || !w) {
    return (
      <StoryFrame label="年度回顧">
        <div className="flex flex-1 flex-col justify-center px-6">
          <ErrorBox message={error?.message ?? '資料載入失敗'} onRetry={() => queries.forEach((q) => q.refetch())} />
        </div>
      </StoryFrame>
    );
  }

  const currentYear = Number(today.slice(0, 4));
  if (!stats) {
    return (
      <StoryFrame label="年度回顧">
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
          <Mascot mood="ok" className="w-[150px]" />
          <h1 className="font-display text-title-m tracking-[.08em]">{year} 年還沒有記帳資料</h1>
          <p className="text-body-s leading-[1.8]">
            {year < currentYear ? '這一年還沒開始用 Monee。可以先偷看今年到目前為止的回顧。' : '記帳一段時間後，再回來看看你的年度故事。'}
          </p>
          {year < currentYear && <Link href={`/wrapped?year=${currentYear}`} className="btn-primary press">先偷看今年</Link>}
        </div>
      </StoryFrame>
    );
  }

  const fallback = fallbackSummary(stats);
  const summary = ai.data ?? (ai.isError ? fallback : null);
  return (
    <Story
      key={year}
      slides={slidesOf(w, { hidden, preview: isPreview(year, today), summary, fromAi: Boolean(ai.data), title: summary?.title ?? fallback.title })}
    />
  );
}
