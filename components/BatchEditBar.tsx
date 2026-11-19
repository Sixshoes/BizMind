import React, { useState } from 'react';
import {
  CheckSquare,
  Tag,
  Globe,
  FolderKanban,
  ClipboardCheck,
  X,
  Check,
  Plus,
} from 'lucide-react';
import { STANDARD_COUNTRY_OPTIONS } from '../utils/countries';

interface BatchEditBarProps {
  selectedCount: number;
  existingTags: string[];
  existingSources: string[];
  onBatchUpdateCategory: (category: 'employer' | 'academic' | 'staff' | 'other') => Promise<void>;
  onBatchUpdateCountry: (country: string) => Promise<void>;
  onBatchUpdateSource: (source: string) => Promise<void>;
  onBatchAddTag: (tag: string) => Promise<void>;
  onOpenQsModal: () => void;
  onClearSelection: () => void;
}

export const BatchEditBar: React.FC<BatchEditBarProps> = ({
  selectedCount,
  existingTags,
  existingSources,
  onBatchUpdateCategory,
  onBatchUpdateCountry,
  onBatchUpdateSource,
  onBatchAddTag,
  onOpenQsModal,
  onClearSelection,
}) => {
  const [activePopover, setActivePopover] = useState<
    'category' | 'country' | 'source' | 'tag' | null
  >(null);
  const [countryInput, setCountryInput] = useState('');
  const [sourceInput, setSourceInput] = useState('');
  const [tagInput, setTagInput] = useState('');

  if (selectedCount === 0) return null;

  const togglePopover = (panel: 'category' | 'country' | 'source' | 'tag') => {
    setActivePopover((prev) => (prev === panel ? null : panel));
  };

  return (
    <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40 max-w-[95vw] animate-slideUp">
      {/* Active Popover Panel */}
      {activePopover && (
        <div className="mb-2.5 bg-white rounded-xl border border-slate-200 shadow-xl p-4 w-88 sm:w-[420px] mx-auto">
          {activePopover === 'category' && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-slate-800">
                  批次設定 {selectedCount} 筆名片的聯絡人分類
                </span>
                <button
                  type="button"
                  onClick={() => setActivePopover(null)}
                  className="text-slate-500 hover:text-slate-800 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'employer', label: '企業夥伴 (Business)' },
                  { id: 'academic', label: '學研專家 (Academic)' },
                  { id: 'staff', label: '機關社團 (Organization)' },
                  { id: 'other', label: '一般聯絡人 (General)' },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={async () => {
                      await onBatchUpdateCategory(opt.id as any);
                      setActivePopover(null);
                    }}
                    className="px-3 py-2.5 rounded-lg text-sm font-semibold text-left bg-slate-50 hover:bg-indigo-50 hover:text-indigo-700 border border-slate-200 hover:border-indigo-300 transition-colors cursor-pointer"
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {activePopover === 'country' && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-slate-800">批次設定標準國家 / 地區</span>
                <button
                  type="button"
                  onClick={() => setActivePopover(null)}
                  className="text-slate-500 hover:text-slate-800 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  list="batch-country-options"
                  value={countryInput}
                  onChange={(e) => setCountryInput(e.target.value)}
                  placeholder="輸入或選擇國家 (例如 Taiwan SAR)"
                  className="flex-1 px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:border-indigo-600 focus:outline-none"
                />
                <datalist id="batch-country-options">
                  {STANDARD_COUNTRY_OPTIONS.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </datalist>
                <button
                  type="button"
                  disabled={!countryInput.trim()}
                  onClick={async () => {
                    if (!countryInput.trim()) return;
                    await onBatchUpdateCountry(countryInput.trim());
                    setCountryInput('');
                    setActivePopover(null);
                  }}
                  className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold flex items-center gap-1 cursor-pointer shrink-0 whitespace-nowrap"
                >
                  <Check className="w-4 h-4" />
                  <span>套用</span>
                </button>
              </div>
            </div>
          )}

          {activePopover === 'source' && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-slate-800">
                  批次設定活動 / 展會來源 (Source)
                </span>
                <button
                  type="button"
                  onClick={() => setActivePopover(null)}
                  className="text-slate-500 hover:text-slate-800 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  list="batch-source-options"
                  value={sourceInput}
                  onChange={(e) => setSourceInput(e.target.value)}
                  placeholder="例如：2026 亞太永續與創新論壇"
                  className="flex-1 px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:border-indigo-600 focus:outline-none"
                />
                <datalist id="batch-source-options">
                  {existingSources.map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
                <button
                  type="button"
                  disabled={!sourceInput.trim()}
                  onClick={async () => {
                    if (!sourceInput.trim()) return;
                    await onBatchUpdateSource(sourceInput.trim());
                    setSourceInput('');
                    setActivePopover(null);
                  }}
                  className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold flex items-center gap-1 cursor-pointer shrink-0 whitespace-nowrap"
                >
                  <Check className="w-4 h-4" />
                  <span>套用</span>
                </button>
              </div>
            </div>
          )}

          {activePopover === 'tag' && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-slate-800">批次新增自訂標籤 (Tags)</span>
                <button
                  type="button"
                  onClick={() => setActivePopover(null)}
                  className="text-slate-500 hover:text-slate-800 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={async (e) => {
                    if (e.key === 'Enter' && tagInput.trim()) {
                      e.preventDefault();
                      await onBatchAddTag(tagInput.trim());
                      setTagInput('');
                      setActivePopover(null);
                    }
                  }}
                  placeholder="輸入新標籤或點選下方常用標籤"
                  className="flex-1 px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:border-indigo-600 focus:outline-none"
                />
                <button
                  type="button"
                  disabled={!tagInput.trim()}
                  onClick={async () => {
                    if (!tagInput.trim()) return;
                    await onBatchAddTag(tagInput.trim());
                    setTagInput('');
                    setActivePopover(null);
                  }}
                  className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold flex items-center gap-1 cursor-pointer shrink-0 whitespace-nowrap"
                >
                  <Plus className="w-4 h-4" />
                  <span>加入</span>
                </button>
              </div>
              {existingTags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {existingTags.slice(0, 8).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={async () => {
                        await onBatchAddTag(t);
                        setActivePopover(null);
                      }}
                      className="px-2.5 py-1 rounded-md text-xs font-medium bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 transition-colors cursor-pointer"
                    >
                      + {t}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Main Floating Bar */}
      <div className="bg-slate-900 text-white px-4 py-3 rounded-xl shadow-xl border border-slate-800 flex items-center gap-2.5 sm:gap-3 flex-wrap justify-center">
        <div className="flex items-center gap-2 pr-2.5 border-r border-slate-700">
          <CheckSquare className="w-4 h-4 text-indigo-400 shrink-0" />
          <span className="text-sm font-semibold whitespace-nowrap tabular-nums">
            已選取 {selectedCount} 筆
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => togglePopover('category')}
            className={`px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
              activePopover === 'category'
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-100'
            }`}
          >
            <FolderKanban className="w-4 h-4" />
            <span>批次分類</span>
          </button>

          <button
            type="button"
            onClick={() => togglePopover('country')}
            className={`px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
              activePopover === 'country'
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-100'
            }`}
          >
            <Globe className="w-4 h-4" />
            <span>設國家</span>
          </button>

          <button
            type="button"
            onClick={() => togglePopover('source')}
            className={`px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
              activePopover === 'source'
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-100'
            }`}
          >
            <FolderKanban className="w-4 h-4" />
            <span>設活動來源</span>
          </button>

          <button
            type="button"
            onClick={() => togglePopover('tag')}
            className={`px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
              activePopover === 'tag'
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-100'
            }`}
          >
            <Tag className="w-4 h-4" />
            <span>加標籤</span>
          </button>

          <button
            type="button"
            onClick={onOpenQsModal}
            className="px-3.5 py-2 rounded-lg text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
          >
            <ClipboardCheck className="w-4 h-4" />
            <span>名單檢查與匯出</span>
          </button>
        </div>

        <button
          type="button"
          onClick={onClearSelection}
          className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          title="取消全部選取"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
