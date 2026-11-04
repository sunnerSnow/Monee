'use client';

import { ArrowRight } from 'lucide-react';
import { useState } from 'react';
import { archiveBlocker, balanceAfter, deleteBlocker, MAX_ACCOUNT_NAME, rulesUsing } from '@/lib/accounts';
import { fetchAccountUsage, useAccounts, useAddAccount, useArchiveAccount, useDeleteAccount, useRecurringRules, useUpdateAccount } from '@/lib/data';
import { formatMoney, parseAmount, signedBalance } from '@/lib/money';
import type { Account, AccountType } from '@/lib/types';
import { useUi } from '@/lib/ui-store';
import { Sheet, SheetHeader } from '../Sheet';
import { useHidden } from '../ui';

const TYPES: { id: AccountType; label: string; placeholder: string }[] = [
  { id: 'CASH', label: '現金', placeholder: '例如：錢包' },
  { id: 'BANK', label: '銀行', placeholder: '例如：玉山銀行' },
  { id: 'CREDIT_CARD', label: '信用卡', placeholder: '例如：國泰信用卡' },
  { id: 'INVESTMENT_MIRROR', label: '投資帳戶', placeholder: '例如：證券戶' },
];

/** 新增帳戶；帶 accountId 時是那個帳戶的設定 */
export function AccountSheet() {
  const sheet = useUi((s) => s.sheet);
  const close = useUi((s) => s.closeSheet);
  const { data: accounts = [] } = useAccounts();
  const editing = sheet?.kind === 'account' && sheet.accountId ? accounts.find((a) => a.id === sheet.accountId) : undefined;
  // 朋友往來由分帳管理，沒有設定
  const open = sheet?.kind === 'account' && (!sheet.accountId || (Boolean(editing) && editing!.type !== 'FRIENDS'));
  return (
    <Sheet open={open} onClose={close} labelledBy="account-title">
      {open && (editing ? <EditAccountForm key={editing.id} account={editing} onClose={close} /> : <AccountForm onClose={close} />)}
    </Sheet>
  );
}

/** 金額輸入列：$ 加大數字，只收數字 */
function AmountInput({ id, value, onChange, autoFocus = false }: { id: string; value: string; onChange: (v: string) => void; autoFocus?: boolean }) {
  return (
    <div className="flex items-baseline gap-1.5 border-b border-fg px-0.5 pt-1 pb-2 focus-within:border-b-2 focus-within:pb-[7px]">
      <span className="display text-[20px]">$</span>
      <input
        id={id}
        data-autofocus={autoFocus || undefined}
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, ''))}
        placeholder="0"
        autoComplete="off"
        className="display min-w-0 flex-1 bg-transparent text-[32px] outline-none"
      />
    </div>
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
        <input id="account-name" data-autofocus value={name} onChange={(e) => { setName(e.target.value); setError(''); }} maxLength={MAX_ACCOUNT_NAME} placeholder={meta.placeholder} autoComplete="off" className="field-input" />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="account-balance" className="caption">{card ? '目前待繳金額' : '目前餘額'}</label>
        <AmountInput id="account-balance" value={balance} onChange={setBalance} />
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

/**
 * 帳戶設定：改名、改期初餘額（建立時填錯了）、校準、封存、刪除。
 * 封存要餘額是 0、沒有固定收支用它；刪除只能刪沒有任何帳的帳戶，有帳的請封存。
 */
