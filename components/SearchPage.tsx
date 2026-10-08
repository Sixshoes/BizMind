import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { BusinessCardData, SearchPageState, SearchSortOption, ExportMode } from '../types';
import { filterCards } from '../utils/cardFilters';
import { normalizeCountry, STANDARD_COUNTRIES, getCountryBilingualLabel } from '../utils/countries';
import { CardThumbnail } from './CardThumbnail';

interface SearchPageProps {
  cards: BusinessCardData[];
  onSelectCard: (id: string) => void;
  onDeleteCard?: (e: React.MouseEvent, id: string) => void;
  onStandardizeCountries?: () => void;
  onBack?: () => void;
  selectedCardIds?: Set<string>;
  onToggleCard?: (id: string) => void;
  onSelectBatch?: (ids: string[]) => void;
  onDeselectAll?: () => void;
  onOpenQsModal?: () => void;
  searchState?: SearchPageState;
  onSearchStateChange?: React.Dispatch<React.SetStateAction<SearchPageState>>;
  onUpdateCardCategory?: (id: string, category: 'employer' | 'academic' | 'staff' | 'other') => void;
  onAddNewCard?: () => void;
  onScanCamera?: () => void;
  onExportClick?: () => void;
  onOpenSettings?: () => void;
  onOpenDuplicateModal?: () => void;
  onOpenNotionTrash?: () => void;
  onSyncAllToNotion?: () => void;
  isSyncingAll?: boolean;
  onLoadFromNotion?: () => void;
  isNotionLoading?: boolean;
  onRemoveNoImageCards?: () => void;
  onClearAll?: () => void;
  onExport?: (mode: ExportMode) => void;
  onAutoDeduplicate?: () => void;
  duplicateGroupCount?: number;
  redundantDuplicateCount?: number;
  duplicateCardIds?: Set<string>;
  bgTaskCount?: number;
  isMobile?: boolean;
}

type SortOption = SearchSortOption;

const HighlightText: React.FC<{ text?: string, highlight: string }> = ({ text, highlight }) => {
  if (!text) return null;
  const strText = String(text);
  if (!highlight || !highlight.trim()) return <>{strText}</>;
  
  const escapeRegExp = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const rawTerms = highlight.trim().split(/\s+/).filter(Boolean);
  if (rawTerms.length === 0) return <>{strText}</>;
  
  const escapedTerms = rawTerms.map(escapeRegExp);
  const regex = new RegExp(`(${escapedTerms.join('|')})`, 'gi');
  const parts = strText.split(regex);
  const lowerTermSet = new Set(rawTerms.map(t => t.toLowerCase()));

  return (
    <span>
      {parts.map((part, i) => 
        lowerTermSet.has(part.toLowerCase()) ? (
          <mark key={i} className="bg-yellow-200 text-slate-900 rounded-xs px-0.5 font-semibold">{part}</mark>
        ) : (
          part
        )
      )}
    </span>
  );
};

