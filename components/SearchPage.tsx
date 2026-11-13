import React, { useState, useMemo, useCallback, useRef, useEffect, useDeferredValue } from 'react';
import { BusinessCardData, SearchPageState, SearchSortOption, SearchDisplayMode, ExportMode } from '../types';
import { filterCards } from '../utils/cardFilters';
import { normalizeCountry, getCountryBilingualLabel } from '../utils/countries';
import { CardThumbnail } from './CardThumbnail';
import { useToast } from './ToastProvider';

interface SearchPageProps {
  cards: BusinessCardData[];
  onSelectCard: (id: string) => void;
  onDeleteCard?: (e: React.MouseEvent, id: string) => void;
  onStandardizeCountries?: () => void;
  onBack?: () => void;
  onOpenWorkspace?: () => void;
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
  onOpenWarmGreeting?: (card: BusinessCardData) => void;
  onOpenImpactModal?: () => void;
  onLoadDemoCards?: () => void;
  duplicateGroupCount?: number;
  redundantDuplicateCount?: number;
  duplicateCardIds?: Set<string>;
  bgTaskCount?: number;
  isMobile?: boolean;
}

type SortOption = SearchSortOption;

interface HighlightMatcher {
  regex: RegExp;
  lowerTermSet: Set<string>;
}

const buildHighlightMatcher = (highlight: string): HighlightMatcher | null => {
  if (!highlight || !highlight.trim()) return null;
  const escapeRegExp = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const rawTerms = highlight.trim().split(/\s+/).filter(Boolean);
  if (rawTerms.length === 0) return null;
  const escapedTerms = rawTerms.map(escapeRegExp);
  return {
    regex: new RegExp(`(${escapedTerms.join('|')})`, 'gi'),
    lowerTermSet: new Set(rawTerms.map(t => t.toLowerCase())),
  };
};

const HighlightText: React.FC<{ text?: string; matcher: HighlightMatcher | null }> = React.memo(({ text, matcher }) => {
  if (!text) return null;
  const strText = String(text);
  if (!matcher) return <>{strText}</>;

  const parts = strText.split(matcher.regex);
  if (parts.length <= 1) return <>{strText}</>;

  return (
    <span>
      {parts.map((part, i) =>
        matcher.lowerTermSet.has(part.toLowerCase()) ? (
          <mark key={i} className="bg-amber-200/80 text-slate-900 rounded-xs px-0.5 font-semibold">{part}</mark>
        ) : (
          part
        )
      )}
    </span>
  );
});

