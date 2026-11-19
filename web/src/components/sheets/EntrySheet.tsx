'use client';

import { ChevronDown, PenLine, Plane, Trash2, Users, type LucideIcon } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import type { AiDraftTransaction } from '@/lib/ai-draft';
import { selectable } from '@/lib/accounts';
import { suggestEntries } from '@/lib/budget';
import { amountHint, amountOf, collapse, pressKey, type CalcKey } from '@/lib/calc';
import { categoriesFor, defaultCategory, getCategory, useCategories, type ManagedType } from '@/lib/categories';
import { formatForeign, getCurrency, toTwd, twdPerUnit } from '@/lib/currency';
import { useAccounts, useAddTransaction, useDeleteTransaction, useFxRates, useSaveRecurring, useSplitGroups, useTransactions, useUpdateTransaction } from '@/lib/data';
import { activeTrip } from '@/lib/split';
import { toISODate, toTime } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { after, describe, scheduleFrom, shortDue, type Frequency } from '@/lib/recurring';
import type { Transaction, TransactionType } from '@/lib/types';
import { useUi } from '@/lib/ui-store';
import { useReceiptDraft } from '@/lib/use-receipt-draft';
import { ReceiptField } from '../Receipt';
import { Sheet, SheetBody, SheetFooter, SheetHeader } from '../Sheet';
import { SplitEntryPanel, SplitLinkedNotice, SplitSwitch } from '../split/SplitInEntry';
import { EmptyBox, SwitchRow } from '../ui';
import { AiEntryBar } from './AiEntryBar';
import { AmountDisplay, AmountPad } from './AmountPad';

const TYPES: [TransactionType, string][] = [['EXPENSE', '支出'], ['INCOME', '收入'], ['TRANSFER', '轉帳']];

/** 記一筆（新增）與點交易列打開的編輯共用同一個表單 */
export function EntrySheet() {
  const sheet = useUi((s) => s.sheet);
  const close = useUi((s) => s.closeSheet);
  const { data: txs, isSuccess } = useTransactions();
  const editId = sheet?.kind === 'transaction' ? sheet.id : null;
  const editing = editId ? txs?.find((t) => t.id === editId) : undefined;
  const open = sheet?.kind === 'entry' || Boolean(editing);

  // 要編輯的交易已經不在了（例如在別的分頁刪掉），就關掉面板，避免背景一直保持不可操作
  useEffect(() => {
    if (editId && isSuccess && !editing) close();
  }, [editId, isSuccess, editing, close]);

  return (
    // docked：鍵盤和「記下」固定在面板底部，上面的欄位自己捲
    <Sheet open={open} onClose={close} labelledBy="entry-title" docked>
      {open && <EntryForm key={editing?.id ?? 'new'} editing={editing} onClose={close} />}
    </Sheet>
  );
}

type PillItem = { id: string; label: ReactNode; Icon?: LucideIcon; color?: string };

const scrollBehavior = (): ScrollBehavior => (matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth');

/** 左右滑的單選膠囊列；目前選的（例如 AI 幫你選的分類）在畫面外時，自動捲過去讓它看得到 */
function PillRow({ id, label, items, current, onPick }: {
  id?: string;
  label: string;
  items: PillItem[];
  current: string;
  onPick: (id: string) => void;
}) {
  const row = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = row.current;
    const pill = el?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (!el || !pill) return;
    const box = el.getBoundingClientRect();
    const p = pill.getBoundingClientRect();
    const delta = p.left < box.left ? p.left - box.left - 8 : p.right > box.right ? p.right - box.right + 8 : 0;
    if (delta) el.scrollBy({ left: delta, behavior: scrollBehavior() });
  }, [current]);
  return (
    <div ref={row} id={id} role="group" aria-label={label} className="pills">
      {items.map((it) => (
        <button key={it.id} type="button" aria-pressed={current === it.id} onClick={() => onPick(it.id)} className={`pill press ${it.Icon ? 'pl-2' : ''}`}>
          {it.Icon && <span aria-hidden className="ico xs" style={{ background: it.color }}><it.Icon size={14} strokeWidth={2} /></span>}
          {it.label}
        </button>
      ))}
    </div>
  );
}

