'use client';

import { CircleCheck } from 'lucide-react';
import { useState } from 'react';
import { reconcileDiff } from '@/lib/budget';
import { useAccounts, useReconcile } from '@/lib/data';
import { formatMoney, parseAmount } from '@/lib/money';
import type { Account } from '@/lib/types';
import { useUi } from '@/lib/ui-store';
import { Sheet, SheetHeader } from '../Sheet';

export function ReconcileSheet() {
  const sheet = useUi((s) => s.sheet);
  const close = useUi((s) => s.closeSheet);
  const { data: accounts = [] } = useAccounts();
  const account = sheet?.kind === 'reconcile' ? accounts.find((a) => a.id === sheet.accountId) : undefined;
  return (
    <Sheet open={Boolean(account)} onClose={close} labelledBy="reconcile-title">
      {account && <ReconcileForm key={account.id} account={account} onClose={close} />}
    </Sheet>
  );
}

/** 對應 monee_ux.md「B. 資產校準機制」 */
function ReconcileForm({ account, onClose }: { account: Account; onClose: () => void }) {
  const reconcile = useReconcile();
  const showToast = useUi((s) => s.showToast);
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const card = account.type === 'CREDIT_CARD';
  const diff = input ? reconcileDiff(account, parseAmount(input)) : null;

  const apply = async () => {
    try {
      const d = await reconcile.mutateAsync({ account, input: parseAmount(input) });
      onClose();
      showToast(d === 0 ? `${account.name} 已校準` : `已補記${d < 0 ? '未記錄雜項' : '未記錄收入'} ${formatMoney(d)}，餘額已校準`);
    } catch (e) {
      setError(e instanceof Error ? e.message : '校準失敗，請再試一次');
    }
  };

  return (
    <>
      <SheetHeader id="reconcile-title" title="校準餘額" en="Reconcile" sub={account.name} onClose={onClose} />
      <div className="flex items-baseline justify-between gap-3 rounded-sm bg-fill px-4 py-3.5">
        <span className="caption">Monee 紀錄的{card ? '待繳金額' : '餘額'}</span>
        <span className="display text-[18px]">{formatMoney(account.currentBalance)}</span>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="reconcile-input" className="caption">{card ? '信用卡 App 顯示的待繳金額' : '銀行 App 顯示的餘額'}</label>
        <div className="flex items-baseline gap-1.5 border-b border-fg px-0.5 pt-1 pb-2 focus-within:border-b-2 focus-within:pb-[7px]">
          <span className="display text-[20px]">$</span>
          <input
            id="reconcile-input"
            data-autofocus
            inputMode="numeric"
            value={input}
            onChange={(e) => { setInput(e.target.value.replace(/\D/g, '')); setError(''); }}
            placeholder="0"
            autoComplete="off"
            className="display min-w-0 flex-1 bg-transparent text-[32px] outline-none"
          />
        </div>
      </div>

      <div aria-live="polite" className="flex min-h-[72px] flex-col gap-1.5">
        {diff === null && <p className="caption leading-[1.8] tracking-[.04em]">輸入後，Monee 會幫你算出跟紀錄的差額。</p>}
        {diff === 0 && (
          <p className="flex items-center gap-1.5 text-[14px] font-medium">
            <CircleCheck size={16} strokeWidth={1.5} aria-hidden />跟紀錄一致，不用調整。
          </p>
        )}
        {diff !== null && diff !== 0 && (
          <>
            <p className="text-[15px]">與紀錄相差 <b className="num text-[18px] font-normal">{formatMoney(diff)}</b></p>
            <p className="caption leading-[1.8] tracking-[.04em]">
              {diff < 0
                ? '實際比紀錄少，可能有漏記的花費。要用「未記錄雜項」補一筆支出嗎？'
                : '實際比紀錄多，可能有漏記的收入。要用「未記錄收入」補一筆嗎？'}
            </p>
          </>
        )}
      </div>

      {error && <p role="alert" className="-my-2 text-caption text-alert">{error}</p>}
      <div className="flex flex-col gap-2.5">
        <button type="button" onClick={apply} disabled={diff === null || reconcile.isPending} className="btn-primary press w-full">
          {reconcile.isPending ? '校準中…' : diff === null ? '補齊差額' : diff === 0 ? '完成校準' : diff < 0 ? '以未記錄雜項補齊' : '以未記錄收入補齊'}
        </button>
        {diff !== null && diff !== 0 && (
          <button type="button" onClick={onClose} className="btn-secondary press w-full">我再檢查一下</button>
        )}
      </div>
    </>
  );
}
