import React from 'react';
import { Cloud, HardDrive, Trash2, FlipHorizontal2 } from 'lucide-react';
import { BusinessCardData } from '../types';
import { CardThumbnail } from './CardThumbnail';
import { normalizeCountry } from '../utils/countries';

interface SidebarCardItemProps {
  card: BusinessCardData;
  isSelected: boolean;
  isQsChecked: boolean;
  isDuplicate: boolean;
  onSelect: (id: string) => void;
  onToggleQs: (id: string) => void;
  onDelete: (e: React.MouseEvent, id: string) => void;
}

const CATEGORY_LABEL: Record<BusinessCardData['category'], string> = {
  employer: '企業夥伴',
  academic: '學研專家',
  staff: '機關社團',
  other: '一般',
};

const CATEGORY_TEXT_CLS: Record<BusinessCardData['category'], string> = {
  employer: 'text-blue-700 dark:text-blue-400',
  academic: 'text-amber-700 dark:text-amber-400',
  staff: 'text-emerald-700 dark:text-emerald-400',
  other: 'text-slate-500 dark:text-slate-400',
};

export const SidebarCardItem: React.FC<SidebarCardItemProps> = React.memo(
  ({ card, isSelected, isQsChecked, isDuplicate, onSelect, onToggleQs, onDelete }) => {
    const displayName =
      card.firstName || card.lastName
        ? `${card.firstName || ''} ${card.lastName || ''}`.trim()
        : card.company || '未知名片';

    const companyOrTitle =
      card.firstName || card.lastName
        ? card.company || card.title || '個人聯絡人'
        : card.title || '未填寫職稱';

    const countryText = card.country || card.translations?.country;
    const normalizedCountry = countryText ? normalizeCountry(countryText) : '';

    return (
      <div
        id={`card-list-item-${card.id}`}
        onClick={() => onSelect(card.id)}
        className={`group relative flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all border select-none ${
          isSelected
            ? 'bg-indigo-50/85 dark:bg-indigo-950/50 border-indigo-500 dark:border-indigo-500 ring-1 ring-indigo-500/20 shadow-2xs'
            : isQsChecked
            ? 'bg-indigo-50/40 dark:bg-indigo-950/25 border-indigo-300 dark:border-indigo-800'
            : 'bg-white dark:bg-slate-900 border-slate-200/90 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50/80 dark:hover:bg-slate-800/60'
        }`}
      >
        {/* Checkbox for Multi-Select */}
        <div
          className="flex items-center justify-center shrink-0 p-1.5 -m-1.5"
          onClick={(e) => {
            e.stopPropagation();
            onToggleQs(card.id);
          }}
        >
          <input
            type="checkbox"
            checked={isQsChecked}
            onChange={() => onToggleQs(card.id)}
            className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer accent-indigo-600"
            title="勾選名片進行批次編輯或匯出"
          />
        </div>

        {/* Authentic 1.6:1 Card Thumbnail */}
        <CardThumbnail card={card} size="sm" />

        {/* Metadata */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-[14.5px] font-bold text-slate-900 dark:text-slate-100 truncate leading-snug">
              {displayName}
            </span>
            {card.backImageUrl && (
              <span title="含雙面名片影像" className="text-indigo-500 dark:text-indigo-400 shrink-0">
                <FlipHorizontal2 className="w-3.5 h-3.5" />
              </span>
            )}
            {isDuplicate && (
              <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400 shrink-0">
                · 重複
              </span>
            )}
          </div>

          <div className="text-xs text-slate-600 dark:text-slate-400 truncate flex items-center gap-1.5 mt-0.5 leading-snug">
            <span
              className={`font-semibold shrink-0 ${CATEGORY_TEXT_CLS[card.category || 'employer']}`}
            >
              {CATEGORY_LABEL[card.category || 'employer']}
            </span>
            <span className="text-slate-400">·</span>
            <span className="truncate">{companyOrTitle}</span>
            {normalizedCountry && (
              <>
                <span className="text-slate-400 shrink-0">·</span>
                <span className="truncate text-slate-500 dark:text-slate-400 shrink-0 max-w-[84px]">
                  {normalizedCountry}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Sync Status & Delete Action */}
        <div className="flex items-center gap-0.5 shrink-0">
          <span
            className="w-6 h-6 flex items-center justify-center"
            title={
              card.syncStatus === 'firebase' ? '已同步至個人雲端' : '儲存在本機瀏覽器'
            }
          >
            {card.syncStatus === 'firebase' ? (
              <Cloud className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
            ) : (
              <HardDrive className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
            )}
          </span>

          <button
            type="button"
            onClick={(e) => onDelete(e, card.id)}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 hover:text-rose-600 opacity-0 group-hover:opacity-100 focus:opacity-100 touch-visible transition-opacity cursor-pointer"
            title="刪除名片"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }
);

SidebarCardItem.displayName = 'SidebarCardItem';
