'use client';

import { Plane, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useCreateSplitGroup, useSplitGroups } from '@/lib/data';
import { isSettled, parseMemberNames } from '@/lib/split';
import type { Transaction } from '@/lib/types';
import { useUi } from '@/lib/ui-store';
import { EmptyBox, SwitchRow } from '../ui';
import { Field } from './parts';
import { SplitExpenseForm, type SplitInitial } from './SplitExpenseForm';

/** 記一筆的「分帳」開關 */
export function SplitSwitch({ on, onChange, trip }: { on: boolean; onChange: (on: boolean) => void; trip?: string }) {
  return (
    <SwitchRow
      title={trip ? `記到旅程・${trip}` : '分帳'}
      hint={trip ? '旅程期間會自動記到這趟旅程；關掉就記成一般支出' : '跟朋友一起付的，只算你的部分'}
      checked={on}
      onChange={onChange}
      data-split-switch
    />
  );
}

/** 記一筆打開分帳後：選群組（或當場建一個），再用分帳表單記 */
export function SplitEntryPanel({ initial, onDone, defaultGroupId }: { initial: SplitInitial; onDone: () => void; defaultGroupId?: string }) {
  const { data: groups = [], isPending } = useSplitGroups();
  const create = useCreateSplitGroup();
  const showToast = useUi((s) => s.showToast);
  const openSheet = useUi((s) => s.openSheet);
  // 封存的不列出來（從封存的群組頁進來記的除外）
  const listed = groups.filter((g) => !g.archivedAt || g.id === defaultGroupId);
  const ordered = [...listed.filter((g) => !isSettled(g)), ...listed.filter(isSettled)];
  const [groupId, setGroupId] = useState<string | null>(defaultGroupId ?? null);
  // 選好群組後收成一行，騰出位置給金額；還沒選（自己打開分帳）時先展開讓使用者挑
  const [picking, setPicking] = useState(!defaultGroupId);
  const picker = useRef<HTMLDivElement>(null);
  const changeButton = useRef<HTMLButtonElement>(null);
  const wasPicking = useRef(picking);
  // 展開、收起時按的按鈕會消失，焦點移到選好的群組或「換群組」，鍵盤使用者才不會迷路（剛打開時不動焦點）
  useEffect(() => {
    if (wasPicking.current === picking) return;
    wasPicking.current = picking;
    if (picking) picker.current?.querySelector<HTMLElement>('[aria-pressed="true"]')?.focus();
    else changeButton.current?.focus();
  }, [picking]);
  const [quickOpen, setQuickOpen] = useState(false);
  const [names, setNames] = useState('');
  const [groupName, setGroupName] = useState('');
  const [error, setError] = useState('');

  const showQuick = quickOpen || (!isPending && listed.length === 0);
  const currentId = groupId ?? ordered[0]?.id ?? null;
  const g = groups.find((x) => x.id === currentId);
  const list = parseMemberNames(names);
  const defaultName = list.join('、').slice(0, 30);

  const createGroup = async () => {
    if (!list.length) return setError('請輸入至少一位朋友的名字');
    try {
      const id = await create.mutateAsync({
        name: groupName.trim() || defaultName, kind: 'daily', members: list,
        startDate: null, endDate: null, currency: 'TWD', budget: null, excludeFromBudget: false,
      });
      setGroupId(id);
      setQuickOpen(false);
      setPicking(false);
      setNames('');
      setGroupName('');
      setError('');
      showToast(`已建立「${groupName.trim() || defaultName}」，接著選誰付、怎麼分`);
    } catch (e) {
      setError(e instanceof Error ? e.message : '建立失敗，請再試一次');
    }
  };

  return (
    <>
      {!picking && !showQuick && g ? (
        <div className="flex min-h-14 items-center justify-between gap-3 rounded-lg bg-fill px-4 py-2">
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="caption">跟誰分</span>
            <span className="truncate text-body">{g.name}</span>
          </span>
          <button ref={changeButton} type="button" onClick={() => setPicking(true)} className="btn-secondary press flex-none">換群組</button>
        </div>
      ) : (
        <Field label="跟誰分（選群組）">
          <div ref={picker} role="group" aria-label="群組" className="pills flex-wrap">
            {ordered.map((x) => (
              <button key={x.id} type="button" aria-pressed={!showQuick && x.id === currentId} onClick={() => { setGroupId(x.id); setQuickOpen(false); setPicking(false); }} className="pill press">
                {x.name}
              </button>
            ))}
            <button type="button" aria-pressed={showQuick} onClick={() => setQuickOpen(true)} className="pill press">
              <Plus size={16} strokeWidth={1.5} aria-hidden />新群組
            </button>
            {/* 旅程要填日期、幣別，改開建立旅程的面板；建好會直接到旅程頁 */}
            <button type="button" onClick={() => openSheet({ kind: 'splitGroup', groupKind: 'trip' })} aria-haspopup="dialog" className="pill press">
              <Plane size={16} strokeWidth={1.5} aria-hidden />新旅程
            </button>
          </div>
        </Field>
      )}

      {showQuick ? (
        <div className="card flex flex-col gap-3 p-4">
          <Field label="朋友的名字（多個人用空白或逗號分開）" htmlFor="quick-names">
            <input
              id="quick-names"
              value={names}
              onChange={(e) => { setNames(e.target.value); setError(''); }}
              onKeyDown={(e) => { if (e.key === 'Enter') createGroup(); }}
              placeholder="例如：阿凱 小美"
              autoComplete="off"
              autoFocus={quickOpen}
              className="field-input"
            />
          </Field>
          <Field label="群組名稱（可不填）" htmlFor="quick-group-name">
            <input
              id="quick-group-name"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              maxLength={30}
              placeholder={`不填就叫「${defaultName || '朋友名字'}」`}
              autoComplete="off"
              className="field-input"
            />
          </Field>
          {error && <p role="alert" className="text-caption text-alert">{error}</p>}
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setQuickOpen(false)} disabled={!listed.length} className="btn-secondary press min-h-12">取消</button>
            <button type="button" onClick={createGroup} disabled={!list.length || create.isPending} className="btn-primary press min-h-12">
              {create.isPending ? '建立中…' : '建立並選取'}
            </button>
          </div>
          <p className="caption leading-[1.8]">只跟一個朋友分也一樣，輸入他的名字就好。朋友只要名字，不用帳號。</p>
        </div>
      ) : g ? (
        <SplitExpenseForm key={g.id} group={g} initial={initial} onSaved={(msg, again) => { showToast(msg); if (!again) onDone(); }} />
      ) : isPending ? (
        <div aria-busy="true" className="skeleton h-40" />
      ) : (
        <EmptyBox title="找不到這個群組">重新選一個，或建立新群組。</EmptyBox>
      )}
    </>
  );
}

/** 分帳產生的交易不能直接改，帶使用者到群組 */
export function SplitLinkedNotice({ t, onClose }: { t: Transaction; onClose: () => void }) {
  const router = useRouter();
  const { data: groups = [], isPending } = useSplitGroups();
  const g = groups.find((x) => x.expenses.some((e) => e.id === t.splitExpenseId) || x.settlements.some((s) => s.id === t.splitSettlementId));
  return (
    <>
      <p className="text-body-s leading-[1.8]">
        這筆是從分帳{g ? `「${g.name}」` : ''}自動產生的{t.splitSettlementId ? '還款' : '花費'}。請到群組裡修改，每個人的結算和你的帳才會一起更新。
      </p>
      <button
        type="button"
        data-autofocus
        disabled={!g}
        onClick={() => { if (!g) return; onClose(); router.push(`/split/${g.id}`); }}
        className="btn-primary press w-full"
      >
        {g ? '前往群組' : isPending ? '載入中…' : '找不到這個群組'}
      </button>
    </>
  );
}
