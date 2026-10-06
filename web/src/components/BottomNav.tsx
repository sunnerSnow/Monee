'use client';

import { ChartPie, House, List, Plus, Wallet, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useUi } from '@/lib/ui-store';

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
      className={`press flex h-14 flex-col items-center justify-center gap-[3px] text-caption tracking-[.08em] ${current ? 'font-medium text-fg' : 'text-muted'}`}
    >
      <span className={`flex h-7 w-12 items-center justify-center rounded-full ${current ? 'bg-brand text-ink' : ''}`}>
        <Icon size={22} strokeWidth={1.5} aria-hidden />
      </span>
      {label}
    </Link>
  );
}

export function BottomNav({ inert }: { inert: boolean }) {
  const pathname = usePathname();
  const openSheet = useUi((s) => s.openSheet);
  const isCurrent = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));

  return (
    <nav
      inert={inert}
      aria-label="主選單"
      className="fixed inset-x-0 bottom-[calc(16px+env(safe-area-inset-bottom))] z-10 mx-auto grid h-[68px] w-[calc(100%-24px)] max-w-[456px] grid-cols-5 items-center rounded-xl border border-line bg-surface px-1.5 shadow-[var(--nav-shadow)]"
    >
      {TABS.slice(0, 2).map((t) => <Tab key={t.href} {...t} current={isCurrent(t.href)} />)}
      <div className="flex flex-col items-center gap-[3px] text-caption tracking-[.08em]">
        <button
          type="button"
          onClick={() => openSheet({ kind: 'entry' })}
          aria-haspopup="dialog"
          aria-label="記一筆"
          className="press -mt-[30px] flex h-[58px] w-[58px] items-center justify-center rounded-full border-4 border-surface bg-[var(--fab-bg)] text-[var(--fab-fg)] shadow-[var(--fab-shadow)]"
        >
          <Plus size={26} strokeWidth={2} aria-hidden />
        </button>
        <span aria-hidden>記一筆</span>
      </div>
      {TABS.slice(2).map((t) => <Tab key={t.href} {...t} current={isCurrent(t.href)} />)}
    </nav>
  );
}