const SearchPage: React.FC<SearchPageProps> = React.memo(({ 
  cards, 
  onSelectCard, 
  onDeleteCard, 
  onBack, 
  onStandardizeCountries,
  selectedCardIds = new Set(),
  onToggleCard,
  onSelectBatch,
  onDeselectAll,
  onOpenQsModal,
  searchState,
  onSearchStateChange,
  onUpdateCardCategory,
  onAddNewCard,
  onScanCamera,
  onExportClick,
  onOpenSettings,
  onOpenDuplicateModal,
  onOpenNotionTrash,
  onSyncAllToNotion,
  isSyncingAll = false,
  onLoadFromNotion,
  isNotionLoading = false,
  onRemoveNoImageCards,
  onClearAll,
  onExport,
  onAutoDeduplicate,
  duplicateGroupCount = 0,
  redundantDuplicateCount = 0,
  duplicateCardIds = new Set(),
  bgTaskCount = 0,
  isMobile = false
}) => {
  // Local state fallback if searchState is not provided from parent
  const [localQuery, setLocalQuery] = useState('');
  const [localSortBy, setLocalSortBy] = useState<SortOption>('name_asc');
  const [localIsGrouped, setLocalIsGrouped] = useState(true);
  const [localFilterHasEmail, setLocalFilterHasEmail] = useState(false);
  const [localFilterHasPhone, setLocalFilterHasPhone] = useState(false);
  const [localFilterCategory, setLocalFilterCategory] = useState<'all' | 'employer' | 'academic' | 'staff' | 'other'>('all');
  const [localFilterCountry, setLocalFilterCountry] = useState<string>('all');

  // Local Dropdown Menus for SearchPage Header
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const settingsMenuRef = useRef<HTMLDivElement>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (settingsMenuRef.current && !settingsMenuRef.current.contains(event.target as Node)) {
        setShowSettingsMenu(false);
      }
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Unified getters
  const query = searchState ? searchState.query : localQuery;
  const sortBy = searchState ? searchState.sortBy : localSortBy;
  const isGrouped = searchState ? searchState.isGrouped : localIsGrouped;
  const filterHasEmail = searchState ? searchState.filterHasEmail : localFilterHasEmail;
  const filterHasPhone = searchState ? searchState.filterHasPhone : localFilterHasPhone;
  const filterCategory = searchState ? searchState.filterCategory : localFilterCategory;
  const filterCountry = searchState ? searchState.filterCountry : localFilterCountry;

  // Category counts
  const categoryCounts = useMemo(() => {
    return {
      all: cards.length,
      employer: cards.filter(c => c.category === 'employer').length,
      academic: cards.filter(c => c.category === 'academic').length,
      staff: cards.filter(c => c.category === 'staff').length,
      other: cards.filter(c => c.category === 'other').length,
    };
  }, [cards]);

  // Unified state setters
  const setQuery = useCallback((val: string) => {
    if (onSearchStateChange) {
      onSearchStateChange(prev => ({ ...prev, query: val }));
    } else {
      setLocalQuery(val);
    }
  }, [onSearchStateChange]);

  const setSortBy = useCallback((val: SortOption) => {
    if (onSearchStateChange) {
      onSearchStateChange(prev => ({ ...prev, sortBy: val }));
    } else {
      setLocalSortBy(val);
    }
  }, [onSearchStateChange]);

  const setIsGrouped = useCallback((val: boolean) => {
    if (onSearchStateChange) {
      onSearchStateChange(prev => ({ ...prev, isGrouped: val }));
    } else {
      setLocalIsGrouped(val);
    }
  }, [onSearchStateChange]);

  const setFilterHasEmail = useCallback((val: boolean) => {
    if (onSearchStateChange) {
      onSearchStateChange(prev => ({ ...prev, filterHasEmail: val }));
    } else {
      setLocalFilterHasEmail(val);
    }
  }, [onSearchStateChange]);

  const setFilterHasPhone = useCallback((val: boolean) => {
    if (onSearchStateChange) {
      onSearchStateChange(prev => ({ ...prev, filterHasPhone: val }));
    } else {
      setLocalFilterHasPhone(val);
    }
  }, [onSearchStateChange]);

  const setFilterCategory = useCallback((val: 'all' | 'employer' | 'academic' | 'staff' | 'other') => {
    if (onSearchStateChange) {
      onSearchStateChange(prev => ({ ...prev, filterCategory: val }));
    } else {
      setLocalFilterCategory(val);
    }
  }, [onSearchStateChange]);

  const setFilterCountry = useCallback((val: string) => {
    if (onSearchStateChange) {
      onSearchStateChange(prev => ({ ...prev, filterCountry: val }));
    } else {
      setLocalFilterCountry(val);
    }
  }, [onSearchStateChange]);

  const handleResetAllFilters = useCallback(() => {
    if (onSearchStateChange) {
      onSearchStateChange({
        query: '',
        sortBy: 'name_asc',
        isGrouped: true,
        filterHasEmail: false,
        filterHasPhone: false,
        filterCategory: 'all',
        filterCountry: 'all'
      });
    } else {
      setLocalQuery('');
      setLocalSortBy('name_asc');
      setLocalIsGrouped(true);
      setLocalFilterHasEmail(false);
      setLocalFilterHasPhone(false);
      setLocalFilterCategory('all');
      setLocalFilterCountry('all');
    }
  }, [onSearchStateChange]);

  const hasActiveFilters = Boolean(
    query.trim() !== '' ||
    filterCategory !== 'all' ||
    filterCountry !== 'all' ||
    filterHasEmail ||
    filterHasPhone ||
    sortBy !== 'name_asc'
  );


  // Country counts (Standardized to 197 countries, consolidating Taiwan into Taiwan SAR)
  const countryStats = useMemo(() => {
    const map = new Map<string, number>();
    let emptyCount = 0;
    cards.forEach(c => {
      const rawCtry = (c.country || c.translations?.country || '').trim();
      const ctry = normalizeCountry(rawCtry);
      if (ctry) {
        map.set(ctry, (map.get(ctry) || 0) + 1);
      } else {
        emptyCount++;
      }
    });

    const sortedList = Array.from(map.entries()).sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return a[0].localeCompare(b[0], 'zh-Hant');
    });

    return { list: sortedList, emptyCount };
  }, [cards]);

  // --- Logic ---

  // 1. Filtering
  const filteredCards = useMemo(() => {
    return filterCards(cards, {
      searchText: query,
      category: filterCategory,
      country: filterCountry,
      requireEmail: filterHasEmail,
      requirePhone: filterHasPhone
    });
  }, [cards, query, filterCountry, filterHasEmail, filterHasPhone, filterCategory]);

  // 2. Sorting
  const sortedCards = useMemo(() => {
    return [...filteredCards].sort((a, b) => {
      switch (sortBy) {
        case 'name_asc':
          const nameA = (a.firstName || a.lastName) ? (a.lastName + a.firstName) : a.company;
          const nameB = (b.firstName || b.lastName) ? (b.lastName + b.firstName) : b.company;
          return (nameA || '').localeCompare(nameB || '', 'zh-Hant');
        case 'name_desc':
          const nameA_d = (a.firstName || a.lastName) ? (a.lastName + a.firstName) : a.company;
          const nameB_d = (b.firstName || b.lastName) ? (b.lastName + b.firstName) : b.company;
          return (nameB_d || '').localeCompare(nameA_d || '', 'zh-Hant');
        case 'company_asc':
          return (a.company || '').localeCompare(b.company || '', 'zh-Hant');
        case 'date_desc':
          return b.scannedAt - a.scannedAt;
        case 'date_asc':
          return a.scannedAt - b.scannedAt;
        default:
          return 0;
      }
    });
  }, [filteredCards, sortBy]);

  // 3. Grouping (A-Z)
  const groupedCards = useMemo<Record<string, BusinessCardData[]>>(() => {
    if (!isGrouped || sortBy.includes('date')) return { 'All': sortedCards };

    const groups: Record<string, BusinessCardData[]> = {};
    
    sortedCards.forEach(card => {
      let keyChar = '';
      if (sortBy.includes('company')) {
          keyChar = card.company?.charAt(0)?.toUpperCase();
      } else {
          // If no last name, use company char
          keyChar = card.lastName ? card.lastName.charAt(0).toUpperCase() : (card.company ? card.company.charAt(0).toUpperCase() : '#');
      }
      
      // Simple check if it's English alphabet
      let groupKey = /[A-Z]/.test(keyChar) ? keyChar : '# (Other/中文)';
      
      if (!groups[groupKey]) groups[groupKey] = [];
      groups[groupKey].push(card);
    });

    // Sort keys: A-Z first, then others
    const sortedKeys = Object.keys(groups).sort((a, b) => {
       if (a.startsWith('#') && !b.startsWith('#')) return 1;
       if (!a.startsWith('#') && b.startsWith('#')) return -1;
       return a.localeCompare(b);
    });

    const sortedGroups: Record<string, BusinessCardData[]> = {};
    sortedKeys.forEach(k => sortedGroups[k] = groups[k]);
    return sortedGroups;
  }, [sortedCards, isGrouped, sortBy]);

  // --- Render Helpers ---

  return (
    <div className="flex flex-col h-full bg-slate-50 w-full animate-fadeIn overflow-hidden">
      {/* 1. Unified Clean Header & Controls */}
      <div className="bg-white border-b border-slate-200 px-4 md:px-6 py-3 flex flex-col gap-2.5 shrink-0 shadow-xs z-20">
          
          {/* Top Brand & Actions Bar */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                  {onBack && (
                      <button 
                          type="button"
                          onClick={onBack} 
                          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-500 transition-colors cursor-pointer border border-slate-200"
                          title="返回"
                      >
                          <i className="fa-solid fa-arrow-left text-xs"></i>
                      </button>
                  )}
                  <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-sm shrink-0">
                      <i className="fa-solid fa-address-book text-base"></i>
                  </div>
                  <div>
                      <div className="flex items-center gap-2">
                          <h2 className="text-base md:text-lg font-black text-slate-900 tracking-tight leading-none">EcoScan 名片資料庫</h2>
                          <span className="bg-indigo-50 text-indigo-700 text-[11px] font-bold px-2 py-0.5 rounded-full border border-indigo-100">
                              共 {cards.length} 筆
                          </span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-400 font-medium mt-0.5">
                          <span>QS 智慧名片管理與分析系統</span>
                          {bgTaskCount > 0 && (
                              <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.2 rounded-full border border-indigo-100 animate-pulse flex items-center gap-1">
                                  <i className="fa-solid fa-wand-magic-sparkles text-[8px]"></i>
                                  AI 補全中 ({bgTaskCount})
                              </span>
                          )}
                      </div>
                  </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-1.5 ml-auto">
                  {onAddNewCard && (
                      <button 
                          type="button"
                          onClick={onAddNewCard} 
                          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer active:scale-95"
                          title="上傳名片圖片或 PDF"
                      >
                          <i className="fa-solid fa-plus text-[11px]"></i>
                          <span>新增名片</span>
                      </button>
                  )}
                  {onScanCamera && (
                      <button 
                          type="button"
                          onClick={onScanCamera} 
                          className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                          title="使用相機拍照掃描"
                      >
                          <i className="fa-solid fa-camera text-slate-600 text-xs"></i>
                          <span className="hidden sm:inline">拍照</span>
                      </button>
                  )}
                  {/* Export Dropdown Menu in Database View */}
                  {(onExport || onExportClick) && (
                      <div className="relative" ref={exportMenuRef}>
                          <button 
                              type="button"
                              onClick={() => {
                                  if (onExport) setShowExportMenu(!showExportMenu);
                                  else onExportClick?.();
                              }} 
                              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                                  showExportMenu ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                              }`}
                              title="匯出資料選項"
                          >
                              <i className="fa-solid fa-file-export text-xs"></i>
                              <span>匯出</span>
                              <i className={`fa-solid fa-chevron-down text-[9px] transition-transform ${showExportMenu ? 'rotate-180' : ''}`}></i>
                          </button>

                          {showExportMenu && onExport && (
                              <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-2xl border border-slate-200/80 py-2 z-50 animate-fadeIn origin-top-right">
                                  {selectedCardIds && selectedCardIds.size > 0 && (
                                      <>
                                          <div className="px-4 py-1.5 text-[10px] font-bold text-indigo-600 uppercase tracking-widest bg-indigo-50/50">
                                              已勾選 ({selectedCardIds.size})
                                          </div>
                                          <button 
                                              type="button"
                                              onClick={() => { setShowExportMenu(false); onExport('selected_qs'); }} 
                                              className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 transition-colors flex items-center gap-2 font-bold cursor-pointer"
                                          >
                                              <i className="fa-solid fa-file-excel w-4 text-center text-emerald-600"></i> 快速匯出勾選 QS Excel
                                          </button>
                                          <div className="h-px bg-slate-100 my-1"></div>
                                      </>
                                  )}

                                  <div className="px-4 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50/50">QS 格式匯出</div>
                                  <button type="button" onClick={() => { setShowExportMenu(false); onExport('employer'); }} className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-indigo-600 transition-colors flex items-center gap-2 cursor-pointer">
                                      <i className="fa-solid fa-briefcase w-4 text-center text-slate-400"></i> QS Employer
                                  </button>
                                  <button type="button" onClick={() => { setShowExportMenu(false); onExport('academic'); }} className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-indigo-600 transition-colors flex items-center gap-2 cursor-pointer">
                                      <i className="fa-solid fa-graduation-cap w-4 text-center text-slate-400"></i> QS Academic
                                  </button>
                                  <button type="button" onClick={() => { setShowExportMenu(false); onExport('staff'); }} className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-indigo-600 transition-colors flex items-center gap-2 cursor-pointer">
                                      <i className="fa-solid fa-user-tag w-4 text-center text-slate-400"></i> QS Staff
                                  </button>
                                  
                                  <div className="px-4 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50/50 mt-1">名片詳情匯出</div>
                                  <button type="button" onClick={() => { setShowExportMenu(false); onExport('all_clean'); }} className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-indigo-600 transition-colors flex items-center gap-2 cursor-pointer">
                                      <i className="fa-solid fa-language w-4 text-center text-slate-400"></i> 所有名片原文 (Excel)
                                  </button>
                                  <button type="button" onClick={() => { setShowExportMenu(false); onExport('all_original'); }} className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-indigo-600 transition-colors flex items-center gap-2 cursor-pointer">
                                      <i className="fa-solid fa-database w-4 text-center text-slate-400"></i> 所有資料含註解 (Excel)
                                  </button>
                                  <button type="button" onClick={() => { setShowExportMenu(false); onExport('vcard'); }} className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-indigo-600 transition-colors flex items-center gap-2 cursor-pointer">
                                      <i className="fa-regular fa-address-card w-4 text-center text-slate-400"></i> vCard (.vcf)
                                  </button>
                                  <button type="button" onClick={() => { setShowExportMenu(false); onExport('zip'); }} className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-indigo-600 transition-colors flex items-center gap-2 cursor-pointer">
                                      <i className="fa-solid fa-file-zipper w-4 text-center text-slate-400"></i> 批量匯出 (ZIP)
                                  </button>
                              </div>
                          )}
                      </div>
                  )}

                  {/* Settings Dropdown Menu in Database View */}
                  <div className="relative" ref={settingsMenuRef}>
                      <button 
                          type="button"
                          onClick={() => {
                              if (onSyncAllToNotion || onLoadFromNotion || onOpenNotionTrash || onOpenDuplicateModal) {
                                  setShowSettingsMenu(!showSettingsMenu);
                              } else {
                                  onOpenSettings?.();
                              }
                          }} 
                          className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors cursor-pointer ${
                              showSettingsMenu ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                          }`}
                          title="系統設定與 Notion 同步"
                      >
                          <i className="fa-solid fa-gear text-xs"></i>
                      </button>

                      {showSettingsMenu && (
                          <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-xl shadow-2xl border border-slate-200/80 py-2 z-50 animate-fadeIn origin-top-right">
                              <div className="px-4 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50/50">系統與 Notion 設定</div>
                              
                              {/* Sync All to Notion Button */}
                              {onSyncAllToNotion && (
                                  <button 
                                      type="button"
                                      onClick={() => { setShowSettingsMenu(false); onSyncAllToNotion(); }} 
                                      disabled={isSyncingAll} 
                                      className="w-full text-left px-4 py-3 text-sm text-indigo-700 bg-indigo-50/50 hover:bg-indigo-100 transition-colors flex items-center gap-2 font-bold cursor-pointer"
                                  >
                                      {isSyncingAll ? <i className="fa-solid fa-circle-notch fa-spin w-4 text-center"></i> : <i className="fa-solid fa-cloud-arrow-up w-4 text-center text-indigo-500"></i>}
                                      一鍵新增到 Notion 🚀
                                  </button>
                              )}

                              {/* Notion Load Button */}
                              {onLoadFromNotion && (
                                  <button 
                                      type="button"
                                      onClick={() => { setShowSettingsMenu(false); onLoadFromNotion(); }} 
                                      disabled={isNotionLoading} 
                                      className="w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-2 cursor-pointer"
                                  >
                                      {isNotionLoading ? <i className="fa-solid fa-circle-notch fa-spin w-4 text-center"></i> : <i className="fa-solid fa-cloud-arrow-down w-4 text-center text-slate-400"></i>}
                                      載入 Notion 資料 📥
                                  </button>
                              )}

                              {/* Notion Trash Scan & Restore Button */}
                              {onOpenNotionTrash && (
                                  <button 
                                      type="button"
                                      onClick={() => { setShowSettingsMenu(false); onOpenNotionTrash(); }} 
                                      className="w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 transition-colors flex items-center gap-2 font-medium cursor-pointer"
                                  >
                                      <i className="fa-solid fa-box-archive w-4 text-center text-indigo-500"></i>
                                      檢查並還原 Notion 封存名片 ♻️
                                  </button>
                              )}

                              {/* Find Duplicates Button */}
                              {onOpenDuplicateModal && (
                                  <button 
                                      type="button"
                                      onClick={() => { setShowSettingsMenu(false); onOpenDuplicateModal(); }} 
                                      className="w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 transition-colors flex items-center justify-between cursor-pointer"
                                  >
                                      <span className="flex items-center gap-2">
                                          <i className="fa-solid fa-clone w-4 text-center text-slate-400"></i>
                                          <span>尋找並清理重複名片</span>
                                      </span>
                                      {redundantDuplicateCount > 0 && (
                                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800">
                                              {redundantDuplicateCount}
                                          </span>
                                      )}
                                  </button>
                              )}

                              {/* Remove No Image Cards Button */}
                              {onRemoveNoImageCards && (
                                  <button 
                                      type="button"
                                      onClick={() => { setShowSettingsMenu(false); onRemoveNoImageCards(); }} 
                                      className="w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-2 cursor-pointer"
                                  >
                                      <i className="fa-solid fa-image-slash w-4 text-center text-slate-400"></i> 移除無圖片名片
                                  </button>
                              )}

                              {/* Clear Local DB Cache */}
                              {onClearAll && (
                                  <button 
                                      type="button"
                                      onClick={() => { setShowSettingsMenu(false); onClearAll(); }} 
                                      className="w-full text-left px-4 py-3 text-sm text-red-600 hover:bg-red-50 transition-colors flex items-center gap-2 font-bold cursor-pointer"
                                  >
                                      <i className="fa-solid fa-trash-can w-4 text-center"></i> 清理本地緩存
                                  </button>
                              )}
                          </div>
                      )}
                  </div>
              </div>
          </div>

          {/* Segmented Category Filter Tabs */}
          <div className="flex items-center gap-1 bg-slate-100/80 p-1 rounded-xl overflow-x-auto custom-scrollbar">
              <button
                  type="button"
                  onClick={() => setFilterCategory('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                      filterCategory === 'all'
                          ? 'bg-white text-slate-900 shadow-xs ring-1 ring-slate-200/50'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                  }`}
              >
                  <span>📂 全部名片</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${filterCategory === 'all' ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-600'}`}>
                      {categoryCounts.all}
                  </span>
              </button>

              <button
                  type="button"
                  onClick={() => setFilterCategory('employer')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                      filterCategory === 'employer'
                          ? 'bg-white text-blue-800 shadow-xs ring-1 ring-blue-200'
                          : 'text-slate-600 hover:text-blue-700 hover:bg-white/50'
                  }`}
              >
                  <span>🏢 QS 雇主</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${filterCategory === 'employer' ? 'bg-blue-600 text-white' : 'bg-blue-100 text-blue-800'}`}>
                      {categoryCounts.employer}
                  </span>
              </button>

              <button
                  type="button"
                  onClick={() => setFilterCategory('academic')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                      filterCategory === 'academic'
                          ? 'bg-white text-amber-800 shadow-xs ring-1 ring-amber-200'
                          : 'text-slate-600 hover:text-amber-700 hover:bg-white/50'
                  }`}
              >
                  <span>🎓 QS 學者</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${filterCategory === 'academic' ? 'bg-amber-600 text-white' : 'bg-amber-100 text-amber-800'}`}>
                      {categoryCounts.academic}
                  </span>
              </button>

              <button
                  type="button"
                  onClick={() => setFilterCategory('staff')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                      filterCategory === 'staff'
                          ? 'bg-white text-emerald-800 shadow-xs ring-1 ring-emerald-200'
                          : 'text-slate-600 hover:text-emerald-700 hover:bg-white/50'
                  }`}
              >
                  <span>🤝 QS 職員</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${filterCategory === 'staff' ? 'bg-emerald-600 text-white' : 'bg-emerald-100 text-emerald-800'}`}>
                      {categoryCounts.staff}
                  </span>
              </button>

              <button
                  type="button"
                  onClick={() => setFilterCategory('other')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                      filterCategory === 'other'
                          ? 'bg-white text-slate-800 shadow-xs ring-1 ring-slate-300'
                          : 'text-slate-500 hover:text-slate-800 hover:bg-white/50'
                  }`}
              >
                  <span>🚫 非 QS</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${filterCategory === 'other' ? 'bg-slate-700 text-white' : 'bg-slate-200 text-slate-600'}`}>
                      {categoryCounts.other}
                  </span>
              </button>
          </div>

          {/* Duplicate Alert Banner (Compact) */}
          {redundantDuplicateCount > 0 && (
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 bg-amber-50/90 border border-amber-200 rounded-lg px-3 py-1.5 text-xs text-amber-900">
                  <div className="flex items-center gap-2">
                      <i className="fa-solid fa-clone text-amber-600 text-xs"></i>
                      <span className="font-bold">發現 {duplicateGroupCount} 組重複名片 ({redundantDuplicateCount} 張冗餘)</span>
                  </div>
                  <div className="flex items-center gap-1.5 w-full sm:w-auto justify-end">
                      {onOpenDuplicateModal && (
                          <button
                              type="button"
                              onClick={onOpenDuplicateModal}
                              className="px-2.5 py-1 bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 font-bold rounded-md text-[11px] transition-all cursor-pointer shadow-2xs"
                          >
                              檢視明細
                          </button>
                      )}
                      {onAutoDeduplicate && (
                          <button
                              type="button"
                              onClick={onAutoDeduplicate}
                              className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-md text-[11px] transition-all shadow-xs cursor-pointer flex items-center gap-1"
                          >
                              <i className="fa-solid fa-bolt text-[9px]"></i>
                              <span>一鍵自動清理</span>
                          </button>
                      )}
                  </div>
              </div>
          )}

          {/* Search Bar & Primary Filters */}
          <div className="flex flex-col md:flex-row gap-2">
              {/* Search Input */}
              <div className="relative flex-1">
                  <i className="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
                  <input 
                      type="text" 
                      className="w-full pl-8 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all font-medium text-slate-800 text-xs md:text-sm placeholder:text-slate-400"
                      placeholder="搜尋姓名、公司、職稱、Email、國家、AI摘要、備註..."
                      value={query}
                      onChange={e => setQuery(e.target.value)}
                  />
                  {query && (
                      <button 
                          onClick={() => setQuery('')} 
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                          title="清除關鍵字"
                      >
                          <i className="fa-solid fa-circle-xmark text-xs"></i>
                      </button>
                  )}
              </div>

              {/* Country Filter Dropdown */}
              <div className="relative min-w-[150px]">
                  <i className="fa-solid fa-earth-americas absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-xs"></i>
                  <select 
                      value={filterCountry} 
                      onChange={(e) => setFilterCountry(e.target.value)}
                      className={`w-full pl-7 pr-7 py-2 border rounded-lg appearance-none font-bold text-xs outline-none cursor-pointer transition-all ${
                          filterCountry !== 'all' 
                              ? 'bg-indigo-50 border-indigo-300 text-indigo-700 ring-2 ring-indigo-500/20 shadow-xs' 
                              : 'bg-slate-50 border-slate-200 text-slate-700 focus:bg-white focus:ring-2 focus:ring-indigo-500/20'
                      }`}
                  >
                      <option value="all">🌍 國家：全部 ({cards.length})</option>
                      {countryStats.list.map(([countryName, count]) => (
                          <option key={countryName} value={countryName}>
                              {getCountryBilingualLabel(countryName)} ({count})
                          </option>
                      ))}
                      {countryStats.emptyCount > 0 && (
                          <option value="__empty__">未標註國家 ({countryStats.emptyCount})</option>
                      )}
                  </select>
                  <i className="fa-solid fa-chevron-down absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-[9px]"></i>
              </div>

              {onStandardizeCountries && (
                  <button
                      type="button"
                      onClick={onStandardizeCountries}
                      className="px-2.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-lg border border-indigo-200 flex items-center justify-center gap-1.5 transition-all shadow-xs shrink-0 cursor-pointer"
                      title="將所有名片國家欄位自動整合為 QS 標準 197 國（統一 Taiwan 為 Taiwan SAR）"
                  >
                      <i className="fa-solid fa-wand-magic-sparkles text-indigo-500 text-xs"></i>
                      <span>整合標準國家</span>
                  </button>
              )}

              {/* Sort Dropdown */}
              <div className="relative min-w-[140px]">
                  <select 
                      value={sortBy} 
                      onChange={(e) => setSortBy(e.target.value as SortOption)}
                      className="w-full pl-2.5 pr-7 py-2 bg-slate-50 border border-slate-200 rounded-lg appearance-none font-bold text-xs text-slate-700 focus:ring-2 focus:ring-indigo-500/20 outline-none cursor-pointer"
                  >
                      <option value="name_asc">姓名 (A-Z)</option>
                      <option value="name_desc">姓名 (Z-A)</option>
                      <option value="company_asc">公司 (A-Z)</option>
                      <option value="date_desc">掃描日期 (新到舊)</option>
                      <option value="date_asc">掃描日期 (舊到新)</option>
                  </select>
                  <i className="fa-solid fa-sort absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-xs"></i>
              </div>
          </div>

          {/* Quick Filters & QS Selection Bar (Unified Single Strip) */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100">
              <div className="flex flex-wrap gap-1.5 items-center">
                  <button 
                      type="button"
                      onClick={() => setIsGrouped(!isGrouped)}
                      className={`px-2.5 py-1 rounded-md text-xs font-bold border transition-all flex items-center gap-1 cursor-pointer ${isGrouped && !sortBy.includes('date') ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300'}`}
                      disabled={sortBy.includes('date')}
                      title={sortBy.includes('date') ? "日期排序不支援分組" : "依照字母/筆畫分組"}
                  >
                      <i className="fa-solid fa-layer-group text-[10px]"></i> 字母分組
                  </button>
                  
                  <button 
                      type="button"
                      onClick={() => setFilterHasEmail(!filterHasEmail)}
                      className={`px-2.5 py-1 rounded-md text-xs font-bold border transition-all flex items-center gap-1 cursor-pointer ${filterHasEmail ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'bg-white border-slate-200 text-slate-600 hover:border-emerald-300'}`}
                  >
                      <i className="fa-regular fa-envelope text-[10px]"></i> 有 Email
                  </button>
                  <button 
                      type="button"
                      onClick={() => setFilterHasPhone(!filterHasPhone)}
                      className={`px-2.5 py-1 rounded-md text-xs font-bold border transition-all flex items-center gap-1 cursor-pointer ${filterHasPhone ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-slate-200 text-slate-600 hover:border-blue-300'}`}
                  >
                      <i className="fa-solid fa-phone text-[10px]"></i> 有電話
                  </button>

                  {/* Active Country Filter Tag */}
                  {filterCountry !== 'all' && (
                      <button 
                          type="button"
                          onClick={() => setFilterCountry('all')}
                          className="px-2 py-1 rounded-md text-xs font-bold border transition-all bg-indigo-50 border-indigo-300 text-indigo-700 flex items-center gap-1 hover:bg-indigo-100 cursor-pointer"
                          title="點擊清除國家篩選"
                      >
                          <i className="fa-solid fa-earth-americas text-indigo-500 text-[10px]"></i>
                          <span>{filterCountry === '__empty__' ? '未標註國家' : getCountryBilingualLabel(filterCountry)}</span>
                          <i className="fa-solid fa-xmark text-[9px] ml-0.5"></i>
                      </button>
                  )}

                  {/* Reset All Filters Button */}
                  {hasActiveFilters && (
                      <button 
                          type="button"
                          onClick={handleResetAllFilters}
                          className="px-2 py-1 rounded-md text-xs font-bold bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 flex items-center gap-1 transition-all shadow-2xs cursor-pointer"
                          title="清除所有關鍵字與篩選條件"
                      >
                          <i className="fa-solid fa-rotate-left text-[9px]"></i>
                          <span>重設篩選</span>
                      </button>
                  )}

                  <div className="h-4 w-px bg-slate-200 mx-1 hidden sm:block"></div>

                  {/* Batch Selection shortcuts */}
                  <button
                      type="button"
                      onClick={() => onSelectBatch?.(filteredCards.map(c => c.id))}
                      className="px-2 py-1 bg-white hover:bg-indigo-50 hover:text-indigo-700 text-slate-600 text-xs font-bold rounded-md transition-colors border border-slate-200 cursor-pointer"
                      title="勾選當前篩選出的所有名片"
                  >
                      勾選本頁 ({filteredCards.length})
                  </button>
                  <button
                      type="button"
                      onClick={() => onSelectBatch?.(cards.filter(c => c.category !== 'other').map(c => c.id))}
                      className="px-2 py-1 bg-white hover:bg-indigo-50 hover:text-indigo-700 text-slate-600 text-xs font-bold rounded-md transition-colors border border-slate-200 cursor-pointer"
                      title="勾選所有 QS 名單 (Employer / Academic / Staff)"
                  >
                      勾選全部 QS
                  </button>
                  {selectedCardIds.size > 0 && (
                      <button
                          type="button"
                          onClick={() => onDeselectAll?.()}
                          className="px-2 py-1 text-slate-400 hover:text-rose-600 text-xs font-bold transition-colors cursor-pointer"
                      >
                          清除勾選
                      </button>
                  )}
              </div>

              {/* Right Side: Selected Export & Count */}
              <div className="flex items-center gap-2.5">
                  {selectedCardIds.size > 0 && (
                      <button
                          type="button"
                          onClick={() => onOpenQsModal?.()}
                          className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                      >
                          <i className="fa-solid fa-clipboard-check text-[11px]"></i>
                          <span>審查勾選 QS 名單 ({selectedCardIds.size})</span>
                      </button>
                  )}
                  <div className="text-xs font-bold text-slate-400 whitespace-nowrap">
                      顯示 <span className="text-slate-800">{filteredCards.length}</span> / {cards.length} 筆
                  </div>
              </div>
          </div>
      </div>

      {/* 2. Content List */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar relative">
          {filteredCards.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400">
                  <i className="fa-solid fa-filter-circle-xmark text-4xl mb-4 opacity-50"></i>
                  <p>沒有找到符合條件的名片</p>
                  <button onClick={handleResetAllFilters} className="mt-4 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-xs font-bold hover:bg-indigo-100 transition-colors flex items-center gap-1.5 cursor-pointer">
                      <i className="fa-solid fa-rotate-left text-[11px]"></i>
                      <span>重設並清除所有篩選</span>
                  </button>
              </div>
          ) : (
              <div className="space-y-8 pb-16">
                  {Object.entries(groupedCards).map(([groupTitle, groupItems]: [string, BusinessCardData[]]) => (
                      <div key={groupTitle}>
                          {/* Group Header */}
                          {(isGrouped && !sortBy.includes('date')) && (
                              <div className="flex items-center gap-4 mb-4">
                                  <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-black text-sm shadow-md shadow-indigo-200">
                                      {groupTitle}
                                  </div>
                                  <div className="h-px bg-slate-200 flex-1"></div>
                                  <span className="text-xs font-bold text-slate-400">{groupItems.length} 筆</span>
                              </div>
                          )}

                          {/* List View Only */}
                          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                              <table className="w-full text-left">
                                  <thead className="bg-slate-50 border-b border-slate-100">
                                      <tr>
                                          <th className="px-3 py-3 text-center w-10">
                                              <input 
                                                  type="checkbox"
                                                  checked={filteredCards.length > 0 && filteredCards.every(c => selectedCardIds.has(c.id))}
                                                  onChange={(e) => {
                                                      if (e.target.checked) {
                                                          onSelectBatch?.(filteredCards.map(c => c.id));
                                                      } else {
                                                          filteredCards.forEach(c => {
                                                              if (selectedCardIds.has(c.id)) {
                                                                  onToggleCard?.(c.id);
                                                              }
                                                          });
                                                      }
                                                  }}
                                                  className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer accent-indigo-600"
                                                  title="全選 / 取消全選本頁"
                                              />
                                          </th>
                                          <th className="px-3 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider w-12"></th>
                                          <th className="px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Name</th>
                                          <th className="px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Company / Title</th>
                                          <th className="px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider hidden md:table-cell">Contact</th>
                                          <th className="px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider w-20 text-right">Action</th>
                                      </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100">
                                      {groupItems.map(card => (
                                          <tr 
                                              key={card.id} 
                                              onClick={() => onSelectCard(card.id)} 
                                              className={`group hover:bg-indigo-50/50 cursor-pointer transition-colors ${
                                                  selectedCardIds.has(card.id) ? 'bg-indigo-50/30' : ''
                                              }`}
                                          >
                                              <td className="px-3 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                                                  <input 
                                                      type="checkbox"
                                                      checked={selectedCardIds.has(card.id)}
                                                      onChange={() => onToggleCard?.(card.id)}
                                                      className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer accent-indigo-600"
                                                      title="勾選此名片至 QS 聯絡人名單"
                                                  />
                                              </td>
                                              <td className="px-3 py-3">
                                                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold text-white shadow-sm overflow-hidden border border-slate-200/50 ${
                                                      card.category === 'academic' ? 'bg-amber-400' :
                                                      card.category === 'staff' ? 'bg-emerald-400' : 
                                                      card.category === 'other' ? 'bg-slate-400' :
                                                      'bg-blue-400'
                                                  }`}>
                                                      {/* Avatar Fallback */}
                                                      {card.imageUrl ? (
                                                          <img src={card.imageUrl} alt="Card" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                                      ) : (
                                                          card.lastName ? card.lastName.charAt(0) : (card.company ? card.company.charAt(0).toUpperCase() : '?')
                                                      )}
                                                  </div>
                                              </td>
                                              <td className="px-4 py-3">
                                                  <div className="text-sm md:text-base font-bold text-slate-800 flex items-center gap-2 flex-wrap">
                                                      {/* Name Fallback */}
                                                      {(card.firstName || card.lastName) ? (
                                                          <>
                                                            <HighlightText text={card.lastName} highlight={query} /> <HighlightText text={card.firstName} highlight={query} />
                                                          </>
                                                      ) : (
                                                          <HighlightText text={card.company || '未知名片'} highlight={query} />
                                                      )}
                                                      {duplicateCardIds?.has(card.id) && (
                                                          <span className="text-[9px] px-1.5 py-0.5 rounded font-bold whitespace-nowrap bg-rose-50 text-rose-600 border border-rose-100 inline-flex items-center gap-1">
                                                              <i className="fa-solid fa-clone text-[8px]"></i> 重複
                                                          </span>
                                                      )}
                                                  </div>
                                                  <div className="text-xs text-slate-500 md:hidden mt-0.5">
                                                      <HighlightText text={card.company} highlight={query} />
                                                  </div>
                                                  {/* QS Category Quick Switcher */}
                                                  <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                                                      <select
                                                          value={card.category || 'employer'}
                                                          onClick={(e) => e.stopPropagation()}
                                                          onChange={(e) => {
                                                              e.stopPropagation();
                                                              onUpdateCardCategory?.(card.id, e.target.value as any);
                                                          }}
                                                          className={`text-[10px] font-black px-1.5 py-0.5 rounded-md border cursor-pointer transition-colors outline-none ${
                                                              card.category === 'academic' ? 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100' :
                                                              card.category === 'staff' ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100' :
                                                              card.category === 'other' ? 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200' :
                                                              'bg-blue-50 text-blue-800 border-blue-200 hover:bg-blue-100'
                                                          }`}
                                                          title="點擊切換 QS 名片分類"
                                                      >
                                                          <option value="employer">🏢 QS 雇主 (Employer)</option>
                                                          <option value="academic">🎓 QS 學者 (Academic)</option>
                                                          <option value="staff">🤝 QS 職員 (Staff)</option>
                                                          <option value="other">🚫 非 QS (Not QS)</option>
                                                      </select>
                                                  </div>
                                              </td>
                                              <td className="px-4 py-3">
                                                  <div className="text-sm font-bold text-slate-700">
                                                      <HighlightText text={card.company} highlight={query} />
                                                  </div>
                                                  <div className="text-xs text-slate-500">
                                                      <HighlightText text={card.title} highlight={query} />
                                                  </div>
                                                  {(card.country || card.translations?.country) && (() => {
                                                      const displayCtry = normalizeCountry(card.country || card.translations?.country || '');
                                                      return (
                                                          <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                                                              <button
                                                                  type="button"
                                                                  onClick={(e) => {
                                                                      e.stopPropagation();
                                                                      setFilterCountry(displayCtry);
                                                                  }}
                                                                  title={`篩選來自「${displayCtry}」的名片`}
                                                                  className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md border transition-all ${
                                                                      filterCountry === displayCtry
                                                                          ? 'bg-indigo-100 text-indigo-800 border-indigo-300 ring-1 ring-indigo-200'
                                                                          : 'bg-slate-50 hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 border-slate-200 hover:border-indigo-200'
                                                                  }`}
                                                              >
                                                                  <i className="fa-solid fa-earth-americas text-[10px] text-indigo-500"></i>
                                                                  <HighlightText text={getCountryBilingualLabel(displayCtry)} highlight={query} />
                                                              </button>
                                                          </div>
                                                      );
                                                  })()}
                                                  {card.summary && (
                                                       <div className={`mt-2 text-xs rounded-lg p-2.5 flex items-start gap-2 transition-all ${
                                                           query && card.summary.toLowerCase().includes(query.toLowerCase())
                                                               ? 'bg-indigo-50/90 text-indigo-950 border border-indigo-200 shadow-2xs font-medium'
                                                               : 'bg-slate-50/90 text-slate-700 border border-slate-200/70'
                                                       }`}>
                                                           <i className={`fa-solid fa-wand-magic-sparkles text-xs mt-0.5 shrink-0 ${query && card.summary.toLowerCase().includes(query.toLowerCase()) ? 'text-indigo-600' : 'text-indigo-400'}`}></i>
                                                           <div className="flex-1 min-w-0 leading-relaxed whitespace-normal break-words">
                                                               <span className="inline-flex items-center font-bold text-[10px] text-indigo-700 bg-indigo-100/80 px-1.5 py-0.2 rounded mr-1.5 uppercase tracking-wider">AI 摘要</span>
                                                               <HighlightText text={card.summary} highlight={query} />
                                                           </div>
                                                       </div>
                                                   )}
                                                  {card.notes && (
                                                       <div className={`mt-1.5 text-xs rounded-lg p-2.5 flex items-start gap-2 transition-all ${
                                                           query && card.notes.toLowerCase().includes(query.toLowerCase())
                                                               ? 'bg-amber-50/90 text-amber-950 border border-amber-200 font-medium'
                                                               : 'bg-slate-50/80 text-slate-600 border border-slate-200/60'
                                                       }`}>
                                                           <i className="fa-regular fa-note-sticky text-xs mt-0.5 text-amber-600 shrink-0"></i>
                                                           <div className="flex-1 min-w-0 leading-relaxed whitespace-normal break-words">
                                                               <span className="inline-flex items-center font-bold text-[10px] text-amber-800 bg-amber-100/80 px-1.5 py-0.2 rounded mr-1.5 uppercase tracking-wider">備註</span>
                                                               <HighlightText text={card.notes} highlight={query} />
                                                           </div>
                                                       </div>
                                                   )}
                                              </td>
                                              <td className="px-4 py-3 hidden md:table-cell">
                                                  {card.email && <div className="text-xs text-slate-600 flex items-center gap-1"><i className="fa-regular fa-envelope text-slate-400"></i> <HighlightText text={String(card.email).split('/')[0]} highlight={query} /></div>}
                                                  {card.phone && <div className="text-xs text-slate-600 flex items-center gap-1 mt-0.5"><i className="fa-solid fa-phone text-slate-400"></i> <HighlightText text={String(card.phone).split('/')[0]} highlight={query} /></div>}
                                              </td>
                                              <td className="px-4 py-3 text-right">
                                                  <div className="flex items-center justify-end gap-1">
                                                      {onDeleteCard && (
                                                          <button 
                                                              onClick={(e) => {
                                                                  e.stopPropagation();
                                                                  if (!window.confirm("確定要移除這筆資料嗎？")) {
                                                                      return;
                                                                  }
                                                                  onDeleteCard(e, card.id);
                                                              }} 
                                                              className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-300 hover:bg-red-50 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                                                              title="刪除名片"
                                                          >
                                                              <i className="fa-solid fa-trash-can text-xs"></i>
                                                          </button>
                                                      )}
                                                      <button className="text-slate-300 group-hover:text-indigo-600 transition-colors">
                                                          <i className="fa-solid fa-chevron-right"></i>
                                                      </button>
                                                  </div>
                                              </td>
                                          </tr>
                                      ))}
                                  </tbody>
                              </table>
                          </div>
                      </div>
                  ))}
              </div>
          )}
      </div>

      {/* Floating QS Selection Bottom Action Bar */}
      {selectedCardIds.size > 0 && (
          <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl border border-slate-700 flex items-center gap-3 md:gap-4 animate-slideUp">
              <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-indigo-500 flex items-center justify-center text-xs font-black">
                      {selectedCardIds.size}
                  </div>
                  <span className="text-xs font-bold text-slate-200 hidden sm:inline">已勾選 QS 聯絡人</span>
              </div>
              <button
                  type="button"
                  onClick={() => onOpenQsModal?.()}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs rounded-xl flex items-center gap-1.5 shadow-md shadow-indigo-900 transition-all cursor-pointer"
              >
                  <i className="fa-solid fa-clipboard-check"></i>
                  <span>確認名單與匯出 ({selectedCardIds.size})</span>
              </button>
              <button
                  type="button"
                  onClick={() => onDeselectAll?.()}
                  className="text-xs text-slate-400 hover:text-white transition-colors cursor-pointer px-2 py-1"
              >
                  取消
              </button>
          </div>
      )}
    </div>
  );
});

export default SearchPage;