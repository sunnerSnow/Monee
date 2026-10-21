'use client';

import { ChartPie, House, List, Plus, Wallet, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useUi } from '@/lib/ui-store';
import { SealShape } from './Seal';

const TABS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: '/', label: '首頁', icon: House },
  { href: '/transactions', label: '明細', icon: List },
  { href: '/assets', label: '資產', icon: Wallet },
  { href: '/reports', label: '報表', icon: ChartPie },
];

function Tab({ href, label, icon: Icon, current }: (typeof TABS)[number] & { current: boolean }) {
  return (
    <Link
      href={href}
      aria-current={current ? 'page' : undefined}
      className={`press flex h-14 flex-col items-center justify-center gap-[3px] font-display text-caption tracking-[.08em] ${current ? 'text-brand' : 'text-[#F7F3E8]'}`}
    >
      <span className={`flex h-7 w-12 items-center justify-center rounded-full ${current ? 'border-2 border-[#F7F3E8] bg-brand text-ink' : ''}`}>
        <Icon size={22} strokeWidth={2} aria-hidden />
      </span>
      {label}
    </Link>
  );
}

export function BottomNav({ inert }: { inert: boolean }) {
  const pathname = usePathname();
  const openSheet = useUi((s) => s.openSheet);
  // 分帳頁從資產頁進去，底部也標在資產
  const isCurrent = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href) || (href === '/assets' && pathname.startsWith('/split'));

  return (
    <nav
      inert={inert}
      aria-label="主選單"
      // 黑色長條、白字；目前分頁是黃色。深淺模式都一樣，實心影在深色模式多一圈米白
      className="fixed inset-x-0 bottom-[calc(16px+env(safe-area-inset-bottom))] z-10 mx-auto grid h-[68px] w-[calc(100%-24px)] max-w-[456px] grid-cols-5 items-center rounded-xl border-[2.5px] border-ink bg-ink px-1.5 shadow-[var(--pop)]"
    >
      {TABS.slice(0, 2).map((t) => <Tab key={t.href} {...t} current={isCurrent(t.href)} />)}
      <div className="flex flex-col items-center gap-[3px] font-display text-caption tracking-[.08em] text-[#F7F3E8]">
        {/* ＋：紅色鋸齒徽章，浮在導覽列上面 */}
        <button
          type="button"
          onClick={() => openSheet({ kind: 'entry' })}
          aria-haspopup="dialog"
          aria-label="記一筆"
          className="press relative -mt-[40px] flex h-[var(--fab)] w-[var(--fab)] items-center justify-center text-[var(--fab-fg)]"
        >
          <SealShape fill="var(--fab-bg)" className="absolute inset-0 h-full w-full" />
          <Plus size={30} strokeWidth={3} aria-hidden className="relative" />
        </button>
        <span aria-hidden>記一筆</span>
      </div>
      {TABS.slice(2).map((t) => <Tab key={t.href} {...t} current={isCurrent(t.href)} />)}
    </nav>
  );
}
