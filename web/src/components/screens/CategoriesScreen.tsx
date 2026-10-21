'use client';

import { ArrowDown, ArrowUp, ChevronLeft, Eye, EyeOff, Plus, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  BUILT_IN, ICON_LABELS, ICONS, MAX_CATEGORY_NAME, newCategoryId, useCategories, type Category, type ManagedType,
} from '@/lib/categories';
import { fetchCategoryUsage, useDeleteCategory, useSaveCategories } from '@/lib/data';
import { useUi } from '@/lib/ui-store';
import { Sheet, SheetHeader } from '../Sheet';
import { Field, Pills } from '../split/parts';

const TYPES: { id: ManagedType; label: string }[] = [{ id: 'EXPENSE', label: '支出' }, { id: 'INCOME', label: '收入' }];
const TYPE_NAME: Record<ManagedType, string> = { EXPENSE: '支出', INCOME: '收入' };

/** 打開的面板：新增（category 是 undefined）或編輯某個分類 */
type Editing = { category?: Category };

/** 我的 → 分類管理：新增、改名換圖示、隱藏、排序；自己加的可以刪（帳先移到別的分類） */
export function CategoriesScreen() {
  const router = useRouter();
  const list = useCategories();
  const save = useSaveCategories();
  const showToast = useUi((s) => s.showToast);
  const [type, setType] = useState<ManagedType>('EXPENSE');
  const [editing, setEditing] = useState<Editing | null>(null);

  const ofType = list.filter((c) => c.type === type);
  const shown = ofType.filter((c) => !c.hidden);
  const hidden = ofType.filter((c) => c.hidden);

  const back = () => (window.history.length > 1 ? router.back() : router.push('/settings'));

  /** 存這一類的整份清單（沒隱藏的在前、隱藏的在後） */
  const persist = async (next: Category[], message?: string) => {
    try {
      await save.mutateAsync({ type, list: next });
      if (message) showToast(message);
    } catch (e) {
      showToast(e instanceof Error ? e.message : '儲存失敗，請再試一次');
    }
  };

  const move = (index: number, delta: number) => {
    const next = [...shown];
    [next[index], next[index + delta]] = [next[index + delta], next[index]];
    void persist([...next, ...hidden]);
  };

  const unhide = (c: Category) => {
    void persist([...shown, { ...c, hidden: false }, ...hidden.filter((x) => x.id !== c.id)], `「${c.name}」重新出現在記一筆`);
  };

  return (
    <>
      <header className="flex min-h-12 items-center gap-1">
        <button type="button" onClick={back} aria-label="返回" className="icon-btn ghost press">
          <ChevronLeft size={20} strokeWidth={1.5} aria-hidden />
        </button>
        <h1 className="h-page">分類管理<span className="en">Categories</span></h1>
      </header>

      <Pills items={TYPES} value={type} onPick={setType} label="支出或收入" />
      <p className="caption -mt-2 px-1 leading-[1.8]">記一筆時照這個順序顯示。點分類可以改名、換圖示或隱藏；轉帳的分類固定不能改。</p>

      <ul className="card py-1" aria-label={`${TYPE_NAME[type]}分類`}>
        {shown.map((c, i) => {
          const Icon = c.icon;
          return (
            <li key={c.id} className="flex items-center gap-1 border-t border-line pr-2 first:border-t-0">
              <button type="button" onClick={() => setEditing({ category: c })} aria-haspopup="dialog" className="row press min-w-0 flex-1">
                <span aria-hidden className="ico"><Icon size={20} strokeWidth={1.5} /></span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-body">{c.name}</span>
                  {!c.builtIn && <span className="caption">自己加的</span>}
                </span>
              </button>
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`把「${c.name}」往前移`} className="icon-btn ghost press disabled:opacity-30">
                <ArrowUp size={18} strokeWidth={1.5} aria-hidden />
              </button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === shown.length - 1} aria-label={`把「${c.name}」往後移`} className="icon-btn ghost press disabled:opacity-30">
                <ArrowDown size={18} strokeWidth={1.5} aria-hidden />
              </button>
            </li>
          );
        })}
      </ul>

      <button
        type="button"
        onClick={() => setEditing({})}
        aria-haspopup="dialog"
        className="press -mt-2 flex min-h-[52px] items-center justify-center gap-2 rounded-lg border border-dashed border-dash text-body-s tracking-[.08em]"
      >
        <Plus size={18} strokeWidth={1.5} aria-hidden />新增{TYPE_NAME[type]}分類
      </button>

      {hidden.length > 0 && (
        <section aria-labelledby="hidden-title" className="flex flex-col gap-2">
          <h2 id="hidden-title" className="px-1 text-body-s font-normal tracking-[.1em] text-muted">已隱藏（{hidden.length}）</h2>
          <ul className="card py-1">
            {hidden.map((c) => {
              const Icon = c.icon;
              return (
                <li key={c.id} className="flex items-center gap-2 border-t border-line pr-4 first:border-t-0">
                  <button type="button" onClick={() => setEditing({ category: c })} aria-haspopup="dialog" className="row press min-w-0 flex-1 text-muted">
                    <span aria-hidden className="ico"><Icon size={20} strokeWidth={1.5} /></span>
                    <span className="truncate text-body">{c.name}</span>
                  </button>
                  <button type="button" onClick={() => unhide(c)} className="btn-secondary press flex-none">
                    <Eye size={16} strokeWidth={1.5} aria-hidden />顯示
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="caption px-1 leading-[1.8]">隱藏的分類記一筆時不會出現；以前記在這些分類的帳都還在，報表照樣算。</p>
        </section>
      )}

      <Sheet open={editing !== null} onClose={() => setEditing(null)} labelledBy="category-title">
        {editing && (
          <CategoryForm
            key={editing.category?.id ?? `new-${type}`}
            type={type}
            category={editing.category}
            all={ofType}
            onClose={() => setEditing(null)}
            onSave={persist}
          />
        )}
      </Sheet>
    </>
  );
}

function CategoryForm({ type, category, all, onClose, onSave }: {
  type: ManagedType;
  category?: Category;
  /** 這一類的全部分類（含隱藏的），照現在的順序 */
  all: Category[];
  onClose: () => void;
  onSave: (next: Category[], message?: string) => Promise<void>;
}) {
  const remove = useDeleteCategory();
  const [name, setName] = useState(category?.name ?? '');
  const [iconKey, setIconKey] = useState(category?.iconKey ?? (type === 'INCOME' ? 'coins' : 'sparkles'));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  // 刪除：先查有幾筆帳用到，有的話要選移到哪個分類
  const [usage, setUsage] = useState<{ transactions: number; splitExpenses: number } | null>(null);
  const [moveTo, setMoveTo] = useState('');

  const shown = all.filter((c) => !c.hidden);
  const hidden = all.filter((c) => c.hidden);
  const original = category?.builtIn ? BUILT_IN.find((b) => b.id === category.id) : undefined;
  const changedFromDefault = original && (name.trim() !== original.name || iconKey !== original.iconKey);
  // 每一類至少要留一個看得到的分類，記一筆才有得選
  const lastShown = category && !category.hidden && shown.length === 1;
  const targets = all.filter((c) => c.id !== category?.id);

  const check = () => {
    const clean = name.trim();
    if (!clean) return '請輸入分類名稱';
    if (all.some((c) => c.id !== category?.id && c.name === clean)) return `已經有「${clean}」了`;
    return '';
  };

  const submit = async () => {
    const problem = check();
    if (problem) return setError(problem);
    const clean = name.trim();
    setBusy(true);
    if (category) {
      await onSave(all.map((c) => (c.id === category.id ? { ...c, name: clean, iconKey, icon: ICONS[iconKey] } : c)), `已儲存「${clean}」`);
    } else {
      const added: Category = { id: newCategoryId(), name: clean, type, icon: ICONS[iconKey], iconKey, hidden: false, builtIn: false };
      await onSave([...shown, added, ...hidden], `已新增「${clean}」`);
    }
    setBusy(false);
    onClose();
  };

  const toggleHidden = async () => {
    if (!category) return;
    setBusy(true);
    if (category.hidden) {
      await onSave([...shown, { ...category, hidden: false }, ...hidden.filter((c) => c.id !== category.id)], `「${category.name}」重新出現在記一筆`);
    } else {
      await onSave([...shown.filter((c) => c.id !== category.id), ...hidden, { ...category, hidden: true }], `已隱藏「${category.name}」，以前的帳都還在`);
    }
    setBusy(false);
    onClose();
  };

  const askDelete = async () => {
    if (!category) return;
    setError('');
    setBusy(true);
    try {
      setUsage(await fetchCategoryUsage(category.id));
      setMoveTo(shown.find((c) => c.id !== category.id)?.id ?? targets[0]?.id ?? '');
    } catch (e) {
      setError(e instanceof Error ? e.message : '讀取失敗，請再試一次');
    } finally {
      setBusy(false);
    }
  };

  const destroy = async () => {
    if (!category || !moveTo) return;
    try {
      await remove.mutateAsync({ id: category.id, moveTo });
      const used = usage && usage.transactions + usage.splitExpenses > 0;
      useUi.getState().showToast(`已刪除「${category.name}」${used ? `，帳都移到「${targets.find((c) => c.id === moveTo)?.name}」` : ''}`);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : '刪除失敗，請再試一次');
    }
  };

  const used = usage ? usage.transactions + usage.splitExpenses : 0;
  const usedText = usage ? [usage.transactions && `${usage.transactions} 筆交易`, usage.splitExpenses && `${usage.splitExpenses} 筆分帳花費`].filter(Boolean).join('、') : '';

  return (
    <>
      <SheetHeader
        id="category-title"
        title={category ? '編輯分類' : `新增${TYPE_NAME[type]}分類`}
        en="Category"
        sub={category?.hidden ? '這個分類已隱藏' : undefined}
        onClose={onClose}
      />

      <Field label="名稱" htmlFor="category-name">
        <input
          id="category-name"
          data-autofocus
          value={name}
          onChange={(e) => { setName(e.target.value); setError(''); }}
          maxLength={MAX_CATEGORY_NAME}
          placeholder={type === 'INCOME' ? '例如：兼職' : '例如：寵物'}
          autoComplete="off"
          className="field-input"
        />
      </Field>

      <Field label="圖示">
        <div role="group" aria-label="圖示" className="grid grid-cols-6 gap-1.5">
          {Object.entries(ICONS).map(([key, Icon]) => (
            <button
              key={key}
              type="button"
              aria-pressed={iconKey === key}
              aria-label={ICON_LABELS[key]}
              onClick={() => setIconKey(key)}
              className={`press flex h-11 items-center justify-center rounded-sm border ${iconKey === key ? 'border-primary bg-primary text-on-primary' : 'border-line bg-surface'}`}
            >
              <Icon size={20} strokeWidth={1.5} aria-hidden />
            </button>
          ))}
        </div>
      </Field>

      {changedFromDefault && (
        <button type="button" onClick={() => { setName(original.name); setIconKey(original.iconKey); }} className="press -mt-2 self-start px-1 text-caption underline">
          改回原本的「{original.name}」和圖示
        </button>
      )}

      {error && <p role="alert" className="-my-2 text-caption text-alert">{error}</p>}

      <button type="button" onClick={submit} disabled={busy} className="btn-primary press w-full">
        {busy ? '儲存中…' : category ? '儲存' : '新增'}
      </button>

      {category && (
        <section aria-labelledby="category-manage" className="flex flex-col gap-2 border-t border-line pt-4">
          <h3 id="category-manage" className="caption">管理</h3>
          <button type="button" onClick={toggleHidden} disabled={busy || Boolean(lastShown)} className="btn-secondary press w-full">
            {category.hidden
              ? <><Eye size={16} strokeWidth={1.5} aria-hidden />重新顯示</>
              : <><EyeOff size={16} strokeWidth={1.5} aria-hidden />隱藏這個分類</>}
          </button>
          <p className="caption px-1 leading-[1.8]">
            {lastShown ? `至少要留一個${TYPE_NAME[type]}分類，這個不能隱藏。` : '隱藏後記一筆不會出現；以前記在這個分類的帳都還在，報表照樣算，隨時可以拿回來。'}
          </p>

          {!category.builtIn && (usage ? (
            <div role="alertdialog" aria-labelledby="category-del-q" className="flex flex-col gap-3 rounded-sm bg-alert-tint p-4">
              <p id="category-del-q" className="text-body-s leading-[1.8] text-alert">
                {used ? `有 ${usedText}用到「${category.name}」，刪除前要移到哪個分類？` : `「${category.name}」還沒有任何帳，確定刪除？`}
              </p>
              {used > 0 && (
                <Pills items={targets.map((c) => ({ id: c.id, label: c.hidden ? `${c.name}（已隱藏）` : c.name }))} value={moveTo} onPick={setMoveTo} label="移到哪個分類" wrap />
              )}
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setUsage(null)} className="btn-secondary press" autoFocus>取消</button>
                <button type="button" onClick={destroy} disabled={remove.isPending || !moveTo} className="btn-secondary press border-alert text-alert">
                  {remove.isPending ? '刪除中…' : used ? '移過去並刪除' : '刪除'}
                </button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={askDelete} disabled={busy} className="btn-secondary press w-full text-alert">
              <Trash2 size={16} strokeWidth={1.5} aria-hidden />刪除這個分類
            </button>
          ))}
          {category.builtIn && <p className="caption px-1 leading-[1.8]">內建的分類不能刪除，不用的話可以隱藏。</p>}
        </section>
      )}
    </>
  );
}
