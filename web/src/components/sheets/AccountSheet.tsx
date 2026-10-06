'use client';

import { useState } from 'react';
import { useAddAccount } from '@/lib/data';
import { parseAmount } from '@/lib/money';
import type { AccountType } from '@/lib/types';
import { useUi } from '@/lib/ui-store';
import { Sheet, SheetHeader } from '../Sheet';

const TYPES: { id: AccountType; label: string; placeholder: string }[] = [
  { id: 'CASH', label: '現金', placeholder: '例如：錢包' },
  { id: 'BANK', label: '銀行', placeholder: '例如：玉山銀行' },
  { id: 'CREDIT_CARD', label: '信用卡', placeholder: '例如：國泰信用卡' },
  { id: 'INVESTMENT_MIRROR', label: '投資帳戶', placeholder: '例如：證券戶' },
];

export function AccountSheet() {
  const open = useUi((s) => s.sheet?.kind === 'account');
  const close = useUi((s) => s.closeSheet);
  return (
    <Sheet open={open} onClose={close} labelledBy="account-title">
      {open && <AccountForm onClose={close} />}
    </Sheet>
  );
}

function AccountForm({ onClose }: { onClose: () => void }) {
  const add = useAddAccount();
  const showToast = useUi((s) => s.showToast);
  const [type, setType] = useState<AccountType>('BANK');
  const [name, setName] = useState('');
  const [balance, setBalance] = useState('');
  const [error, setError] = useState('');
  const meta = TYPES.find((t) => t.id === type)!;
  const card = type === 'CREDIT_CARD';

  const save = async () => {
    const finalName = name.trim() || (type === 'CASH' ? '現金' : '');
    if (!finalName) return setError('請輸入帳戶名稱');
    const amount = parseAmount(balance);
    try {
      await add.mutateAsync({ name: finalName, type, openingBalance: card ? -amount : amount });
      onClose();
      showToast(`已新增帳戶：${finalName}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : '儲存失敗，請再試一次');
    }
  };

  return (
    <>
      <SheetHeader id="account-title" title="新增帳戶" en="Account" onClose={onClose} />
      <div role="group" aria-label="帳戶類型" className="pills flex-wrap">
        {TYPES.map((t) => (
          <button key={t.id} type="button" aria-pressed={type === t.id} onClick={() => setType(t.id)} className="pill press">
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="account-name" className="caption">名稱</label>
        <input id="account-name" data-autofocus value={name} onChange={(e) => { setName(e.target.value); setError(''); }} maxLength={40} placeholder={meta.placeholder} autoComplete="off" className="field-input" />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="account-balance" className="caption">{card ? '目前待繳金額' : '目前餘額'}</label>
        <div className="flex items-baseline gap-1.5 border-b border-fg px-0.5 pt-1 pb-2 focus-within:border-b-2 focus-within:pb-[7px]">
          <span className="display text-[20px]">$</span>
          <input
            id="account-balance"
            inputMode="numeric"
            value={balance}
            onChange={(e) => setBalance(e.target.value.replace(/\D/g, ''))}
            placeholder="0"
            autoComplete="off"
            className="display min-w-0 flex-1 bg-transparent text-[32px] outline-none"
          />
        </div>
        <p className="caption leading-[1.8] tracking-[.04em]">
          {type === 'INVESTMENT_MIRROR'
            ? '之後會由 Monee Invest 自動同步市值，現在先手動填。轉進這個帳戶的錢會記成轉帳，不算支出。'
            : card
              ? '輸入信用卡 App 上顯示的本期待繳，Monee 會記成負債。'
              : '之後可以隨時在「資產」校準餘額。'}
        </p>
      </div>

      {error && <p role="alert" className="-my-2 text-caption text-alert">{error}</p>}
      <button type="button" onClick={save} disabled={add.isPending} className="btn-primary press w-full">
        {add.isPending ? '儲存中…' : '新增帳戶'}
      </button>
    </>
  );
}