const SearchPage: React.FC<SearchPageProps> = React.memo(({
  cards,
  onSelectCard,
  onDeleteCard,
  onBack,
  onOpenWorkspace,
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
  onOpenWarmGreeting,
  onOpenImpactModal,
  onLoadDemoCards,
  duplicateGroupCount = 0,
  redundantDuplicateCount = 0,
  duplicateCardIds = new Set(),
  bgTaskCount = 0,
}) => {
  const { addToast } = useToast();

  // Local fallback state
  const [localQuery, setLocalQuery] = useState('');
  const [localSortBy, setLocalSortBy] = useState<SortOption>('name_asc');
  const [localIsGrouped, setLocalIsGrouped] = useState(true);
  const [localFilterHasEmail, setLocalFilterHasEmail] = useState(false);
  const [localFilterHasPhone, setLocalFilterHasPhone] = useState(false);
  const [localFilterCategory, setLocalFilterCategory] = useState<'all' | 'employer' | 'academic' | 'staff' | 'other'>('all');
  const [localFilterCountry, setLocalFilterCountry] = useState<string>('all');
  const [localDisplayMode, setLocalDisplayMode] = useState<SearchDisplayMode>('table');
  const [expandedRowIds, setExpandedRowIds] = useState<Set<string>>(new Set());

  // Dropdown menus
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
  const deferredQuery = useDeferredValue(query);
  const sortBy = searchState ? searchState.sortBy : localSortBy;
  const isGrouped = searchState ? searchState.isGrouped : localIsGrouped;
  const filterHasEmail = searchState ? searchState.filterHasEmail : localFilterHasEmail;
  const filterHasPhone = searchState ? searchState.filterHasPhone : localFilterHasPhone;
  const filterCategory = searchState ? searchState.filterCategory : localFilterCategory;
  const filterCountry = searchState ? searchState.filterCountry : localFilterCountry;
  const displayMode: SearchDisplayMode = searchState?.displayMode || localDisplayMode;

  const highlightMatcher = useMemo(() => buildHighlightMatcher(deferredQuery), [deferredQuery]);
  const deferredQueryLower = useMemo(() => deferredQuery.trim().toLowerCase(), [deferredQuery]);

  // Sustainability quick metric
  const co2SavedGrams = useMemo(() => {
    const sheets = cards.reduce((acc, c) => acc + (c.physicalCount || 1), 0);
    return Math.round(sheets * 8.5);
  }, [cards]);

  // Progressive rendering
  const INITIAL_RENDER_COUNT = 100;
  const [renderLimit, setRenderLimit] = useState(INITIAL_RENDER_COUNT);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const loadMoreSentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setRenderLimit(INITIAL_RENDER_COUNT);
  }, [deferredQuery, sortBy, isGrouped, filterHasEmail, filterHasPhone, filterCategory, filterCountry, displayMode]);

  // Category counts
  const categoryCounts = useMemo(() => {
    const counts = { all: cards.length, employer: 0, academic: 0, staff: 0, other: 0 };
    for (let i = 0; i < cards.length; i++) {
      const cat = cards[i].category;
      if (cat === 'employer') counts.employer++;
      else if (cat === 'academic') counts.academic++;
      else if (cat === 'staff') counts.staff++;
      else counts.other++;
    }
    return counts;
  }, [cards]);

  // Setters
  const setQuery = useCallback((val: string) => {
    if (onSearchStateChange) onSearchStateChange(prev => ({ ...prev, query: val }));
    else setLocalQuery(val);
  }, [onSearchStateChange]);

  const setSortBy = useCallback((val: SortOption) => {
    if (onSearchStateChange) onSearchStateChange(prev => ({ ...prev, sortBy: val }));
    else setLocalSortBy(val);
  }, [onSearchStateChange]);

  const setIsGrouped = useCallback((val: boolean) => {
    if (onSearchStateChange) onSearchStateChange(prev => ({ ...prev, isGrouped: val }));
    else setLocalIsGrouped(val);
  }, [onSearchStateChange]);

  const setFilterHasEmail = useCallback((val: boolean) => {
    if (onSearchStateChange) onSearchStateChange(prev => ({ ...prev, filterHasEmail: val }));
    else setLocalFilterHasEmail(val);
  }, [onSearchStateChange]);

  const setFilterHasPhone = useCallback((val: boolean) => {
    if (onSearchStateChange) onSearchStateChange(prev => ({ ...prev, filterHasPhone: val }));
    else setLocalFilterHasPhone(val);
  }, [onSearchStateChange]);

  const setFilterCategory = useCallback((val: 'all' | 'employer' | 'academic' | 'staff' | 'other') => {
    if (onSearchStateChange) onSearchStateChange(prev => ({ ...prev, filterCategory: val }));
    else setLocalFilterCategory(val);
  }, [onSearchStateChange]);

  const setFilterCountry = useCallback((val: string) => {
    if (onSearchStateChange) onSearchStateChange(prev => ({ ...prev, filterCountry: val }));
    else setLocalFilterCountry(val);
  }, [onSearchStateChange]);

  const setDisplayMode = useCallback((val: SearchDisplayMode) => {
    if (onSearchStateChange) onSearchStateChange(prev => ({ ...prev, displayMode: val }));
    else setLocalDisplayMode(val);
  }, [onSearchStateChange]);

  const toggleExpandRow = useCallback((e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setExpandedRowIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const copyText = useCallback((e: React.MouseEvent, text: string, label: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    addToast({ type: 'info', message: `已複製${label}：${text}` });
  }, [addToast]);

  const handleResetAllFilters = useCallback(() => {
    if (onSearchStateChange) {
      onSearchStateChange(prev => ({
        ...prev,
        query: '',
        sortBy: 'name_asc',
        isGrouped: true,
        filterHasEmail: false,
        filterHasPhone: false,
        filterCategory: 'all',
        filterCountry: 'all'
      }));
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

  // Country stats
  const countryStats = useMemo(() => {
    const map = new Map<string, number>();
    let emptyCount = 0;
    cards.forEach(c => {
      const rawCtry = (c.country || c.translations?.country || '').trim();
      const ctry = normalizeCountry(rawCtry);
      if (ctry) map.set(ctry, (map.get(ctry) || 0) + 1);
      else emptyCount++;
    });

    const sortedList = Array.from(map.entries()).sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return a[0].localeCompare(b[0], 'zh-Hant');
    });

    return { list: sortedList, emptyCount };
  }, [cards]);

  // Filtering
  const filteredCards = useMemo(() => {
    return filterCards(cards, {
      searchText: deferredQuery,
      category: filterCategory,
      country: filterCountry,
      requireEmail: filterHasEmail,
      requirePhone: filterHasPhone
    });
  }, [cards, deferredQuery, filterCountry, filterHasEmail, filterHasPhone, filterCategory]);

  // Sorting
  const sortedCards = useMemo(() => {
    return [...filteredCards].sort((a, b) => {
      switch (sortBy) {
        case 'name_asc': {
          const nameA = (a.firstName || a.lastName) ? (a.lastName + a.firstName) : a.company;
          const nameB = (b.firstName || b.lastName) ? (b.lastName + b.firstName) : b.company;
          return (nameA || '').localeCompare(nameB || '', 'zh-Hant');
        }
        case 'name_desc': {
          const nameA_d = (a.firstName || a.lastName) ? (a.lastName + a.firstName) : a.company;
          const nameB_d = (b.firstName || b.lastName) ? (b.lastName + b.firstName) : b.company;
          return (nameB_d || '').localeCompare(nameA_d || '', 'zh-Hant');
        }
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

  const displayedCards = useMemo(() => {
    return sortedCards.length > renderLimit ? sortedCards.slice(0, renderLimit) : sortedCards;
  }, [sortedCards, renderLimit]);

  const hasMoreToRender = renderLimit < sortedCards.length;

  useEffect(() => {
    if (!hasMoreToRender) return;
    const sentinel = loadMoreSentinelRef.current;
    const root = scrollContainerRef.current;
    if (!sentinel || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setRenderLimit(prev => Math.min(sortedCards.length, prev + 100));
        }
      },
      { root, rootMargin: '400px' }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMoreToRender, sortedCards.length]);

  // Grouping
  const groupedCards = useMemo<Record<string, BusinessCardData[]>>(() => {
    if (!isGrouped || sortBy.includes('date')) return { All: displayedCards };

    const groups: Record<string, BusinessCardData[]> = {};
    displayedCards.forEach(card => {
      let keyChar = '';
      if (sortBy.includes('company')) {
        keyChar = card.company?.charAt(0)?.toUpperCase();
      } else {
        keyChar = card.lastName
          ? card.lastName.charAt(0).toUpperCase()
          : (card.company ? card.company.charAt(0).toUpperCase() : '#');
      }
      const groupKey = /[A-Z]/.test(keyChar) ? keyChar : '# 中文與其他';
      if (!groups[groupKey]) groups[groupKey] = [];
      groups[groupKey].push(card);
    });

    const sortedKeys = Object.keys(groups).sort((a, b) => {
      if (a.startsWith('#') && !b.startsWith('#')) return 1;
      if (!a.startsWith('#') && b.startsWith('#')) return -1;
      return a.localeCompare(b);
    });

    const sortedGroups: Record<string, BusinessCardData[]> = {};
    sortedKeys.forEach(k => { sortedGroups[k] = groups[k]; });
    return sortedGroups;
  }, [displayedCards, isGrouped, sortBy]);

  const allFilteredSelected = useMemo(() => {
    return filteredCards.length > 0 && selectedCardIds.size >= filteredCards.length && filteredCards.every(c => selectedCardIds.has(c.id));
  }, [filteredCards, selectedCardIds]);

  const categoryTabs = [
    { id: 'all' as const, label: '全部名片', count: categoryCounts.all, dot: 'bg-slate-500' },
    { id: 'employer' as const, label: 'QS 雇主', count: categoryCounts.employer, dot: 'bg-blue-500' },
    { id: 'academic' as const, label: 'QS 學者', count: categoryCounts.academic, dot: 'bg-amber-500' },
    { id: 'staff' as const, label: 'QS 職員', count: categoryCounts.staff, dot: 'bg-emerald-500' },
    { id: 'other' as const, label: '非 QS', count: categoryCounts.other, dot: 'bg-slate-400' }
  ];

  return (
    <div className="flex flex-col h-full bg-[#f8fafc] w-full animate-fadeIn overflow-hidden">
      {/* 1. Modern Clean Business Top Header */}
      <header className="bg-white border-b border-slate-200/80 px-4 md:px-6 py-3 flex flex-col gap-3 shrink-0 z-20">
        {/* Top Row: Brand, Impact Pill & Primary Actions */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-indigo-600 to-emerald-600 rounded-xl flex items-center justify-center text-white shadow-xs shrink-0">
              <i className="fa-solid fa-seedling text-sm"></i>
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base md:text-lg font-bold text-slate-900 tracking-tight leading-none">
                  BizMind 永續智慧人脈庫
                </h1>
                <span className="bg-slate-100 text-slate-600 text-[11px] font-semibold px-2 py-0.5 rounded-md border border-slate-200/70 tabular-nums">
                  {cards.length} 筆典藏
                </span>
                {onOpenImpactModal && (
                  <button
                    type="button"
                    onClick={onOpenImpactModal}
                    className="inline-flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100/80 text-emerald-800 text-[11px] font-semibold px-2.5 py-0.5 rounded-full border border-emerald-200/70 transition-colors cursor-pointer"
                    title="檢視三好四給永續影響力與 AI 透明揭露聲明"
                  >
                    <i className="fa-solid fa-leaf text-[10px] text-emerald-600"></i>
                    <span>無紙減碳 {co2SavedGrams}g · 三好 AI 揭露</span>
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-1">
                <span>三好四給 · 國際高教與永續交流管理平台</span>
                {bgTaskCount > 0 && (
                  <span className="text-[10px] font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.2 rounded-full border border-indigo-100 animate-pulse inline-flex items-center gap-1">
                    <i className="fa-solid fa-circle-notch fa-spin text-[9px]"></i>
                    AI 摘要補全中 ({bgTaskCount})
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Right Toolbar */}
          <div className="flex items-center gap-2 ml-auto">
            {(onOpenWorkspace || onBack) && (
              <button
                type="button"
                onClick={onOpenWorkspace || onBack}
                className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200/90 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer"
                title="切換至分欄掃描與詳細編輯工作區"
              >
                <i className="fa-solid fa-table-columns text-slate-400 text-xs"></i>
                <span className="hidden sm:inline">分欄工作區</span>
              </button>
            )}

            {onAddNewCard && (
              <button
                type="button"
                onClick={onAddNewCard}
                className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer active:scale-[0.98]"
                title="上傳名片影像、PDF 或備份檔"
              >
                <i className="fa-solid fa-plus text-[11px]"></i>
                <span>新增名片</span>
              </button>
            )}

            {onScanCamera && (
              <button
                type="button"
                onClick={onScanCamera}
                className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200/90 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer"
                title="開啟相機拍攝名片"
              >
                <i className="fa-solid fa-camera text-slate-500 text-xs"></i>
                <span className="hidden sm:inline">拍照</span>
              </button>
            )}

            {/* Export Menu */}
            {(onExport || onExportClick) && (
              <div className="relative" ref={exportMenuRef}>
                <button
                  type="button"
                  onClick={() => {
                    if (onExport) setShowExportMenu(!showExportMenu);
                    else onExportClick?.();
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 border transition-all cursor-pointer ${
                    showExportMenu
                      ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                      : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200/90 shadow-2xs'
                  }`}
                  title="匯出資料"
                >
                  <i className="fa-solid fa-arrow-up-from-bracket text-slate-500 text-xs"></i>
                  <span>匯出</span>
                  <i className={`fa-solid fa-chevron-down text-[9px] text-slate-400 transition-transform ${showExportMenu ? 'rotate-180' : ''}`}></i>
                </button>

                {showExportMenu && onExport && (
                  <div className="absolute right-0 top-full mt-1.5 w-60 bg-white rounded-xl shadow-xl border border-slate-200/90 py-1.5 z-50 animate-fadeIn origin-top-right">
                    {selectedCardIds && selectedCardIds.size > 0 && (
                      <>
                        <div className="px-3.5 py-1.5 text-[10px] font-bold text-indigo-600 uppercase tracking-wider bg-indigo-50/50">
                          已勾選名單 ({selectedCardIds.size})
                        </div>
                        <button
                          type="button"
                          onClick={() => { setShowExportMenu(false); onExport('selected_qs'); }}
                          className="w-full text-left px-3.5 py-2 text-xs text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors flex items-center gap-2.5 font-semibold cursor-pointer"
                        >
                          <i className="fa-solid fa-file-excel w-4 text-center text-emerald-600"></i>
                          <span>快速匯出勾選 QS Excel</span>
                        </button>
                        <div className="h-px bg-slate-100 my-1"></div>
                      </>
                    )}

                    <div className="px-3.5 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">QS 標準格式</div>
                    <button type="button" onClick={() => { setShowExportMenu(false); onExport('employer'); }} className="w-full text-left px-3.5 py-2 text-xs text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-2.5 cursor-pointer">
                      <span className="w-2 h-2 rounded-full bg-blue-500 ml-1 mr-0.5"></span> QS Employer (雇主)
                    </button>
                    <button type="button" onClick={() => { setShowExportMenu(false); onExport('academic'); }} className="w-full text-left px-3.5 py-2 text-xs text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-2.5 cursor-pointer">
                      <span className="w-2 h-2 rounded-full bg-amber-500 ml-1 mr-0.5"></span> QS Academic (學者)
                    </button>
                    <button type="button" onClick={() => { setShowExportMenu(false); onExport('staff'); }} className="w-full text-left px-3.5 py-2 text-xs text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-2.5 cursor-pointer">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 ml-1 mr-0.5"></span> QS Staff (職員)
                    </button>

                    <div className="h-px bg-slate-100 my-1"></div>
                    <div className="px-3.5 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">完整匯出與備份</div>
                    <button type="button" onClick={() => { setShowExportMenu(false); onExport('all_clean'); }} className="w-full text-left px-3.5 py-2 text-xs text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-2.5 cursor-pointer">
                      <i className="fa-solid fa-table w-4 text-center text-slate-400"></i> 所有名片清單 (Excel)
                    </button>
                    <button type="button" onClick={() => { setShowExportMenu(false); onExport('all_original'); }} className="w-full text-left px-3.5 py-2 text-xs text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-2.5 cursor-pointer">
                      <i className="fa-solid fa-database w-4 text-center text-slate-400"></i> 含翻譯與完整註解 (Excel)
                    </button>
                    <button type="button" onClick={() => { setShowExportMenu(false); onExport('vcard'); }} className="w-full text-left px-3.5 py-2 text-xs text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-2.5 cursor-pointer">
                      <i className="fa-regular fa-address-card w-4 text-center text-slate-400"></i> 手機通訊錄 vCard (.vcf)
                    </button>
                    <button type="button" onClick={() => { setShowExportMenu(false); onExport('zip'); }} className="w-full text-left px-3.5 py-2 text-xs text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-2.5 cursor-pointer">
                      <i className="fa-solid fa-file-zipper w-4 text-center text-slate-400"></i> 整合壓縮包 (.zip)
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Settings & Cloud Sync Menu */}
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
                className={`w-8 h-8 flex items-center justify-center rounded-lg border transition-colors cursor-pointer ${
                  showSettingsMenu
                    ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                    : 'bg-white hover:bg-slate-50 text-slate-600 border-slate-200/90 shadow-2xs'
                }`}
                title="雲端同步與資料維護"
              >
                <i className="fa-solid fa-sliders text-xs"></i>
              </button>

              {showSettingsMenu && (
                <div className="absolute right-0 top-full mt-1.5 w-64 bg-white rounded-xl shadow-xl border border-slate-200/90 py-1.5 z-50 animate-fadeIn origin-top-right">
                  <div className="px-3.5 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Notion 雲端同步</div>

                  {onSyncAllToNotion && (
                    <button
                      type="button"
                      onClick={() => { setShowSettingsMenu(false); onSyncAllToNotion(); }}
                      disabled={isSyncingAll}
                      className="w-full text-left px-3.5 py-2.5 text-xs text-indigo-700 hover:bg-indigo-50 transition-colors flex items-center gap-2.5 font-semibold cursor-pointer"
                    >
                      <i className={`fa-solid ${isSyncingAll ? 'fa-circle-notch fa-spin' : 'fa-cloud-arrow-up'} w-4 text-center text-indigo-500`}></i>
                      <span>一鍵同步未備份名片至 Notion</span>
                    </button>
                  )}

                  {onLoadFromNotion && (
                    <button
                      type="button"
                      onClick={() => { setShowSettingsMenu(false); onLoadFromNotion(); }}
                      disabled={isNotionLoading}
                      className="w-full text-left px-3.5 py-2.5 text-xs text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-2.5 cursor-pointer"
                    >
                      <i className={`fa-solid ${isNotionLoading ? 'fa-circle-notch fa-spin' : 'fa-cloud-arrow-down'} w-4 text-center text-slate-400`}></i>
                      <span>從 Notion 載入最新資料</span>
                    </button>
                  )}

                  {onOpenNotionTrash && (
                    <button
                      type="button"
                      onClick={() => { setShowSettingsMenu(false); onOpenNotionTrash(); }}
                      className="w-full text-left px-3.5 py-2.5 text-xs text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-2.5 cursor-pointer"
                    >
                      <i className="fa-solid fa-box-archive w-4 text-center text-slate-400"></i>
                      <span>檢查並還原 Notion 封存名片</span>
                    </button>
                  )}

                  <div className="h-px bg-slate-100 my-1"></div>
                  <div className="px-3.5 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">資料品質與體驗</div>

                  {onLoadDemoCards && (
                    <button
                      type="button"
                      onClick={() => { setShowSettingsMenu(false); onLoadDemoCards(); }}
                      className="w-full text-left px-3.5 py-2.5 text-xs text-emerald-700 hover:bg-emerald-50 transition-colors flex items-center gap-2.5 font-medium cursor-pointer"
                    >
                      <i className="fa-solid fa-seedling w-4 text-center text-emerald-600"></i>
                      <span>載入三好永續示範名片 (6 筆)</span>
                    </button>
                  )}

                  {onOpenDuplicateModal && (
                    <button
                      type="button"
                      onClick={() => { setShowSettingsMenu(false); onOpenDuplicateModal(); }}
                      className="w-full text-left px-3.5 py-2.5 text-xs text-slate-700 hover:bg-slate-50 transition-colors flex items-center justify-between cursor-pointer"
                    >
                      <span className="flex items-center gap-2.5">
                        <i className="fa-regular fa-copy w-4 text-center text-slate-400"></i>
                        <span>檢查並合併重複名片</span>
                      </span>
                      {redundantDuplicateCount > 0 && (
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-800">
                          {redundantDuplicateCount}
                        </span>
                      )}
                    </button>
                  )}

                  {onRemoveNoImageCards && (
                    <button
                      type="button"
                      onClick={() => { setShowSettingsMenu(false); onRemoveNoImageCards(); }}
                      className="w-full text-left px-3.5 py-2.5 text-xs text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-2.5 cursor-pointer"
                    >
                      <i className="fa-regular fa-image w-4 text-center text-slate-400"></i>
                      <span>清理無圖片名片項目</span>
                    </button>
                  )}

                  {onClearAll && (
                    <>
                      <div className="h-px bg-slate-100 my-1"></div>
                      <button
                        type="button"
                        onClick={() => { setShowSettingsMenu(false); onClearAll(); }}
                        className="w-full text-left px-3.5 py-2.5 text-xs text-rose-600 hover:bg-rose-50 transition-colors flex items-center gap-2.5 font-semibold cursor-pointer"
                      >
                        <i className="fa-regular fa-trash-can w-4 text-center"></i>
                        <span>清空本機快取資料</span>
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Duplicate Notice Strip */}
        {redundantDuplicateCount > 0 && (
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 bg-amber-50/80 border border-amber-200/80 rounded-xl px-3.5 py-2 text-xs text-amber-900">
            <div className="flex items-center gap-2">
              <i className="fa-solid fa-layer-group text-amber-600 text-xs"></i>
              <span className="font-semibold">
                系統偵測到 {duplicateGroupCount} 組相似或重複名片（共 {redundantDuplicateCount} 筆可合併）
              </span>
            </div>
            <div className="flex items-center gap-1.5 ml-auto">
              {onOpenDuplicateModal && (
                <button
                  type="button"
                  onClick={onOpenDuplicateModal}
                  className="px-2.5 py-1 bg-white hover:bg-amber-100/70 text-amber-900 border border-amber-300/80 font-semibold rounded-lg text-[11px] transition-all cursor-pointer"
                >
                  檢視比對
                </button>
              )}
              {onAutoDeduplicate && (
                <button
                  type="button"
                  onClick={onAutoDeduplicate}
                  className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-lg text-[11px] transition-all cursor-pointer"
                >
                  智慧合併清理
                </button>
              )}
            </div>
          </div>
        )}

        {/* Row 2: Clean Segmented Category Tabs + Search + Country + Sort + View Mode Toggle */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-2.5">
          {/* Category Segmented Control (No emoji clutter) */}
          <div className="flex items-center gap-1 bg-slate-100/90 p-1 rounded-xl overflow-x-auto custom-scrollbar shrink-0">
            {categoryTabs.map(tab => {
              const active = filterCategory === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilterCategory(tab.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                    active
                      ? 'bg-white text-slate-900 shadow-2xs ring-1 ring-slate-200/70'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${tab.dot}`} />
                  <span>{tab.label}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-md font-semibold tabular-nums ${
                    active ? 'bg-slate-900 text-white' : 'bg-slate-200/80 text-slate-600'
                  }`}>
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Search, Country, Sort & View Switcher */}
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 flex-1 lg:max-w-2xl">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[180px]">
              <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
              <input
                type="text"
                className="w-full pl-8 pr-8 py-1.5 bg-slate-50/80 border border-slate-200/90 rounded-lg focus:bg-white focus:ring-2 focus:ring-indigo-500/15 focus:border-indigo-500 outline-none transition-all text-slate-800 text-xs md:text-sm placeholder:text-slate-400"
                placeholder="搜尋姓名、機構、職稱、國別、AI 簡介或備註..."
                value={query}
                onChange={e => setQuery(e.target.value)}
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                  title="清除搜尋"
                >
                  <i className="fa-solid fa-circle-xmark text-xs"></i>
                </button>
              )}
            </div>

            {/* Country Select */}
            <div className="relative min-w-[140px]">
              <select
                value={filterCountry}
                onChange={(e) => setFilterCountry(e.target.value)}
                className={`w-full pl-3 pr-7 py-1.5 border rounded-lg appearance-none font-semibold text-xs outline-none cursor-pointer transition-all ${
                  filterCountry !== 'all'
                    ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                    : 'bg-white border-slate-200/90 text-slate-700 hover:border-slate-300'
                }`}
              >
                <option value="all">所有國家 ({cards.length})</option>
                {countryStats.list.map(([countryName, count]) => (
                  <option key={countryName} value={countryName}>
                    {getCountryBilingualLabel(countryName)} ({count})
                  </option>
                ))}
                {countryStats.emptyCount > 0 && (
                  <option value="__empty__">未標註國別 ({countryStats.emptyCount})</option>
                )}
              </select>
              <i className="fa-solid fa-chevron-down absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-[9px]"></i>
            </div>

            {/* Sort Select */}
            <div className="relative min-w-[126px]">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="w-full pl-3 pr-7 py-1.5 bg-white border border-slate-200/90 hover:border-slate-300 rounded-lg appearance-none font-semibold text-xs text-slate-700 outline-none cursor-pointer transition-all"
              >
                <option value="name_asc">姓名 A → Z</option>
                <option value="name_desc">姓名 Z → A</option>
                <option value="company_asc">機構 A → Z</option>
                <option value="date_desc">最新掃描優先</option>
                <option value="date_asc">最早掃描優先</option>
              </select>
              <i className="fa-solid fa-arrow-down-wide-short absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-[10px]"></i>
            </div>

            {/* Table vs Card Grid Switcher */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200/70 shrink-0" role="group" aria-label="檢視模式">
              <button
                type="button"
                onClick={() => setDisplayMode('table')}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  displayMode === 'table'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
                title="表格清單檢視"
              >
                <i className="fa-solid fa-bars text-[11px]"></i>
                <span className="hidden xl:inline">清單</span>
              </button>
              <button
                type="button"
                onClick={() => setDisplayMode('grid')}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  displayMode === 'grid'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
                title="名片卡片牆檢視"
              >
                <i className="fa-solid fa-grip text-[11px]"></i>
                <span className="hidden xl:inline">卡片牆</span>
              </button>
            </div>
          </div>
        </div>

        {/* Row 3: Compact Filter Pills & Batch Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs">
          <div className="flex flex-wrap gap-1.5 items-center">
            <button
              type="button"
              onClick={() => setIsGrouped(!isGrouped)}
              disabled={sortBy.includes('date')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-40 ${
                isGrouped && !sortBy.includes('date')
                  ? 'bg-indigo-50/80 border-indigo-200 text-indigo-700'
                  : 'bg-white border-slate-200/80 text-slate-600 hover:border-slate-300'
              }`}
            >
              <i className="fa-solid fa-list-ul text-[10px]"></i>
              <span>字母分組</span>
            </button>

            <button
              type="button"
              onClick={() => setFilterHasEmail(!filterHasEmail)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all flex items-center gap-1.5 cursor-pointer ${
                filterHasEmail
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                  : 'bg-white border-slate-200/80 text-slate-600 hover:border-slate-300'
              }`}
            >
              <i className="fa-regular fa-envelope text-[10px]"></i>
              <span>含 Email</span>
            </button>

            <button
              type="button"
              onClick={() => setFilterHasPhone(!filterHasPhone)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all flex items-center gap-1.5 cursor-pointer ${
                filterHasPhone
                  ? 'bg-sky-50 border-sky-200 text-sky-700'
                  : 'bg-white border-slate-200/80 text-slate-600 hover:border-slate-300'
              }`}
            >
              <i className="fa-solid fa-phone text-[10px]"></i>
              <span>含電話</span>
            </button>

            {onStandardizeCountries && cards.length > 0 && (
              <button
                type="button"
                onClick={onStandardizeCountries}
                className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-white hover:bg-indigo-50 text-slate-600 hover:text-indigo-700 border border-slate-200/80 hover:border-indigo-200 flex items-center gap-1.5 transition-all cursor-pointer"
                title="一鍵將國別欄位標準化為 QS 197 國規範（如 Taiwan SAR）"
              >
                <i className="fa-solid fa-globe text-[10px] text-indigo-500"></i>
                <span>標準化國別</span>
              </button>
            )}

            {filterCountry !== 'all' && (
              <button
                type="button"
                onClick={() => setFilterCountry('all')}
                className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center gap-1.5 hover:bg-indigo-100 transition-all cursor-pointer"
              >
                <span>{filterCountry === '__empty__' ? '未標註國別' : getCountryBilingualLabel(filterCountry)}</span>
                <i className="fa-solid fa-xmark text-[10px]"></i>
              </button>
            )}

            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetAllFilters}
                className="px-2.5 py-1 rounded-lg text-[11px] font-semibold text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 flex items-center gap-1 transition-all cursor-pointer"
              >
                <i className="fa-solid fa-rotate-left text-[10px]"></i>
                <span>重設條件</span>
              </button>
            )}

            {cards.length > 0 && (
              <>
                <div className="h-3.5 w-px bg-slate-200 mx-1 hidden sm:block" />
                <button
                  type="button"
                  onClick={() => onSelectBatch?.(filteredCards.map(c => c.id))}
                  className="px-2.5 py-1 bg-white hover:bg-slate-50 text-slate-600 text-[11px] font-semibold rounded-lg border border-slate-200/80 transition-colors cursor-pointer"
                >
                  勾選目前結果 ({filteredCards.length})
                </button>
                <button
                  type="button"
                  onClick={() => onSelectBatch?.(cards.filter(c => c.category !== 'other').map(c => c.id))}
                  className="px-2.5 py-1 bg-white hover:bg-slate-50 text-slate-600 text-[11px] font-semibold rounded-lg border border-slate-200/80 transition-colors cursor-pointer"
                >
                  勾選全部 QS
                </button>
                {selectedCardIds.size > 0 && (
                  <button
                    type="button"
                    onClick={() => onDeselectAll?.()}
                    className="px-2 py-1 text-slate-400 hover:text-rose-600 text-[11px] font-semibold transition-colors cursor-pointer"
                  >
                    取消勾選
                  </button>
                )}
              </>
            )}
          </div>

          <div className="text-[11px] font-medium text-slate-400 tabular-nums ml-auto">
            顯示 <span className="font-bold text-slate-700">{filteredCards.length}</span> / {cards.length} 筆
          </div>
        </div>
      </header>

      {/* 2. Content Area */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-4 md:px-6 py-5 custom-scrollbar relative">
        {cards.length === 0 ? (
          /* First-time / Empty Database Welcome State */
          <div className="h-full min-h-[380px] flex flex-col items-center justify-center text-center max-w-lg mx-auto px-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-50 to-emerald-50 border border-slate-200/80 flex items-center justify-center text-emerald-600 shadow-xs mb-5">
              <i className="fa-solid fa-seedling text-2xl"></i>
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">開始建立您的三好永續智慧人脈庫</h2>
            <p className="text-sm text-slate-500 leading-relaxed mb-6">
              拖曳或上傳名片影像與 PDF，AI 將自動完成多卡框選、多語翻譯、QS 角色判讀與無紙化減碳紀錄；您也可以先載入示範名片體驗完整互動功能。
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2.5">
              {onAddNewCard && (
                <button
                  type="button"
                  onClick={onAddNewCard}
                  className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-sm transition-all cursor-pointer"
                >
                  <i className="fa-solid fa-cloud-arrow-up"></i>
                  <span>上傳名片或 PDF 掃描</span>
                </button>
              )}
              {onLoadDemoCards && (
                <button
                  type="button"
                  onClick={onLoadDemoCards}
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-sm transition-all cursor-pointer"
                >
                  <i className="fa-solid fa-wand-magic-sparkles"></i>
                  <span>載入 6 筆三好永續示範名片</span>
                </button>
              )}
              {onLoadFromNotion && (
                <button
                  type="button"
                  onClick={onLoadFromNotion}
                  className="px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold flex items-center gap-2 shadow-2xs transition-all cursor-pointer"
                >
                  <i className="fa-solid fa-cloud-arrow-down text-slate-400"></i>
                  <span>從 Notion 同步載入</span>
                </button>
              )}
            </div>
          </div>
        ) : filteredCards.length === 0 ? (
          /* Filtered Empty State */
          <div className="h-full min-h-[280px] flex flex-col items-center justify-center text-slate-400">
            <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 mb-3 shadow-2xs">
              <i className="fa-solid fa-magnifying-glass text-lg"></i>
            </div>
            <p className="text-sm font-semibold text-slate-700">找不到符合目前篩選條件的名片</p>
            <p className="text-xs text-slate-400 mt-1">請嘗試調整搜尋關鍵字，或清除套用的國家與分類條件</p>
            <button
              type="button"
              onClick={handleResetAllFilters}
              className="mt-4 px-4 py-2 bg-white hover:bg-slate-50 text-indigo-600 border border-slate-200 rounded-xl text-xs font-semibold shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <i className="fa-solid fa-rotate-left text-[11px]"></i>
              <span>重設所有篩選條件</span>
            </button>
          </div>
        ) : (
          <div className="space-y-7 pb-20 max-w-[1600px] mx-auto">
            {Object.entries(groupedCards).map(([groupTitle, groupItems]: [string, BusinessCardData[]]) => (
              <section key={groupTitle}>
                {/* Group Sticky-style Divider */}
                {(isGrouped && !sortBy.includes('date')) && (
                  <div className="flex items-center gap-3 mb-3">
                    <span className="px-2.5 py-0.5 rounded-md bg-slate-200/70 text-slate-700 font-bold text-xs tracking-wide">
                      {groupTitle}
                    </span>
                    <div className="h-px bg-slate-200/80 flex-1" />
                    <span className="text-[11px] font-medium text-slate-400 tabular-nums">{groupItems.length} 筆</span>
                  </div>
                )}

                {displayMode === 'table' ? (
                  /* --- CLEAN LINEAR-STYLE TABLE VIEW --- */
                  <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
                    <table className="w-full text-left border-collapse">
                      <thead className="bg-slate-50/80 border-b border-slate-200/80">
                        <tr>
                          <th className="px-3 py-2.5 text-center w-10">
                            <input
                              type="checkbox"
                              checked={allFilteredSelected}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  onSelectBatch?.(filteredCards.map(c => c.id));
                                } else if (filteredCards.length === selectedCardIds.size && onDeselectAll) {
                                  onDeselectAll();
                                } else {
                                  filteredCards.forEach(c => {
                                    if (selectedCardIds.has(c.id)) onToggleCard?.(c.id);
                                  });
                                }
                              }}
                              className="w-3.5 h-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer accent-indigo-600"
                              title="全選或取消全選"
                            />
                          </th>
                          <th className="px-2 py-2.5 w-14 text-[11px] font-semibold text-slate-500">名片</th>
                          <th className="px-4 py-2.5 text-[11px] font-semibold text-slate-500 w-[230px]">聯絡人與分類</th>
                          <th className="px-4 py-2.5 text-[11px] font-semibold text-slate-500">機構職稱 · AI 簡介</th>
                          <th className="px-4 py-2.5 text-[11px] font-semibold text-slate-500 hidden lg:table-cell w-[240px]">聯絡管道</th>
                          <th className="px-4 py-2.5 text-[11px] font-semibold text-slate-500 w-28 text-right">善緣互動</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {groupItems.map(card => {
                          const isExpanded = expandedRowIds.has(card.id);
                          const hasLongText = (card.summary && card.summary.length > 70) || Boolean(card.notes);
                          const queryHitsSummaryOrNotes = Boolean(
                            deferredQueryLower &&
                            ((card.summary && card.summary.toLowerCase().includes(deferredQueryLower)) ||
                             (card.notes && card.notes.toLowerCase().includes(deferredQueryLower)))
                          );
                          const showFullText = isExpanded || queryHitsSummaryOrNotes;
                          const displayCtry = normalizeCountry(card.country || card.translations?.country || '');
                          const primaryEmail = card.email ? String(card.email).split('/')[0].trim() : '';
                          const primaryPhone = card.phone ? String(card.phone).split('/')[0].trim() : '';

                          return (
                            <tr
                              key={card.id}
                              onClick={() => onSelectCard(card.id)}
                              style={{ contentVisibility: 'auto', containIntrinsicSize: '0 80px' }}
                              className={`group hover:bg-slate-50/90 cursor-pointer transition-colors align-top ${
                                selectedCardIds.has(card.id) ? 'bg-indigo-50/30' : ''
                              }`}
                            >
                              {/* Checkbox */}
                              <td className="px-3 py-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="checkbox"
                                  checked={selectedCardIds.has(card.id)}
                                  onChange={() => onToggleCard?.(card.id)}
                                  className="w-3.5 h-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer accent-indigo-600 mt-1"
                                  title="勾選至 QS 名單"
                                />
                              </td>

                              {/* Thumbnail */}
                              <td className="px-2 py-3.5">
                                <CardThumbnail card={card} size="md" />
                              </td>

                              {/* Name & Category */}
                              <td className="px-4 py-3.5">
                                <div className="text-sm font-bold text-slate-900 flex items-center gap-1.5 flex-wrap leading-snug">
                                  {(card.firstName || card.lastName) ? (
                                    <>
                                      <HighlightText text={card.lastName} matcher={highlightMatcher} />{' '}
                                      <HighlightText text={card.firstName} matcher={highlightMatcher} />
                                    </>
                                  ) : (
                                    <HighlightText text={card.company || '未命名名片'} matcher={highlightMatcher} />
                                  )}

                                  <span
                                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                      card.syncStatus === 'notion'
                                        ? 'bg-emerald-500'
                                        : card.syncStatus === 'firebase'
                                        ? 'bg-sky-500'
                                        : 'bg-amber-400'
                                    }`}
                                    title={
                                      card.syncStatus === 'notion'
                                        ? '已同步至 Notion'
                                        : card.syncStatus === 'firebase'
                                        ? '雲端圖片已備份'
                                        : '本機儲存'
                                    }
                                  />

                                  {duplicateCardIds?.has(card.id) && (
                                    <span className="text-[10px] px-1.5 py-0.2 rounded font-semibold bg-rose-50 text-rose-600 border border-rose-200/70">
                                      重複
                                    </span>
                                  )}
                                </div>

                                <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                                  <select
                                    value={card.category || 'employer'}
                                    onClick={(e) => e.stopPropagation()}
                                    onChange={(e) => {
                                      e.stopPropagation();
                                      onUpdateCardCategory?.(card.id, e.target.value as any);
                                    }}
                                    className={`text-[11px] font-semibold px-2 py-0.5 rounded-md border cursor-pointer transition-colors outline-none ${
                                      card.category === 'academic' ? 'bg-amber-50 text-amber-800 border-amber-200/80 hover:bg-amber-100/70' :
                                      card.category === 'staff' ? 'bg-emerald-50 text-emerald-800 border-emerald-200/80 hover:bg-emerald-100/70' :
                                      card.category === 'other' ? 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200/70' :
                                      'bg-blue-50 text-blue-800 border-blue-200/80 hover:bg-blue-100/70'
                                    }`}
                                  >
                                    <option value="employer">QS 雇主</option>
                                    <option value="academic">QS 學者</option>
                                    <option value="staff">QS 職員</option>
                                    <option value="other">非 QS</option>
                                  </select>

                                  {displayCtry && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setFilterCountry(displayCtry);
                                      }}
                                      title={`篩選 ${displayCtry}`}
                                      className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md border transition-all cursor-pointer ${
                                        filterCountry === displayCtry
                                          ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                          : 'bg-slate-50 hover:bg-indigo-50/60 text-slate-600 hover:text-indigo-700 border-slate-200/80'
                                      }`}
                                    >
                                      <HighlightText text={displayCtry} matcher={highlightMatcher} />
                                    </button>
                                  )}
                                </div>
                              </td>

                              {/* Company, Title & Clamped AI Summary */}
                              <td className="px-4 py-3.5">
                                <div className="flex items-baseline gap-2 flex-wrap">
                                  <span className="text-sm font-semibold text-slate-800">
                                    <HighlightText text={card.company || '未填寫機構'} matcher={highlightMatcher} />
                                  </span>
                                  {card.title && (
                                    <span className="text-xs text-slate-500">
                                      <HighlightText text={card.title} matcher={highlightMatcher} />
                                    </span>
                                  )}
                                </div>

                                {(card.summary || card.notes) && (
                                  <div className="mt-1.5 text-xs text-slate-600 leading-relaxed">
                                    {card.summary && (
                                      <div className={showFullText ? '' : 'line-clamp-1'}>
                                        <span className="text-[10px] font-semibold text-indigo-600 bg-indigo-50 px-1.5 py-0.2 rounded mr-1.5 border border-indigo-100/80">
                                          AI 簡介
                                        </span>
                                        <HighlightText text={card.summary} matcher={highlightMatcher} />
                                      </div>
                                    )}
                                    {card.notes && (showFullText || !card.summary) && (
                                      <div className={`mt-1 text-slate-500 ${showFullText ? '' : 'line-clamp-1'}`}>
                                        <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded mr-1.5 border border-amber-200/60">
                                          備註
                                        </span>
                                        <HighlightText text={card.notes} matcher={highlightMatcher} />
                                      </div>
                                    )}
                                    {hasLongText && !queryHitsSummaryOrNotes && (
                                      <button
                                        type="button"
                                        onClick={(e) => toggleExpandRow(e, card.id)}
                                        className="mt-0.5 text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 inline-flex items-center gap-1 cursor-pointer"
                                      >
                                        <span>{isExpanded ? '收合摘要' : '展開完整摘要'}</span>
                                        <i className={`fa-solid fa-chevron-${isExpanded ? 'up' : 'down'} text-[8px]`}></i>
                                      </button>
                                    )}
                                  </div>
                                )}
                              </td>

                              {/* Contact Column */}
                              <td className="px-4 py-3.5 hidden lg:table-cell">
                                <div className="space-y-1">
                                  {primaryEmail && (
                                    <button
                                      type="button"
                                      onClick={(e) => copyText(e, primaryEmail, ' Email')}
                                      className="text-xs text-slate-600 hover:text-indigo-600 flex items-center gap-1.5 max-w-[220px] truncate transition-colors cursor-pointer group/copy"
                                      title="點擊複製 Email"
                                    >
                                      <i className="fa-regular fa-envelope text-slate-400 text-[11px] shrink-0"></i>
                                      <span className="truncate"><HighlightText text={primaryEmail} matcher={highlightMatcher} /></span>
                                      <i className="fa-regular fa-copy text-[10px] opacity-0 group-hover/copy:opacity-70 shrink-0"></i>
                                    </button>
                                  )}
                                  {primaryPhone && (
                                    <button
                                      type="button"
                                      onClick={(e) => copyText(e, primaryPhone, '電話')}
                                      className="text-xs text-slate-600 hover:text-indigo-600 flex items-center gap-1.5 max-w-[220px] truncate transition-colors cursor-pointer group/copy"
                                      title="點擊複製電話"
                                    >
                                      <i className="fa-solid fa-phone text-slate-400 text-[10px] shrink-0"></i>
                                      <span className="truncate tabular-nums"><HighlightText text={primaryPhone} matcher={highlightMatcher} /></span>
                                      <i className="fa-regular fa-copy text-[10px] opacity-0 group-hover/copy:opacity-70 shrink-0"></i>
                                    </button>
                                  )}
                                  {!primaryEmail && !primaryPhone && (
                                    <span className="text-[11px] text-slate-300">—</span>
                                  )}
                                </div>
                              </td>

                              {/* Actions */}
                              <td className="px-4 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                                <div className="flex items-center justify-end gap-1">
                                  {onOpenWarmGreeting && (
                                    <button
                                      type="button"
                                      onClick={() => onOpenWarmGreeting(card)}
                                      className="px-2 py-1 rounded-lg text-[11px] font-semibold text-emerald-700 bg-emerald-50/80 hover:bg-emerald-100 border border-emerald-200/70 transition-all inline-flex items-center gap-1 cursor-pointer"
                                      title="AI 說好話・撰寫溫暖問候信"
                                    >
                                      <i className="fa-regular fa-paper-plane text-[10px]"></i>
                                      <span className="hidden sm:inline">問候</span>
                                    </button>
                                  )}
                                  {onDeleteCard && (
                                    <button
                                      type="button"
                                      onClick={(e) => onDeleteCard(e, card.id)}
                                      className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-300 hover:bg-rose-50 hover:text-rose-600 opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                                      title="刪除名片"
                                    >
                                      <i className="fa-regular fa-trash-can text-xs"></i>
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => onSelectCard(card.id)}
                                    className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 group-hover:text-indigo-600 transition-colors cursor-pointer"
                                    title="編輯名片詳情"
                                  >
                                    <i className="fa-solid fa-chevron-right text-xs"></i>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  /* --- BUSINESS CARD GRID WALL VIEW --- */
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {groupItems.map(card => {
                      const isSelected = selectedCardIds.has(card.id);
                      const displayCtry = normalizeCountry(card.country || card.translations?.country || '');
                      const primaryEmail = card.email ? String(card.email).split('/')[0].trim() : '';
                      const primaryPhone = card.phone ? String(card.phone).split('/')[0].trim() : '';
                      const displayName = (card.firstName || card.lastName)
                        ? `${card.lastName || ''} ${card.firstName || ''}`.trim()
                        : (card.company || '未命名名片');

                      return (
                        <div
                          key={card.id}
                          onClick={() => onSelectCard(card.id)}
                          style={{ contentVisibility: 'auto', containIntrinsicSize: '0 320px' }}
                          className={`group bg-white rounded-2xl border transition-all cursor-pointer flex flex-col overflow-hidden ${
                            isSelected
                              ? 'border-indigo-500 ring-2 ring-indigo-500/15 shadow-md'
                              : 'border-slate-200/90 hover:border-slate-300 hover:shadow-md shadow-2xs'
                          }`}
                        >
                          {/* Top Visual Card Preview (16:10) */}
                          <div className="relative aspect-[16/10] bg-slate-100 border-b border-slate-100 overflow-hidden flex items-center justify-center">
                            {card.imageUrl ? (
                              <img
                                src={card.imageUrl}
                                alt={displayName}
                                loading="lazy"
                                decoding="async"
                                referrerPolicy="no-referrer"
                                className="w-full h-full object-contain p-2 transition-transform duration-300 group-hover:scale-[1.02]"
                                style={card.rotation ? { transform: `rotate(${card.rotation}deg)` } : undefined}
                              />
                            ) : (
                              <div className="w-full h-full bg-gradient-to-br from-slate-50 via-white to-indigo-50/50 p-4 flex flex-col justify-between">
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider truncate max-w-[75%]">
                                    {card.company || 'DIGITAL CONTACT'}
                                  </span>
                                  <span className="w-7 h-7 rounded-lg bg-indigo-600/10 text-indigo-600 font-bold text-xs flex items-center justify-center">
                                    {displayName.charAt(0).toUpperCase()}
                                  </span>
                                </div>
                                <div>
                                  <div className="text-sm font-bold text-slate-800 truncate">{displayName}</div>
                                  <div className="text-[11px] text-slate-500 truncate">{card.title || card.department || ''}</div>
                                </div>
                              </div>
                            )}

                            {/* Overlay Checkbox Top-Left */}
                            <div
                              className="absolute top-2.5 left-2.5 z-10 bg-white/90 backdrop-blur-xs rounded-lg p-1 shadow-2xs border border-slate-200/70"
                              onClick={(e) => {
                                e.stopPropagation();
                                onToggleCard?.(card.id);
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => onToggleCard?.(card.id)}
                                className="w-3.5 h-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer accent-indigo-600 block"
                                title="勾選至 QS 名單"
                              />
                            </div>

                            {/* Overlay Badges Top-Right */}
                            <div className="absolute top-2.5 right-2.5 z-10 flex items-center gap-1">
                              {duplicateCardIds?.has(card.id) && (
                                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-rose-600 text-white shadow-2xs">
                                  重複
                                </span>
                              )}
                              <span
                                className={`text-[10px] font-semibold px-2 py-0.5 rounded-md backdrop-blur-xs border shadow-2xs ${
                                  card.category === 'academic' ? 'bg-amber-50/95 text-amber-800 border-amber-200' :
                                  card.category === 'staff' ? 'bg-emerald-50/95 text-emerald-800 border-emerald-200' :
                                  card.category === 'other' ? 'bg-slate-100/95 text-slate-700 border-slate-200' :
                                  'bg-blue-50/95 text-blue-800 border-blue-200'
                                }`}
                              >
                                {card.category === 'employer' ? 'QS 雇主' : card.category === 'academic' ? 'QS 學者' : card.category === 'staff' ? 'QS 職員' : '非 QS'}
                              </span>
                            </div>
                          </div>

                          {/* Card Body */}
                          <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                            <div>
                              <div className="flex items-start justify-between gap-2">
                                <h3 className="text-sm font-bold text-slate-900 leading-snug line-clamp-1">
                                  <HighlightText text={displayName} matcher={highlightMatcher} />
                                </h3>
                                {displayCtry && (
                                  <span className="text-[10px] font-medium text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded shrink-0">
                                    {displayCtry}
                                  </span>
                                )}
                              </div>
                              <div className="text-xs font-semibold text-slate-700 mt-0.5 line-clamp-1">
                                <HighlightText text={card.company || '未填寫機構'} matcher={highlightMatcher} />
                              </div>
                              {card.title && (
                                <div className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                                  <HighlightText text={card.title} matcher={highlightMatcher} />
                                </div>
                              )}

                              {card.summary && (
                                <p className="mt-2 text-xs text-slate-600 line-clamp-2 leading-relaxed bg-slate-50/80 p-2 rounded-lg border border-slate-100">
                                  <HighlightText text={card.summary} matcher={highlightMatcher} />
                                </p>
                              )}
                            </div>

                            {/* Footer Contact & Warm Greeting */}
                            <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2">
                              <div className="min-w-0 flex-1 space-y-0.5">
                                {primaryEmail ? (
                                  <div className="text-[11px] text-slate-500 truncate flex items-center gap-1">
                                    <i className="fa-regular fa-envelope text-[10px] text-slate-400"></i>
                                    <span className="truncate">{primaryEmail}</span>
                                  </div>
                                ) : primaryPhone ? (
                                  <div className="text-[11px] text-slate-500 truncate flex items-center gap-1">
                                    <i className="fa-solid fa-phone text-[10px] text-slate-400"></i>
                                    <span className="truncate">{primaryPhone}</span>
                                  </div>
                                ) : (
                                  <span className="text-[11px] text-slate-300">點擊檢視詳情</span>
                                )}
                              </div>

                              <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                                {onOpenWarmGreeting && (
                                  <button
                                    type="button"
                                    onClick={() => onOpenWarmGreeting(card)}
                                    className="px-2.5 py-1 rounded-lg text-[11px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/70 transition-colors flex items-center gap-1 cursor-pointer"
                                    title="AI 說好話・撰寫溫暖問候信"
                                  >
                                    <i className="fa-regular fa-paper-plane text-[10px]"></i>
                                    <span>問候</span>
                                  </button>
                                )}
                                {onDeleteCard && (
                                  <button
                                    type="button"
                                    onClick={(e) => onDeleteCard(e, card.id)}
                                    className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-300 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                                    title="刪除"
                                  >
                                    <i className="fa-regular fa-trash-can text-xs"></i>
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            ))}

            {hasMoreToRender && (
              <div ref={loadMoreSentinelRef} className="flex justify-center py-4">
                <button
                  type="button"
                  onClick={() => setRenderLimit(prev => Math.min(sortedCards.length, prev + 100))}
                  className="px-5 py-2 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold border border-slate-200 shadow-2xs transition-all cursor-pointer"
                >
                  載入更多名片（已顯示 {displayedCards.length} / {sortedCards.length} 筆）
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Floating QS Selection Dock */}
      {selectedCardIds.size > 0 && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40 bg-slate-900/95 backdrop-blur-md text-white px-4 py-2.5 rounded-2xl shadow-2xl border border-slate-700/80 flex items-center gap-3 animate-slideUp">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-indigo-500 flex items-center justify-center text-xs font-bold tabular-nums">
              {selectedCardIds.size}
            </span>
            <span className="text-xs font-medium text-slate-200 hidden sm:inline">位聯絡人已選取</span>
          </div>
          <button
            type="button"
            onClick={() => onOpenQsModal?.()}
            className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <i className="fa-solid fa-clipboard-check"></i>
            <span>審查名單與匯出</span>
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
