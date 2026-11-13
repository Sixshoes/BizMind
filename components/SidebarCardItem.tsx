import React from 'react';
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

export const SidebarCardItem: React.FC<SidebarCardItemProps> = React.memo(({
  card,
  isSelected,
  isQsChecked,
  isDuplicate,
  onSelect,
  onToggleQs,
  onDelete
}) => {
  const displayName = (card.firstName || card.lastName)
    ? `${card.lastName || ''} ${card.firstName || ''}`.trim()
    : (card.company || '未命名名片');

  const displaySubtitle = (card.firstName || card.lastName)
    ? (card.company || card.title || '個人聯絡人')
    : (card.title || '');

  const countryText = card.country || card.translations?.country;

  const syncDotClass =
    card.syncStatus === 'notion'
      ? 'bg-emerald-500'
      : card.syncStatus === 'firebase'
      ? 'bg-sky-500'
      : 'bg-amber-400';

  const syncTitle =
    card.syncStatus === 'notion'
      ? '已同步至 Notion'
      : card.syncStatus === 'firebase'
      ? '圖片已雲端備份（尚未寫入 Notion）'
      : '僅儲存於本機瀏覽器';

  return (
    <div
      id={`card-list-item-${card.id}`}
      onClick={() => onSelect(card.id)}
      className={`group flex items-center gap-2.5 px-2.5 py-2 rounded-xl cursor-pointer transition-all border relative select-none ${
        isSelected
          ? 'bg-indigo-50/50 border-indigo-400 shadow-xs ring-1 ring-indigo-500/15'
          : isQsChecked
          ? 'bg-indigo-50/25 border-indigo-200'
          : 'bg-white border-slate-200/80 hover:border-slate-300 hover:bg-slate-50/60'
      }`}
    >
      {/* QS Checkbox */}
      <div
        className="flex items-center justify-center shrink-0 z-10 p-1 -m-1"
        onClick={(e) => {
          e.stopPropagation();
          onToggleQs(card.id);
        }}
      >
        <input
          type="checkbox"
          checked={isQsChecked}
          onChange={() => onToggleQs(card.id)}
          className="w-3.5 h-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer accent-indigo-600"
          title="勾選至 QS 匯出名單"
        />
      </div>

      {/* Thumbnail */}
      <CardThumbnail card={card} size="md" />

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-sm font-semibold text-slate-800 truncate">{displayName}</span>
          <span
            className={`w-1.5 h-1.5 rounded-full shrink-0 ${syncDotClass}`}
            title={syncTitle}
          />
          {isDuplicate && (
            <span className="text-[10px] px-1.5 py-0.2 rounded-md font-semibold whitespace-nowrap bg-rose-50 text-rose-600 border border-rose-200/70 shrink-0">
              重複
            </span>
          )}
        </div>

        <div className="text-xs text-slate-500 truncate flex items-center gap-1.5 mt-0.5">
          {displaySubtitle && <span className="truncate">{displaySubtitle}</span>}
          <span className={`text-[10px] px-1.5 py-0.2 rounded font-semibold shrink-0 border ${
            card.category === 'academic' ? 'bg-amber-50 text-amber-700 border-amber-200/80' :
            card.category === 'staff' ? 'bg-emerald-50 text-emerald-700 border-emerald-200/80' :
            card.category === 'other' ? 'bg-slate-100 text-slate-600 border-slate-200/80' :
            'bg-blue-50 text-blue-700 border-blue-200/80'
          }`}>
            {card.category === 'employer' ? '雇主' : card.category === 'academic' ? '學者' : card.category === 'staff' ? '職員' : '非QS'}
          </span>
          {countryText && (
            <span className="text-[10px] text-slate-500 bg-slate-100/80 px-1.5 py-0.2 rounded shrink-0 truncate max-w-[84px]">
              {normalizeCountry(countryText)}
            </span>
          )}
        </div>
      </div>

      {/* Delete Button */}
      <button
        type="button"
        onClick={(e) => onDelete(e, card.id)}
        className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 opacity-80 md:opacity-0 group-hover:opacity-100 transition-all z-10 shrink-0 cursor-pointer"
        title="刪除名片"
      >
        <i className="fa-regular fa-trash-can text-xs"></i>
      </button>
    </div>
  );
});

SidebarCardItem.displayName = 'SidebarCardItem';