function EntryForm({ editing, onClose }: { editing?: Transaction; onClose: () => void }) {
  useCategories(); // 分類改名、隱藏時重畫
  const { data: accounts = [], isPending } = useAccounts();
  const { data: txs = [] } = useTransactions();
  const add = useAddTransaction();
  const update = useUpdateTransaction();
  const remove = useDeleteTransaction();
  const openSheet = useUi((s) => s.openSheet);
  const showToast = useUi((s) => s.showToast);
  const flash = useUi((s) => s.flash);

  const [type, setType] = useState<TransactionType>(editing?.type ?? 'EXPENSE');
  const [amount, setAmount] = useState(editing ? String(Math.round(editing.amount)) : '');
  const [categoryId, setCategoryId] = useState(() => editing?.categoryId ?? defaultCategory('EXPENSE'));
  const [source, setSource] = useState(editing?.sourceAccountId ?? '');
  const [target, setTarget] = useState(editing?.targetAccountId ?? '');
  const [note, setNote] = useState(editing?.note ?? '');
  // 品項是使用者自己打的才列提示；AI 或點提示填進去的不列，免得擋在中間
  const [typedNote, setTypedNote] = useState(false);
  const [date, setDate] = useState(() => editing?.date ?? toISODate(new Date()));
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  // 帳戶收成一顆按鈕，點了才展開選項
  const [picker, setPicker] = useState<'source' | 'target' | null>(null);
  const sourceChip = useRef<HTMLButtonElement>(null);
  const targetChip = useRef<HTMLButtonElement>(null);
  // 收據、固定收支、分帳收在「更多」
  const [moreOpen, setMoreOpen] = useState(false);
  const photo = useReceiptDraft(editing?.receiptPath ?? null);
  const [uploading, setUploading] = useState(false);
  // 設成固定收支：這一筆照常記下，之後每期幫你記或先問你
  const saveRule = useSaveRecurring();
  const [repeat, setRepeat] = useState(false);
  const [repeatFreq, setRepeatFreq] = useState<Frequency>('monthly');
  const [repeatAuto, setRepeatAuto] = useState(false);
  const { data: groups = [] } = useSplitGroups();
  const fx = useFxRates();
  // 旅程期間打開記一筆：直接記到這趟旅程（可以關掉分帳開關改記一般支出）
  const trip = editing ? undefined : activeTrip(groups, toISODate(new Date()));
  const [splitOff, setSplitOff] = useState(false);
  const [splitOnManual, setSplitOnManual] = useState(false);
  const splitOn = splitOnManual || (Boolean(trip) && !splitOff);

  // 下面幾個都在按鈕的事件裡做：flushSync 先把畫面換好，再移焦點或捲動（新出現的元素這時才在畫面上）
  // 切換分帳時畫面整個換掉，把焦點放回開關；不要捲動，金額和品項才會留在畫面上方
  const toggleSplit = (on: boolean) => {
    flushSync(() => {
      setSplitOnManual(on);
      setSplitOff(!on);
    });
    document.querySelector<HTMLElement>('[data-split-switch]')?.focus({ preventScroll: true });
  };
  // 展開帳戶選項、「更多」時，新出現的內容可能在可視範圍下面：捲到剛好看得到
  const reveal = (id: string) => document.getElementById(id)?.scrollIntoView({ block: 'nearest', behavior: scrollBehavior() });
  const openPicker = (which: 'source' | 'target' | null) => {
    flushSync(() => setPicker(which));
    if (which) reveal(`entry-${which}`);
  };
  const toggleMore = () => {
    const next = !moreOpen;
    flushSync(() => setMoreOpen(next));
    if (next) reveal('entry-more');
  };

  // 朋友往來由分帳管理；投資帳戶由 Monee Invest 同步，只能當轉入對象；封存的不列；編輯舊交易時保留它原本的帳戶
  const usable = selectable(accounts, [editing?.sourceAccountId, editing?.targetAccountId]).filter((a) => a.type !== 'FRIENDS');
  const payable = usable.filter((a) => a.type !== 'INVESTMENT_MIRROR' || a.id === editing?.sourceAccountId);
  const sourceId = source || payable[0]?.id || '';
  const targets = usable.filter((a) => a.id !== sourceId);
  // amount 是鍵盤打出來的算式（例如 1200+350×2），value 是算出來可以記下的金額
  const value = amountOf(amount);
  // 品項提示：還沒打字是最常記的，打字時找符合的；點一下帶入分類、帳戶（金額還沒打才帶入）
  // 會走過全部交易，按數字鍵盤時不用重算
  const suggestions = useMemo(
    () => (editing || type === 'TRANSFER' || (note.trim() && !typedNote) ? [] : suggestEntries(txs, type, note)),
    [editing, type, note, typedNote, txs],
  );
  const saving = uploading || add.isPending || update.isPending;
  const busy = saving || remove.isPending;
  const title = note.trim() || getCategory(type === 'TRANSFER' ? 'transfer' : categoryId).name;
  const sourceLabel = type === 'TRANSFER' ? '轉出' : type === 'INCOME' ? '存入' : '付款';
  const nameOf = (id: string) => accounts.find((a) => a.id === id)?.name;
  const moreSummary = [photo.has && '收據', repeat && '固定收支'].filter(Boolean).join('、');

  const switchType = (next: TransactionType) => {
    setType(next);
    setCategoryId(next === 'TRANSFER' ? 'transfer' : defaultCategory(next));
    setError('');
    // 轉帳一定要選轉入帳戶，直接展開
    openPicker(next === 'TRANSFER' && !target ? 'target' : null);
  };

  const press = (key: CalcKey) => {
    setError('');
    setAmount((a) => pressKey(a, key));
  };
  // 按 =（或實體鍵盤的 Enter）：把算式收成結果，可以接著算
  const equals = () => setAmount(collapse);

  // AI 草稿只是先幫忙填欄位；沒提到的帳戶沿用目前選的，使用者檢查後按「記下」才寫入
  const applyDraft = (d: AiDraftTransaction) => {
    const from = d.suggestedAccountId ?? sourceId;
    // 一般記帳只記台幣：外幣收據用今天的參考匯率換成台幣，原幣金額寫進備註
    let twd = d.suggestedAmount;
    let hint: string | undefined;
    let draftNote = d.suggestedNote;
    if (d.suggestedCurrency !== 'TWD' && d.suggestedAmount) {
      const original = formatForeign(d.suggestedAmount, d.suggestedCurrency);
      const rate = twdPerUnit(fx.data, d.suggestedCurrency);
      twd = rate ? toTwd(d.suggestedAmount, rate) : 0;
      draftNote = `${draftNote}（${original}）`;
      hint = rate
        ? `${getCurrency(d.suggestedCurrency).name} ${original} 用今天的參考匯率換成台幣，可以改成實際刷卡的金額`
        : `${getCurrency(d.suggestedCurrency).name} ${original}，匯率暫時拿不到，請自己輸入台幣金額`;
    }
    const to = d.suggestedTargetAccountId && d.suggestedTargetAccountId !== from ? d.suggestedTargetAccountId : '';
    setType(d.suggestedType);
    setAmount(twd ? String(twd) : '');
    setCategoryId(d.suggestedCategoryId);
    if (d.suggestedAccountId) setSource(d.suggestedAccountId);
    setTarget(to);
    setPicker(d.suggestedType === 'TRANSFER' && !to ? 'target' : null);
    setNote(draftNote);
    setTypedNote(false);
    setDate(d.suggestedDate);
    setError('');
    return hint;
  };

  const applySuggestion = (t: Transaction) => {
    const kind = t.type as ManagedType;
    setType(kind);
    // 已經打了金額就不蓋掉（例如先打 260，再從提示挑「午餐・拉麵」帶入分類和帳戶）
    if (!value) setAmount(String(t.amount));
    // 分類被隱藏或刪掉、帳戶封存了，就不帶入，維持目前的選擇
    const categoryOk = categoriesFor(kind).some((c) => c.id === t.categoryId);
    setCategoryId(categoryOk ? t.categoryId : kind === type ? categoryId : defaultCategory(kind));
    if (payable.some((a) => a.id === t.sourceAccountId)) setSource(t.sourceAccountId);
    setNote(t.note ?? '');
    setTypedNote(false);
    setError('');
  };

  const pickSource = (id: string) => {
    setSource(id);
    if (id === target) setTarget('');
    setPicker(null);
    // 選項收起來了，焦點回到帳戶按鈕
    sourceChip.current?.focus({ preventScroll: true });
  };
  const pickTarget = (id: string) => {
    setTarget(id);
    setPicker(null);
    targetChip.current?.focus({ preventScroll: true });
  };

  const save = async () => {
    if (!value) return setError('請輸入金額');
    if (!sourceId) return setError('請先新增帳戶');
    if (type === 'TRANSFER' && !target) {
      setError('請選擇轉入帳戶');
      return openPicker('target');
    }
    const now = new Date();
    let receiptPath: string | null;
    setUploading(true);
    try {
      receiptPath = await photo.upload();
    } catch (e) {
      return setError(e instanceof Error ? e.message : '照片上傳失敗，請再試一次');
    } finally {
      setUploading(false);
    }
    const payload = {
      date,
      time: editing ? editing.time : date === toISODate(now) ? toTime(now) : null,
      type,
      amount: value,
      categoryId: type === 'TRANSFER' ? 'transfer' : categoryId,
      sourceAccountId: sourceId,
      targetAccountId: type === 'TRANSFER' ? target : null,
      note: note.trim() || null,
      receiptPath,
    };
    try {
      const id = editing ? await update.mutateAsync({ id: editing.id, ...payload }) : await add.mutateAsync(payload);
      photo.settle(receiptPath, true);
      // 固定收支從下一期開始（這一筆已經記了）；設不起來也不影響已經記好的這筆，提示再設一次就好
      let repeatNote = '';
      if (!editing && repeat) {
        const schedule = scheduleFrom(repeatFreq, date);
        try {
          await saveRule.mutateAsync({
            type, amount: value, categoryId: payload.categoryId, sourceAccountId: sourceId, targetAccountId: payload.targetAccountId, note: payload.note,
            ...schedule, auto: repeatAuto, nextDate: after(schedule, date), paused: false,
          });
          repeatNote = `，之後${describe(schedule)}${repeatAuto ? '自動記' : '會先問你'}`;
        } catch {
          repeatNote = '；固定收支沒設好，到「我的 → 固定收支」再設一次';
        }
      }
      flash(id);
      onClose();
      showToast(`${editing ? '已更新' : '已記下'}：${title} ${formatMoney(value)}${repeatNote}`);
    } catch (e) {
      photo.settle(receiptPath, false);
      setError(e instanceof Error ? e.message : '儲存失敗，請再試一次');
    }
  };

  const destroy = async () => {
    if (!editing) return;
    try {
      await remove.mutateAsync(editing.id);
      onClose();
      showToast(`已刪除：${editing.note || getCategory(editing.categoryId).name} ${formatMoney(editing.amount)}`);
    } catch (e) {
      setConfirmDelete(false);
      setError(e instanceof Error ? e.message : '刪除失敗，請再試一次');
    }
  };

  const header = editing
    ? <SheetHeader id="entry-title" title="編輯交易" en="Edit" onClose={onClose} />
    : <SheetHeader id="entry-title" title="記一筆" en="New entry" onClose={onClose} />;

  if (editing?.splitExpenseId || editing?.splitSettlementId) {
    return <SheetBody last className="gap-[18px]">{header}<SplitLinkedNotice t={editing} onClose={onClose} /></SheetBody>;
  }

  if (!isPending && payable.length === 0) {
    return (
      <SheetBody last className="gap-[18px]">
        {header}
        <EmptyBox title="先新增一個帳戶">記帳時要選錢從哪裡出去，例如現金、銀行或信用卡。</EmptyBox>
        <button type="button" data-autofocus onClick={() => openSheet({ kind: 'account' })} className="btn-primary press w-full">
          新增帳戶
        </button>
      </SheetBody>
    );
  }

  if (splitOn) {
    return (
      <SheetBody last className="gap-[18px]">
        {header}
        <SplitSwitch on onChange={toggleSplit} trip={trip?.name} />
        <SplitEntryPanel initial={{ amount: value ? String(value) : '', title: note, categoryId, date, receipt: photo.blob }} onDone={onClose} defaultGroupId={trip?.id} />
      </SheetBody>
    );
  }

  const accountChip = (which: 'source' | 'target', label: string, name: string) => (
    <button
      ref={which === 'source' ? sourceChip : targetChip}
      type="button"
      aria-expanded={picker === which}
      // 選項展開時才指過去（收起來時那個 id 不在畫面上）
      aria-controls={picker === which ? `entry-${which}` : undefined}
      onClick={() => openPicker(picker === which ? null : which)}
      className="pill press max-w-full"
    >
      <span className="caption flex-none">{label}</span>
      <span className="min-w-0 truncate">{name}</span>
      <ChevronDown size={16} strokeWidth={2} aria-hidden className={`flex-none transition-transform duration-[var(--dur-press)] ${picker === which ? 'rotate-180' : ''}`} />
    </button>
  );

  return (
    <>
      <SheetBody className="gap-3.5">
        {header}

        {/* 類型和 AI 入口同一列；AI 收音、整理中的卡片會排到下一行 */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-3">
          <div role="group" aria-label="類型" className="flex flex-none gap-2">
            {TYPES.map(([id, label]) => (
              <button key={id} type="button" aria-pressed={type === id} onClick={() => switchType(id)} className="pill press">{label}</button>
            ))}
          </div>
          {!editing && <AiEntryBar compact accounts={usable} onDraft={applyDraft} onPhoto={photo.attach} />}
        </div>

        {/* 金額和品項在同一張卡：打完金額，品項就在正下方 */}
        <div className="flex flex-col rounded-lg border-[2.5px] border-ink bg-surface shadow-[var(--pop-sm)]">
          <AmountDisplay expr={amount} value={value} hint={amountHint(amount)} />
          {/* 打品項時：虛線變藍色實線、筆變藍色（不用全站的藍色外框，那個方框會壓到上面的虛線和下面的提示） */}
          <div className="group mx-4 flex items-center gap-2 border-t-2 border-dashed border-line focus-within:border-solid focus-within:border-blue">
            <PenLine size={18} strokeWidth={1.5} aria-hidden className="flex-none text-muted group-focus-within:text-blue" />
            <label className="sr-only" htmlFor="entry-note">品項或備註</label>
            <input
              id="entry-note"
              value={note}
              onChange={(e) => { setNote(e.target.value); setTypedNote(true); }}
              // 按完成收起手機鍵盤，回到下面的數字鍵盤；注音、倉頡按 Enter 選字時不算（還在組字）
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) e.currentTarget.blur(); }}
              enterKeyHint="done"
              maxLength={100}
              placeholder="品項或備註（選填）"
              autoComplete="off"
              className="h-12 min-w-0 flex-1 bg-transparent text-[16px] outline-none"
            />
          </div>
          {suggestions.length > 0 && (
            // 右邊不留白：捲動範圍接到卡片邊框，按鈕滑出去時是消失在邊框下，不會在卡片中間被切一半
            <div className="flex items-center gap-2.5 pb-3 pl-4">
              <span aria-hidden className="caption flex-none">{note.trim() ? '符合' : '常用'}</span>
              <div role="group" aria-label={note.trim() ? '符合的品項' : '最近常用'} className="pills mr-0 min-w-0 flex-1 pr-4">
                {suggestions.map((t) => (
                  <button key={t.id} type="button" onClick={() => applySuggestion(t)} className="pill press">
                    {t.note} <span className="num">{formatMoney(t.amount)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {type !== 'TRANSFER' && (
          <PillRow
            label="分類"
            items={categoriesFor(type, categoryId).map((c) => ({ id: c.id, label: c.name, Icon: c.icon, color: c.color }))}
            current={categoryId}
            onPick={setCategoryId}
          />
        )}

        {/* 帳戶、分帳、日期、更多：收成一列小按鈕。一行放不下時會換行，分帳排在日期前面，第一行就看得到（日期通常是今天，比較少改） */}
        <div className="flex flex-wrap items-center gap-2">
          {accountChip('source', sourceLabel, nameOf(sourceId) ?? '選擇帳戶')}
          {type === 'TRANSFER' && accountChip('target', '轉入', nameOf(target) ?? '請選擇')}
          {/* 分帳的小開關放在這裡，不收進「更多」才看得到：旅程期間（關掉了「記到旅程」）是記到旅程，平常是跟朋友分 */}
          {!editing && type === 'EXPENSE' && (
            <button type="button" role="switch" aria-checked={false} data-split-switch onClick={() => toggleSplit(true)} aria-label={trip ? `記到旅程・${trip.name}` : undefined} className="pill press">
              {trip ? <Plane size={16} strokeWidth={2} aria-hidden /> : <Users size={16} strokeWidth={2} aria-hidden />}{trip ? '記到旅程' : '分帳'}
            </button>
          )}
          <label className="sr-only" htmlFor="entry-date">日期</label>
          <input id="entry-date" type="date" value={date} max={toISODate(new Date())} onChange={(e) => setDate(e.target.value || toISODate(new Date()))} className="field-input h-11 w-[150px] px-3" />
          {!editing && (
            <button type="button" aria-expanded={moreOpen} aria-controls={moreOpen ? 'entry-more' : undefined} onClick={toggleMore} className="pill press">
              更多{moreSummary && <span className="caption">・{moreSummary}</span>}
              <ChevronDown size={16} strokeWidth={2} aria-hidden className={`transition-transform duration-[var(--dur-press)] ${moreOpen ? 'rotate-180' : ''}`} />
            </button>
          )}
        </div>

        {picker === 'source' && (
          <PillRow id="entry-source" label={`${sourceLabel}帳戶`} items={payable.map((a) => ({ id: a.id, label: a.name }))} current={sourceId} onPick={pickSource} />
        )}
        {picker === 'target' && (targets.length
          ? <PillRow id="entry-target" label="轉入帳戶" items={targets.map((a) => ({ id: a.id, label: a.name }))} current={target} onPick={pickTarget} />
          : <p id="entry-target" className="text-body-s text-muted">需要至少兩個帳戶才能轉帳。</p>)}
        {type === 'TRANSFER' && <p className="caption -mt-1.5">轉帳不算進支出</p>}

        {!editing && moreOpen && (
          <div id="entry-more" className="flex flex-col gap-3">
            <ReceiptField draft={photo} />
            <SwitchRow
              title="設成固定收支"
              hint={repeat
                ? `${describe(scheduleFrom(repeatFreq, date))}，下次 ${shortDue(after(scheduleFrom(repeatFreq, date), date))}`
                : '房租、訂閱這種每期一樣的，之後幫你記或到時候問你'}
              checked={repeat}
              onChange={setRepeat}
            />
            {repeat && (
              <div className="flex flex-col gap-2.5">
                <PillRow label="多久一次" items={[{ id: 'monthly', label: '每月' }, { id: 'weekly', label: '每週' }, { id: 'yearly', label: '每年' }]} current={repeatFreq} onPick={(v) => setRepeatFreq(v as Frequency)} />
                <PillRow label="到了日子" items={[{ id: 'ask', label: '到時候問我' }, { id: 'auto', label: '自動記下' }]} current={repeatAuto ? 'auto' : 'ask'} onPick={(v) => setRepeatAuto(v === 'auto')} />
              </div>
            )}
          </div>
        )}

        {editing && <ReceiptField draft={photo} />}

        {editing && (confirmDelete ? (
          <div role="alertdialog" aria-labelledby="delete-question" className="flex flex-col gap-3 rounded-sm bg-alert-tint p-4">
            <p id="delete-question" className="text-body-s text-alert">確定要刪除「{title}」嗎？刪除後無法復原。</p>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setConfirmDelete(false)} className="btn-secondary press" autoFocus>取消</button>
              <button type="button" onClick={destroy} disabled={busy} className="btn-secondary press border-alert text-alert">
                {remove.isPending ? '刪除中…' : '刪除'}
              </button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => setConfirmDelete(true)} disabled={busy} className="btn-secondary press w-full text-alert">
            <Trash2 size={16} strokeWidth={1.5} aria-hidden />刪除這筆交易
          </button>
        ))}
      </SheetBody>

      {/* 固定在底部：上面怎麼捲，鍵盤和「記下」都按得到 */}
      <SheetFooter>
        <AmountPad onKey={press} onEquals={equals} />
        {error && <p role="alert" className="text-caption text-alert">{error}</p>}
        <button type="button" onClick={save} disabled={!value || busy} className="btn-primary press min-h-12 w-full">
          {uploading ? '上傳照片中…' : saving ? '儲存中…' : editing ? '儲存變更' : `記下${value ? ` ${formatMoney(value)}` : ''}`}
        </button>
      </SheetFooter>
    </>
  );
}
