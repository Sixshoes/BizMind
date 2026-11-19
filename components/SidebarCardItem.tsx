import React from 'react';
import { Cloud, CheckCircle2, HardDrive, Trash2, FlipHorizontal2 } from 'lucide-react';
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
  employer: 'text-blue-700',
  academic: 'text-amber-700',
  staff: 'text-emerald-700',
  other: 'text-slate-600',
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
        className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-colors border select-none ${
          isSelected
            ? 'bg-indigo-50/75 border-indigo-500 ring-1 ring-indigo-500/20'
            : isQsChecked
            ? 'bg-indigo-50/40 border-indigo-300'
            : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/80'
        }`}
      >
        {/* Checkbox for Multi-Select / QS */}
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

        {/* Thumbnail */}
        <CardThumbnail card={card} size="md" className="rounded-md" />

        {/* Metadata */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-[15px] font-bold text-slate-900 truncate leading-snug">
              {displayName}
            </span>
            {card.backImageUrl && (
              <span title="含雙面名片影像" className="text-slate-500 shrink-0">
                <FlipHorizontal2 className="w-3.5 h-3.5" />
              </span>
            )}
            {isDuplicate && (
              <span className="text-xs font-bold text-amber-700 shrink-0">· 重複</span>
            )}
          </div>

          <div className="text-[13px] text-slate-600 truncate flex items-center gap-1.5 mt-0.5 leading-snug">
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
                <span className="truncate text-slate-600 shrink-0 max-w-[96px]">
                  {normalizedCountry}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Sync Status & Delete Action */}
        <div className="flex items-center gap-1 shrink-0">
          <span
            className="w-7 h-7 flex items-center justify-center"
            title={
              card.syncStatus === 'firebase'
                ? '已同步至個人雲端'
                : '儲存在本機瀏覽器'
            }
          >
            {card.syncStatus === 'firebase' ? (
              <Cloud className="w-4 h-4 text-sky-600" />
            ) : (
              <HardDrive className="w-4 h-4 text-slate-400" />
            )}
          </span>

          <button
            type="button"
            onClick={(e) => onDelete(e, card.id)}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-500 hover:bg-rose-50 hover:text-rose-600 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity cursor-pointer"
            title="刪除名片"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }
);

SidebarCardItem.displayName = 'SidebarCardItem';
