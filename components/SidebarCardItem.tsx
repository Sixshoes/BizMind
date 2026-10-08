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
    ? `${card.firstName || ''} ${card.lastName || ''}`.trim()
    : (card.company || '未知名片');

  const displaySubtitle = (card.firstName || card.lastName)
    ? (card.company || '個人名片')
    : (card.category === 'other' ? 'General Card (Not QS)' : (card.title || card.category || ''));

  const countryText = card.country || card.translations?.country;

  return (
    <div 
      id={`card-list-item-${card.id}`}
      onClick={() => onSelect(card.id)}
      className={`group flex items-center gap-2.5 p-2 rounded-xl cursor-pointer transition-all border relative overflow-hidden select-none ${
        isSelected 
          ? 'bg-white border-indigo-500 shadow-lg shadow-indigo-50 ring-1 ring-indigo-500/20' 
          : isQsChecked
            ? 'bg-indigo-50/40 border-indigo-300'
            : 'bg-white border-slate-200 hover:border-indigo-300 hover:shadow-xs'
      }`}
    >
      {/* Checkbox for QS Selection */}
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
          className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer accent-indigo-600"
          title="勾選此名片至 QS 聯絡人名單"
        />
      </div>

      {/* Sync Status Badge */}
      <div 
        className={`absolute top-0 right-0 w-0 h-0 border-t-[18px] border-r-[18px] border-r-transparent ${
          card.syncStatus === 'notion' ? 'border-t-emerald-500' : 
          card.syncStatus === 'firebase' ? 'border-t-blue-400' : 'border-t-amber-400'
        }`} 
        title={
          card.syncStatus === 'notion' ? '已同步到 Notion' : 
          card.syncStatus === 'firebase' ? '圖片已在雲端' : '僅儲存在本地'
        }
      >
        <i className={`fa-solid absolute -top-[17px] right-[1px] text-[7px] text-white ${
          card.syncStatus === 'notion' ? 'fa-check-double' : 
          card.syncStatus === 'firebase' ? 'fa-cloud' : 'fa-database'
        }`}></i>
      </div>
      
      {/* Thumbnail */}
      <CardThumbnail card={card} size="lg" className="rounded-lg shadow-2xs" />

      {/* Info */}
      <div className="flex-1 min-w-0 pr-1">
        <div className="text-xs md:text-sm font-bold text-slate-800 truncate flex items-center gap-1.5">
          <span className="truncate">{displayName}</span>
          {isDuplicate && (
            <span className="text-[9px] px-1.5 py-0.2 rounded font-bold whitespace-nowrap bg-rose-50 text-rose-600 border border-rose-100 flex items-center gap-0.5 shrink-0">
              <i className="fa-solid fa-clone text-[8px]"></i>重複
            </span>
          )}
          {card.syncStatus !== 'notion' && (
            <span className={`text-[8px] px-1 py-0.2 rounded font-bold whitespace-nowrap hidden lg:inline-block shrink-0 ${
              card.syncStatus === 'firebase' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'
            }`}>
              {card.syncStatus === 'firebase' ? '已備份' : '新建立'}
            </span>
          )}
        </div>

        <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wide truncate flex items-center gap-1.5 mt-0.5">
          <span className="truncate">{displaySubtitle}</span>
          <span className={`text-[9px] px-1.5 py-0.2 rounded font-black shrink-0 border ${
            card.category === 'academic' ? 'bg-amber-50 text-amber-700 border-amber-200' :
            card.category === 'staff' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
            card.category === 'other' ? 'bg-slate-100 text-slate-600 border-slate-200' :
            'bg-blue-50 text-blue-700 border-blue-200'
          }`}>
            {card.category === 'employer' ? '雇主' : card.category === 'academic' ? '學者' : card.category === 'staff' ? '職員' : '非QS'}
          </span>
          {countryText && (
            <span className="text-[9px] text-slate-500 bg-slate-100 px-1 py-0.5 rounded font-normal shrink-0 flex items-center gap-0.5 max-w-[80px] truncate">
              <i className="fa-solid fa-earth-americas text-[8px] text-indigo-400"></i>
              <span className="truncate">{normalizeCountry(countryText)}</span>
            </span>
          )}
        </div>
      </div>

      {/* Delete Button */}
      <button 
        type="button"
        onClick={(e) => onDelete(e, card.id)} 
        className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-300 hover:bg-red-50 hover:text-red-500 opacity-80 md:opacity-0 group-hover:opacity-100 transition-all z-10 shrink-0 cursor-pointer" 
        title="刪除名片"
      >
        <i className="fa-solid fa-trash-can text-xs"></i>
      </button>
    </div>
  );
});

SidebarCardItem.displayName = 'SidebarCardItem';