function EditAccountForm({ account, onClose }: { account: Account; onClose: () => void }) {
  const update = useUpdateAccount();
  const archive = useArchiveAccount();
  const remove = useDeleteAccount();
  const rulesQ = useRecurringRules();
  // 固定收支還沒讀到（或讀不到）時不能判斷能不能封存
  const rules = rulesQ.data;
  const openSheet = useUi((s) => s.openSheet);
  const showToast = useUi((s) => s.showToast);
  const hidden = useHidden();
  const card = account.type === 'CREDIT_CARD';
  const invest = account.type === 'INVESTMENT_MIRROR';
  const [name, setName] = useState(account.name);
  const initialOpening = String(Math.round(Math.abs(account.openingBalance)));
  const [opening, setOpening] = useState(initialOpening);
  const [error, setError] = useState('');
  // 封存、刪除擋下來的原因，放在那兩個按鈕旁邊
  const [notice, setNotice] = useState('');
  // 按了刪除、檢查過可以刪：等第二次確認；recurring 是會一起刪掉的固定收支筆數
  const [confirmDelete, setConfirmDelete] = useState<{ recurring: number } | null>(null);
  const [checking, setChecking] = useState(false);

  // 欄位沒動過就照原本的期初餘額（可能是負的或有小數，例如備份還原進來的），只改名字不會動到它
  const openingValue = opening === initialOpening ? account.openingBalance : card ? -parseAmount(opening) : parseAmount(opening);
  const finalName = name.trim();
  const changed = finalName !== account.name || openingValue !== account.openingBalance;
  const after = balanceAfter(account, openingValue);
  const busy = update.isPending || archive.isPending || remove.isPending || checking;
  const label = card ? '待繳' : '餘額';
  const canReconcile = !account.archived && !invest;
  const message = (e: unknown) => (e instanceof Error ? e.message : '儲存失敗，請再試一次');

  const save = async () => {
    if (!finalName) return setError('請輸入帳戶名稱');
    try {
      await update.mutateAsync({ account, name: finalName, openingBalance: openingValue });
      onClose();
      showToast(`已更新帳戶：${finalName}`);
    } catch (e) {
      setError(message(e));
    }
  };

  const setArchived = async (archived: boolean) => {
    if (archived && !rules) return setNotice('固定收支還沒讀到，等一下再試');
    const blocker = archived ? archiveBlocker(account, rules!) : null;
    if (blocker) return setNotice(blocker);
    try {
      await archive.mutateAsync({ id: account.id, archived });
      onClose();
      showToast(archived ? `已封存：${account.name}，以前的帳都還在` : `已取消封存：${account.name}`);
    } catch (e) {
      setNotice(message(e));
    }
  };

  const askDelete = async () => {
    setNotice('');
    if (!rules) return setNotice('固定收支還沒讀到，等一下再試');
    setChecking(true);
    try {
      const blocker = deleteBlocker(account, await fetchAccountUsage(account.id));
      if (blocker) setNotice(blocker);
      else setConfirmDelete({ recurring: rulesUsing(rules, account.id).length });
    } catch (e) {
      setNotice(message(e));
    } finally {
      setChecking(false);
    }
  };

  const doDelete = async () => {
    try {
      await remove.mutateAsync(account.id);
      onClose();
      showToast(`已刪除帳戶：${account.name}`);
    } catch (e) {
      setConfirmDelete(null);
      setNotice(message(e));
    }
  };

  return (
    <>
      <SheetHeader
        id="account-title"
        title="帳戶設定"
        en="Account"
        sub={`${TYPES.find((t) => t.id === account.type)?.label ?? ''}${account.archived ? '・已封存' : ''}`}
        onClose={onClose}
      />

      {canReconcile && (
        <button type="button" onClick={() => openSheet({ kind: 'reconcile', accountId: account.id })} className="btn-secondary press w-full !justify-between !px-5">
          <span>校準餘額</span>
          <span className="flex items-center gap-1.5">
            <span className="num">{card ? '待繳 ' : ''}{card ? (hidden ? '$ ••••' : formatMoney(account.currentBalance)) : signedBalance(account.currentBalance, hidden)}</span>
            <ArrowRight size={16} strokeWidth={1.5} aria-hidden />
          </span>
        </button>
      )}

      <div className="flex flex-col gap-2">
        <label htmlFor="account-name" className="caption">名稱</label>
        <input id="account-name" value={name} onChange={(e) => { setName(e.target.value); setError(''); }} maxLength={MAX_ACCOUNT_NAME} autoComplete="off" className="field-input" />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="account-opening" className="caption">{card ? '建立時的待繳金額' : '建立時的餘額（期初餘額）'}</label>
        <AmountInput id="account-opening" value={opening} onChange={(v) => { setOpening(v); setError(''); }} />
        <p aria-live="polite" className="caption leading-[1.8] tracking-[.04em]">
          {openingValue !== account.openingBalance
            ? `目前${label}會從 ${hidden ? '$ ••••' : formatMoney(account.currentBalance)} 變成 ${hidden ? '$ ••••' : formatMoney(after)}${after < 0 && !card ? '（負的）' : ''}。`
            : invest
              ? '投資帳戶的市值之後由 Monee Invest 同步，現在先在這裡手動調整。'
              : `建立時填錯了就改這裡，目前${label}會跟著變${canReconcile ? `；跟${card ? '信用卡' : '銀行'} App 對不上請用「校準餘額」` : ''}。`}
        </p>
      </div>

      {error && <p role="alert" className="-my-2 text-caption leading-[1.7] text-alert">{error}</p>}
      <button type="button" onClick={save} disabled={!changed || busy} className="btn-primary press w-full">
        {update.isPending ? '儲存中…' : '儲存'}
      </button>

      <div className="flex flex-col gap-3 border-t border-line pt-4">
        <div className="flex flex-col gap-1.5">
          <button type="button" onClick={() => setArchived(!account.archived)} disabled={busy} className="btn-secondary press w-full">
            {account.archived ? '取消封存' : '封存帳戶'}
          </button>
          <p className="caption leading-[1.7]">
            {account.archived ? '取消封存後，記帳時又可以選它，也會算進資產。' : '不用了就封存：以前的帳都還在，記帳時不會再選到它，也不算進資產。'}
          </p>
        </div>
        {notice && <p role="alert" className="text-caption leading-[1.7] text-alert">{notice}</p>}
        {confirmDelete ? (
          <div role="alertdialog" aria-labelledby="account-delete-q" className="flex flex-col gap-2.5 rounded-md border-2 border-alert bg-alert-tint px-4 py-3">
            <p id="account-delete-q" className="text-body-s leading-[1.7] text-alert">
              確定刪除「{account.name}」？{confirmDelete.recurring ? `用到它的 ${confirmDelete.recurring} 筆固定收支也會一起刪掉。` : ''}刪了不能復原。
            </p>
            <div className="flex gap-2">
              <button type="button" onClick={doDelete} disabled={busy} className="btn-secondary press flex-1 !bg-alert !text-white">
                {remove.isPending ? '刪除中…' : '確定刪除'}
              </button>
              <button type="button" onClick={() => setConfirmDelete(null)} disabled={busy} className="btn-secondary press flex-1">取消</button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={askDelete} disabled={busy} className="press min-h-11 self-center px-3 text-body-s tracking-[.08em] text-alert">
            {checking ? '檢查中…' : '刪除帳戶'}
          </button>
        )}
      </div>
    </>
  );
}
