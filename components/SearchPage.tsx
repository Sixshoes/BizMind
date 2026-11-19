import React, { useState, useMemo, useCallback } from 'react';
import {
  Search,
  X,
  Globe,
  Sparkles,
  ArrowUpDown,
  Layers,
  Mail,
  Phone,
  RotateCcw,
  Tag,
  Award,
  QrCode,
  Send,
  Trash2,
  ChevronRight,
  FlipHorizontal2,
  Zap,
  FilterX,
  FileSpreadsheet,
  ClipboardCheck,
  RotateCw,
  Loader2,
} from 'lucide-react';
import { BusinessCardData, SearchPageState, SearchSortOption } from '../types';
import { filterCards } from '../utils/cardFilters';
import { normalizeCountry, getCountryBilingualLabel } from '../utils/countries';
import { getBoundQsSubmissionList } from '../utils/qsValidation';
import { CardThumbnail } from './CardThumbnail';

interface SearchPageProps {
  cards: BusinessCardData[];
  onSelectCard: (id: string) => void;
  onDeleteCard?: (e: React.MouseEvent, id: string) => void;
  onStandardizeCountries?: () => void;
  selectedCardIds?: Set<string>;
  onToggleCard?: (id: string) => void;
  onSelectBatch?: (ids: string[]) => void;
  onDeselectAll?: () => void;
  searchState?: SearchPageState;
  onSearchStateChange?: React.Dispatch<React.SetStateAction<SearchPageState>>;
  onUpdateCardCategory?: (
    id: string,
    category: 'employer' | 'academic' | 'staff' | 'other'
  ) => void;
  onOpenDuplicateModal?: () => void;
  onAutoDeduplicate?: () => void;
  duplicateGroupCount?: number;
  redundantDuplicateCount?: number;
  duplicateCardIds?: Set<string>;
  onOpenQrModal?: (card: BusinessCardData) => void;
  onOpenEmailDrawer?: (card: BusinessCardData) => void;
  onExportBoundQsList?: () => void;
  onReviewBoundQsList?: () => void;
  onAutoUprightAll?: () => void;
  onBatchReorganizeDualSide?: () => void;
  onLoadDemoCards?: () => void;
  dualSideReorgProgress?: { current: number; total: number } | null;
  isExporting?: boolean;
  isAutoUprighting?: boolean;
}

const HighlightText: React.FC<{ text?: string; highlight: string }> = ({ text, highlight }) => {
  if (!text) return null;
  const strText = String(text);
  if (!highlight || !highlight.trim()) return <>{strText}</>;

  const escapeRegExp = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const rawTerms = highlight.trim().split(/\s+/).filter(Boolean);
  if (rawTerms.length === 0) return <>{strText}</>;

  const escapedTerms = rawTerms.map(escapeRegExp);
  const regex = new RegExp(`(${escapedTerms.join('|')})`, 'gi');
  const parts = strText.split(regex);
  const lowerTermSet = new Set(rawTerms.map((t) => t.toLowerCase()));

  return (
    <span>
      {parts.map((part, i) =>
        lowerTermSet.has(part.toLowerCase()) ? (
          <mark key={i} className="bg-amber-200/90 text-slate-950 rounded-xs px-0.5 font-semibold">
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </span>
  );
};

const SearchPage: React.FC<SearchPageProps> = React.memo(
  ({
    cards,
    onSelectCard,
    onDeleteCard,
    onStandardizeCountries,
    selectedCardIds = new Set(),
    onToggleCard,
    onSelectBatch,
    onDeselectAll,
    searchState,
    onSearchStateChange,
    onUpdateCardCategory,
    onOpenDuplicateModal,
    onAutoDeduplicate,
    duplicateGroupCount = 0,
    redundantDuplicateCount = 0,
    duplicateCardIds = new Set(),
    onOpenQrModal,
    onOpenEmailDrawer,
    onExportBoundQsList,
    onReviewBoundQsList,
    onAutoUprightAll,
    onBatchReorganizeDualSide,
    onLoadDemoCards,
    dualSideReorgProgress = null,
    isExporting = false,
    isAutoUprighting = false,
  }) => {
    const [localState, setLocalState] = useState<SearchPageState>({
      query: '',
      sortBy: 'name_asc',
      isGrouped: true,
      filterHasEmail: false,
      filterHasPhone: false,
      filterHasBackImage: false,
      filterCategory: 'all',
      filterCountry: 'all',
      filterTag: 'all',
      filterSource: 'all',
      displayMode: 'table',
    });

    const state = searchState || localState;
    const updateState = useCallback(
      (patch: Partial<SearchPageState>) => {
        if (onSearchStateChange) {
          onSearchStateChange((prev) => ({ ...prev, ...patch }));
        } else {
          setLocalState((prev) => ({ ...prev, ...patch }));
        }
      },
      [onSearchStateChange]
    );

    const {
      query,
      sortBy,
      isGrouped,
      filterHasEmail,
      filterHasPhone,
      filterHasBackImage = false,
      filterCategory,
      filterCountry,
      filterTag = 'all',
      filterSource = 'all',
      displayMode = 'table',
    } = state;

    const dualSideCount = useMemo(
      () => cards.filter((c) => Boolean(c.backImageUrl)).length,
      [cards]
    );

    const categoryCounts = useMemo(() => {
      return {
        all: cards.length,
        employer: cards.filter((c) => c.category === 'employer').length,
        academic: cards.filter((c) => c.category === 'academic').length,
        staff: cards.filter((c) => c.category === 'staff').length,
        other: cards.filter((c) => c.category === 'other').length,
      };
    }, [cards]);

    const boundQs = useMemo(() => getBoundQsSubmissionList(cards), [cards]);

    const { countryStats, tagStats, sourceStats } = useMemo(() => {
      const cMap = new Map<string, number>();
      const tMap = new Map<string, number>();
      const sMap = new Map<string, number>();
      let emptyCount = 0;

      cards.forEach((c) => {
        const rawCtry = (c.country || c.translations?.country || '').trim();
        const ctry = normalizeCountry(rawCtry);
        if (ctry) cMap.set(ctry, (cMap.get(ctry) || 0) + 1);
        else emptyCount++;

        (c.tags || []).forEach((t) => {
          const cleanT = t.trim();
          if (cleanT) tMap.set(cleanT, (tMap.get(cleanT) || 0) + 1);
        });

        const cleanS = (c.source || '').trim();
        if (cleanS) sMap.set(cleanS, (sMap.get(cleanS) || 0) + 1);
      });

      return {
        countryStats: {
          list: Array.from(cMap.entries()).sort(
            (a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'zh-Hant')
          ),
          emptyCount,
        },
        tagStats: Array.from(tMap.entries()).sort((a, b) => b[1] - a[1]),
        sourceStats: Array.from(sMap.entries()).sort((a, b) => b[1] - a[1]),
      };
    }, [cards]);

    const handleResetAllFilters = useCallback(() => {
      const resetObj: SearchPageState = {
        query: '',
        sortBy: 'name_asc',
        isGrouped: true,
        filterHasEmail: false,
        filterHasPhone: false,
        filterHasBackImage: false,
        filterCategory: 'all',
        filterCountry: 'all',
        filterTag: 'all',
        filterSource: 'all',
      };
      if (onSearchStateChange) onSearchStateChange(resetObj);
      else setLocalState(resetObj);
    }, [onSearchStateChange]);

    const hasActiveFilters = Boolean(
      query.trim() !== '' ||
        filterCategory !== 'all' ||
        filterCountry !== 'all' ||
        (filterTag && filterTag !== 'all') ||
        (filterSource && filterSource !== 'all') ||
        filterHasEmail ||
        filterHasPhone ||
        filterHasBackImage ||
        sortBy !== 'name_asc'
    );

    const filteredCards = useMemo(() => {
      return filterCards(cards, {
        searchText: query,
        category: filterCategory,
        country: filterCountry,
        tag: filterTag,
        source: filterSource,
        requireEmail: filterHasEmail,
        requirePhone: filterHasPhone,
        requireBackImage: filterHasBackImage,
      });
    }, [
      cards,
      query,
      filterCategory,
      filterCountry,
      filterTag,
      filterSource,
      filterHasEmail,
      filterHasPhone,
      filterHasBackImage,
    ]);

    const sortedCards = useMemo(() => {
      return [...filteredCards].sort((a, b) => {
        switch (sortBy) {
          case 'name_asc': {
            const nameA = a.firstName || a.lastName ? a.lastName + a.firstName : a.company;
            const nameB = b.firstName || b.lastName ? b.lastName + b.firstName : b.company;
            return (nameA || '').localeCompare(nameB || '', 'zh-Hant');
          }
          case 'name_desc': {
            const nameAd = a.firstName || a.lastName ? a.lastName + a.firstName : a.company;
            const nameBd = b.firstName || b.lastName ? b.lastName + b.firstName : b.company;
            return (nameBd || '').localeCompare(nameAd || '', 'zh-Hant');
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

    const groupedCards = useMemo<Record<string, BusinessCardData[]>>(() => {
      if (!isGrouped || sortBy.includes('date')) return { All: sortedCards };

      const groups: Record<string, BusinessCardData[]> = {};

      sortedCards.forEach((card) => {
        let keyChar = '';
        if (sortBy.includes('company')) {
          keyChar = card.company?.charAt(0)?.toUpperCase() || '#';
        } else {
          keyChar = card.lastName
            ? card.lastName.charAt(0).toUpperCase()
            : card.company
            ? card.company.charAt(0).toUpperCase()
            : '#';
        }
        const groupKey = /[A-Z]/.test(keyChar) ? keyChar : '# (中文 / 其他)';
        if (!groups[groupKey]) groups[groupKey] = [];
        groups[groupKey].push(card);
      });

      const sortedKeys = Object.keys(groups).sort((a, b) => {
        if (a.startsWith('#') && !b.startsWith('#')) return 1;
        if (!a.startsWith('#') && b.startsWith('#')) return -1;
        return a.localeCompare(b);
      });

      const sortedGroups: Record<string, BusinessCardData[]> = {};
      sortedKeys.forEach((k) => (sortedGroups[k] = groups[k]));
      return sortedGroups;
    }, [sortedCards, isGrouped, sortBy]);

    return (
      <div className="flex flex-col h-full bg-slate-50 w-full overflow-hidden">
        {/* Control & Filter Header */}
        <div className="bg-white border-b border-slate-200 px-4 lg:px-6 py-3.5 flex flex-col gap-3 shrink-0 z-10">
          {/* Row 0: Verified Contact List Direct Export & Card Auto-Upright Strip */}
          {cards.length > 0 && (onExportBoundQsList || onReviewBoundQsList) && (
            <div
              id="qs-bound-banner"
              className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 bg-indigo-50/75 border border-indigo-200 rounded-xl px-4 py-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0">
                  <FileSpreadsheet className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-bold text-slate-900 flex items-center gap-1.5 flex-wrap tabular-nums leading-snug">
                    <span>完整聯絡人名冊</span>
                    <span className="text-indigo-700">· 可匯出共 {boundQs.readyCards.length} 筆</span>
                    <span className="text-slate-600 font-medium text-[13px]">
                      （企業夥伴 {boundQs.employerCards.length} · 學研專家{' '}
                      {boundQs.academicCards.length} · 機關社團 {boundQs.staffCards?.length || 0}）
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 flex-wrap">
                {onAutoUprightAll && (
                  <button
                    type="button"
                    disabled={isAutoUprighting}
                    onClick={onAutoUprightAll}
                    className="h-9 px-3 bg-white hover:bg-slate-50 disabled:opacity-50 text-slate-800 border border-slate-300 rounded-lg text-sm font-semibold transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                    title="自動偵測並將所有橫躺或方向錯誤的名片影像翻正"
                  >
                    {isAutoUprighting ? (
                      <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                    ) : (
                      <RotateCw className="w-4 h-4 text-slate-600" />
                    )}
                    <span>{isAutoUprighting ? '翻正處理中...' : '自動翻正名片'}</span>
                  </button>
                )}

                {onReviewBoundQsList && (
                  <button
                    type="button"
                    onClick={onReviewBoundQsList}
                    className="h-9 px-3 bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-300 rounded-lg text-sm font-semibold transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap tabular-nums"
                  >
                    <ClipboardCheck className="w-4 h-4" />
                    <span>
                      名單健檢與篩選匯出
                      {boundQs.auditIssues.length > 0 ? ` (${boundQs.auditIssues.length} 建議)` : ''}
                    </span>
                  </button>
                )}

                {onExportBoundQsList && (
                  <button
                    type="button"
                    disabled={isExporting || boundQs.readyCards.length === 0}
                    onClick={onExportBoundQsList}
                    className="h-9 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer whitespace-nowrap tabular-nums"
                  >
                    {isExporting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <FileSpreadsheet className="w-4 h-4" />
                    )}
                    <span>一鍵匯出完整名冊 ({boundQs.readyCards.length} 筆 .xlsx)</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Row 1: Segmented Category Tabs + Duplicate Alert */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl overflow-x-auto custom-scrollbar">
              {[
                { id: 'all', label: '全部名片', count: categoryCounts.all },
                { id: 'employer', label: '企業夥伴', count: categoryCounts.employer },
                { id: 'academic', label: '學研專家', count: categoryCounts.academic },
                { id: 'staff', label: '機關社團', count: categoryCounts.staff },
                { id: 'other', label: '一般聯絡人', count: categoryCounts.other },
              ].map((tab) => {
                const active = filterCategory === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => updateState({ filterCategory: tab.id as any })}
                    className={`px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap flex items-center gap-1.5 cursor-pointer tabular-nums ${
                      active
                        ? 'bg-white text-slate-900 shadow-2xs border border-slate-200'
                        : 'text-slate-700 hover:text-slate-950'
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span
                      className={`text-xs font-bold ${
                        active ? 'text-indigo-700' : 'text-slate-500'
                      }`}
                    >
                      {tab.count}
                    </span>
                  </button>
                );
              })}
            </div>

            {redundantDuplicateCount > 0 && (
              <div className="flex items-center justify-between gap-3 bg-amber-50 border border-amber-300 rounded-xl px-3.5 py-2 text-sm text-amber-950">
                <span className="font-semibold tabular-nums">
                  偵測到 {duplicateGroupCount} 組重複聯絡人（{redundantDuplicateCount} 筆可合併）
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  {onOpenDuplicateModal && (
                    <button
                      type="button"
                      onClick={onOpenDuplicateModal}
                      className="px-3 py-1 bg-white hover:bg-amber-100 text-amber-950 border border-amber-300 font-semibold rounded-lg text-xs transition-colors cursor-pointer whitespace-nowrap"
                    >
                      檢視明細
                    </button>
                  )}
                  {onAutoDeduplicate && (
                    <button
                      type="button"
                      onClick={onAutoDeduplicate}
                      className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-lg text-xs transition-colors flex items-center gap-1 cursor-pointer whitespace-nowrap"
                    >
                      <Zap className="w-3.5 h-3.5" />
                      <span>一鍵合併</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Row 2: Search Input + Multi-Dimensional Filters */}
          <div
            id="search-filter-bar"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2.5"
          >
            {/* Search Input */}
            <div className="relative sm:col-span-2 lg:col-span-4">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                className="w-full pl-9 pr-8 py-2 bg-white border border-slate-300 hover:border-slate-400 rounded-lg focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 outline-none transition-colors text-sm text-slate-900 placeholder:text-slate-500"
                placeholder="搜尋姓名、公司、職稱、Email、標籤或摘要..."
                value={query}
                onChange={(e) => updateState({ query: e.target.value })}
              />
              {query && (
                <button
                  type="button"
                  onClick={() => updateState({ query: '' })}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-800 cursor-pointer"
                  title="清除關鍵字"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Country Filter */}
            <div className="relative lg:col-span-2">
              <Globe className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
              <select
                value={filterCountry}
                onChange={(e) => updateState({ filterCountry: e.target.value })}
                className={`w-full pl-9 pr-6 py-2 border rounded-lg text-sm font-medium outline-none cursor-pointer transition-colors ${
                  filterCountry !== 'all'
                    ? 'bg-indigo-50 border-indigo-400 text-indigo-800 font-semibold'
                    : 'bg-white border-slate-300 text-slate-800 hover:border-slate-400'
                }`}
              >
                <option value="all">國家：全部 ({cards.length})</option>
                {countryStats.list.map(([countryName, count]) => (
                  <option key={countryName} value={countryName}>
                    {getCountryBilingualLabel(countryName)} ({count})
                  </option>
                ))}
                {countryStats.emptyCount > 0 && (
                  <option value="__empty__">未標註國家 ({countryStats.emptyCount})</option>
                )}
              </select>
            </div>

            {/* Source Filter */}
            <div className="relative lg:col-span-2">
              <Award className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
              <select
                value={filterSource}
                onChange={(e) => updateState({ filterSource: e.target.value })}
                className={`w-full pl-9 pr-6 py-2 border rounded-lg text-sm font-medium outline-none cursor-pointer transition-colors ${
                  filterSource !== 'all'
                    ? 'bg-indigo-50 border-indigo-400 text-indigo-800 font-semibold'
                    : 'bg-white border-slate-300 text-slate-800 hover:border-slate-400'
                }`}
              >
                <option value="all">活動來源：全部</option>
                {sourceStats.map(([src, count]) => (
                  <option key={src} value={src}>
                    {src} ({count})
                  </option>
                ))}
              </select>
            </div>

            {/* Tag Filter */}
            <div className="relative lg:col-span-2">
              <Tag className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
              <select
                value={filterTag}
                onChange={(e) => updateState({ filterTag: e.target.value })}
                className={`w-full pl-9 pr-6 py-2 border rounded-lg text-sm font-medium outline-none cursor-pointer transition-colors ${
                  filterTag !== 'all'
                    ? 'bg-indigo-50 border-indigo-400 text-indigo-800 font-semibold'
                    : 'bg-white border-slate-300 text-slate-800 hover:border-slate-400'
                }`}
              >
                <option value="all">自訂標籤：全部</option>
                {tagStats.map(([tag, count]) => (
                  <option key={tag} value={tag}>
                    {tag} ({count})
                  </option>
                ))}
              </select>
            </div>

            {/* Sort Option */}
            <div className="relative lg:col-span-2">
              <ArrowUpDown className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
              <select
                value={sortBy}
                onChange={(e) => updateState({ sortBy: e.target.value as SearchSortOption })}
                className="w-full pl-9 pr-6 py-2 bg-white border border-slate-300 hover:border-slate-400 rounded-lg text-sm font-medium text-slate-800 outline-none cursor-pointer"
              >
                <option value="name_asc">排序：姓名 (A–Z)</option>
                <option value="name_desc">排序：姓名 (Z–A)</option>
                <option value="company_asc">排序：公司 (A–Z)</option>
                <option value="date_desc">排序：最新掃描優先</option>
                <option value="date_asc">排序：最早掃描優先</option>
              </select>
            </div>
          </div>

          {/* Row 3: Quick Toggles & Selection Controls */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => updateState({ isGrouped: !isGrouped })}
                disabled={sortBy.includes('date')}
                className={`px-3 py-1.5 rounded-lg text-[13px] font-semibold border transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap disabled:opacity-40 ${
                  isGrouped && !sortBy.includes('date')
                    ? 'bg-indigo-50 border-indigo-300 text-indigo-800'
                    : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>字母分組</span>
              </button>

              <button
                type="button"
                onClick={() => updateState({ filterHasEmail: !filterHasEmail })}
                className={`px-3 py-1.5 rounded-lg text-[13px] font-semibold border transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                  filterHasEmail
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                    : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Mail className="w-3.5 h-3.5" />
                <span>含 Email</span>
              </button>

              <button
                type="button"
                onClick={() => updateState({ filterHasPhone: !filterHasPhone })}
                className={`px-3 py-1.5 rounded-lg text-[13px] font-semibold border transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                  filterHasPhone
                    ? 'bg-blue-50 border-blue-300 text-blue-800'
                    : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Phone className="w-3.5 h-3.5" />
                <span>含電話</span>
              </button>

              <button
                type="button"
                onClick={() => updateState({ filterHasBackImage: !filterHasBackImage })}
                className={`px-3 py-1.5 rounded-lg text-[13px] font-semibold border transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap tabular-nums ${
                  filterHasBackImage
                    ? 'bg-indigo-50 border-indigo-300 text-indigo-800'
                    : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                }`}
                title="僅顯示已上傳正反雙面影像的名片"
              >
                <FlipHorizontal2 className="w-3.5 h-3.5" />
                <span>雙面名片 ({dualSideCount})</span>
              </button>

              {dualSideCount > 0 && onBatchReorganizeDualSide && (
                <button
                  type="button"
                  disabled={Boolean(dualSideReorgProgress)}
                  onClick={onBatchReorganizeDualSide}
                  className="px-3 py-1.5 rounded-lg text-[13px] font-semibold bg-white hover:bg-indigo-50 text-indigo-800 border border-indigo-200 flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap tabular-nums disabled:opacity-60"
                  title="批次比對所有雙面名片：英文自動升主欄、中文存對照、斜線整合職稱，並彙整跨機構差異供確認"
                >
                  {dualSideReorgProgress ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                  ) : (
                    <FlipHorizontal2 className="w-3.5 h-3.5 text-indigo-600" />
                  )}
                  <span>
                    {dualSideReorgProgress
                      ? `雙面重整中 (${dualSideReorgProgress.current}/${dualSideReorgProgress.total})`
                      : '批次雙面重整'}
                  </span>
                </button>
              )}

              {onStandardizeCountries && (
                <button
                  type="button"
                  onClick={onStandardizeCountries}
                  className="px-3 py-1.5 rounded-lg text-[13px] font-semibold bg-white hover:bg-indigo-50 text-slate-700 hover:text-indigo-800 border border-slate-300 flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                  title="將所有名片國家名稱統一為標準 197 國格式"
                >
                  <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                  <span>標準化國家名稱</span>
                </button>
              )}

              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={handleResetAllFilters}
                  className="px-3 py-1.5 rounded-lg text-[13px] font-semibold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>重設篩選</span>
                </button>
              )}

              <div className="h-4 w-px bg-slate-300 mx-1 hidden sm:block" />

              <button
                type="button"
                onClick={() => onSelectBatch?.(filteredCards.map((c) => c.id))}
                className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 text-[13px] font-semibold rounded-lg border border-slate-300 transition-colors cursor-pointer whitespace-nowrap tabular-nums"
              >
                全選目前結果 ({filteredCards.length})
              </button>

              {selectedCardIds.size > 0 && (
                <button
                  type="button"
                  onClick={() => onDeselectAll?.()}
                  className="px-2.5 py-1.5 text-slate-600 hover:text-rose-700 text-[13px] font-semibold transition-colors cursor-pointer whitespace-nowrap"
                >
                  取消選取
                </button>
              )}
            </div>

            <div className="flex items-center gap-3 ml-auto">
              <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                <button
                  type="button"
                  onClick={() => updateState({ displayMode: 'table' })}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                    displayMode === 'table'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  表格清單
                </button>
                <button
                  type="button"
                  onClick={() => updateState({ displayMode: 'grid' })}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                    displayMode === 'grid'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  卡片牆
                </button>
              </div>
              <div className="text-sm font-medium text-slate-600 tabular-nums whitespace-nowrap">
                顯示 <strong className="text-slate-900 font-bold">{filteredCards.length}</strong> /{' '}
                {cards.length} 筆
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-6 custom-scrollbar relative">
          {cards.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto px-4">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center mb-3.5">
                <Sparkles className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-1.5">尚無名片資料</h3>
              <p className="text-sm text-slate-600 leading-relaxed mb-5">
                點擊右上角「新增名片」上傳圖檔或 PDF，或直接載入示範名片快速體驗雙面合併、AI 問候信與無紙化電子名片交換。
              </p>
              {onLoadDemoCards && (
                <button
                  type="button"
                  onClick={onLoadDemoCards}
                  className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition-colors flex items-center gap-2 cursor-pointer shadow-xs"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>載入 6 筆示範名片體驗功能</span>
                </button>
              )}
            </div>
          ) : filteredCards.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-500">
              <FilterX className="w-11 h-11 mb-3 text-slate-400" />
              <p className="text-base font-semibold text-slate-700">沒有找到符合篩選條件的名片</p>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={handleResetAllFilters}
                  className="mt-3.5 px-4 py-2.5 bg-indigo-50 text-indigo-700 rounded-lg text-sm font-semibold hover:bg-indigo-100 transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>重設所有篩選條件</span>
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-6 pb-20">
              {Object.entries(groupedCards).map(
                ([groupTitle, groupItems]: [string, BusinessCardData[]]) => (
                  <div key={groupTitle}>
                    {isGrouped && !sortBy.includes('date') && (
                      <div className="flex items-center gap-3 mb-3">
                        <span className="text-sm font-bold font-display text-indigo-800 bg-indigo-50 border border-indigo-200 px-3 py-1 rounded-lg">
                          {groupTitle}
                        </span>
                        <div className="h-px bg-slate-200 flex-1" />
                        <span className="text-sm font-medium text-slate-600 tabular-nums">
                          {groupItems.length} 筆
                        </span>
                      </div>
                    )}

                    {displayMode === 'grid' ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {groupItems.map((card) => {
                          const isSelected = selectedCardIds.has(card.id);
                          const displayCtry = normalizeCountry(
                            card.country || card.translations?.country || ''
                          );
                          const displayName =
                            card.firstName || card.lastName
                              ? `${card.lastName || ''} ${card.firstName || ''}`.trim()
                              : card.company || '未命名名片';
                          const primaryEmail = card.email
                            ? String(card.email).split('/')[0].trim()
                            : '';

                          return (
                            <div
                              key={card.id}
                              onClick={() => onSelectCard(card.id)}
                              className={`group bg-white rounded-2xl border transition-all cursor-pointer flex flex-col overflow-hidden ${
                                isSelected
                                  ? 'border-indigo-500 ring-2 ring-indigo-500/15 shadow-sm'
                                  : 'border-slate-200 hover:border-slate-300 hover:shadow-sm'
                              }`}
                            >
                              <div className="relative aspect-[16/10] bg-slate-100 border-b border-slate-100 overflow-hidden flex items-center justify-center">
                                {card.imageUrl ? (
                                  <img
                                    src={card.imageUrl}
                                    alt={displayName}
                                    loading="lazy"
                                    className="w-full h-full object-contain p-2"
                                    style={
                                      card.rotation
                                        ? { transform: `rotate(${card.rotation}deg)` }
                                        : undefined
                                    }
                                  />
                                ) : (
                                  <div className="w-full h-full bg-gradient-to-br from-slate-50 via-white to-indigo-50/60 p-4 flex flex-col justify-between">
                                    <span className="text-[11px] font-semibold text-slate-400 truncate">
                                      {card.company || 'BizMind Contact'}
                                    </span>
                                    <div>
                                      <div className="text-base font-bold text-slate-900 truncate">
                                        {displayName}
                                      </div>
                                      <div className="text-xs text-slate-500 truncate">
                                        {card.title || ''}
                                      </div>
                                    </div>
                                  </div>
                                )}

                                <div
                                  className="absolute top-2.5 left-2.5 z-10 bg-white/90 rounded-lg p-1 border border-slate-200"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onToggleCard?.(card.id);
                                  }}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => onToggleCard?.(card.id)}
                                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 cursor-pointer accent-indigo-600 block"
                                  />
                                </div>

                                <div className="absolute top-2.5 right-2.5 z-10 flex items-center gap-1">
                                  {card.backImageUrl && (
                                    <span
                                      className="px-1.5 py-0.5 rounded bg-slate-900/75 text-white text-[10px] font-semibold"
                                      title="雙面名片"
                                    >
                                      雙面
                                    </span>
                                  )}
                                  <span
                                    className={`text-[11px] font-semibold px-2 py-0.5 rounded-md border ${
                                      card.category === 'academic'
                                        ? 'bg-amber-50/95 text-amber-900 border-amber-300'
                                        : card.category === 'staff'
                                        ? 'bg-emerald-50/95 text-emerald-900 border-emerald-300'
                                        : card.category === 'other'
                                        ? 'bg-slate-100/95 text-slate-700 border-slate-300'
                                        : 'bg-blue-50/95 text-blue-900 border-blue-300'
                                    }`}
                                  >
                                    {card.category === 'employer'
                                      ? '企業夥伴'
                                      : card.category === 'academic'
                                      ? '學研專家'
                                      : card.category === 'staff'
                                      ? '機關社團'
                                      : '一般聯絡人'}
                                  </span>
                                </div>
                              </div>

                              <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                                <div>
                                  <div className="flex items-center justify-between gap-2">
                                    <h4 className="text-base font-bold text-slate-900 truncate">
                                      <HighlightText text={displayName} highlight={query} />
                                    </h4>
                                    {displayCtry && (
                                      <span className="text-xs text-slate-500 shrink-0">
                                        {displayCtry}
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-sm font-medium text-slate-700 truncate mt-0.5">
                                    <HighlightText text={card.company} highlight={query} />
                                  </div>
                                  {card.title && (
                                    <div className="text-xs text-slate-500 truncate mt-0.5">
                                      <HighlightText text={card.title} highlight={query} />
                                    </div>
                                  )}
                                  {card.summary && (
                                    <p className="mt-2 text-xs text-slate-600 line-clamp-2 leading-relaxed">
                                      <HighlightText text={card.summary} highlight={query} />
                                    </p>
                                  )}
                                </div>

                                <div
                                  className="pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <span className="text-xs text-slate-500 font-mono truncate">
                                    {primaryEmail || card.phone || '點擊檢視'}
                                  </span>
                                  <div className="flex items-center gap-1 shrink-0">
                                    {onOpenQrModal && (
                                      <button
                                        type="button"
                                        onClick={() => onOpenQrModal(card)}
                                        className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-500 hover:bg-indigo-50 hover:text-indigo-700 cursor-pointer"
                                        title="顯示 QR 電子名片"
                                      >
                                        <QrCode className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                    {onOpenEmailDrawer && (
                                      <button
                                        type="button"
                                        onClick={() => onOpenEmailDrawer(card)}
                                        className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-500 hover:bg-indigo-50 hover:text-indigo-700 cursor-pointer"
                                        title="AI 撰寫問候跟進信"
                                      >
                                        <Send className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                      <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-50 border-b border-slate-200">
                          <tr>
                            <th className="px-3 py-3 text-center w-11">
                              <input
                                type="checkbox"
                                checked={
                                  groupItems.length > 0 &&
                                  groupItems.every((c) => selectedCardIds.has(c.id))
                                }
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    onSelectBatch?.(groupItems.map((c) => c.id));
                                  } else {
                                    groupItems.forEach((c) => {
                                      if (selectedCardIds.has(c.id)) {
                                        onToggleCard?.(c.id);
                                      }
                                    });
                                  }
                                }}
                                className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer accent-indigo-600"
                                title="全選 / 取消此分組"
                              />
                            </th>
                            <th className="px-2 py-3 w-14" />
                            <th className="px-4 py-3 text-xs font-bold text-slate-700 tracking-wide">
                              聯絡人姓名 / 分類
                            </th>
                            <th className="px-4 py-3 text-xs font-bold text-slate-700 tracking-wide">
                              任職機構 · 職稱 · 來源與摘要
                            </th>
                            <th className="px-4 py-3 text-xs font-bold text-slate-700 tracking-wide hidden md:table-cell">
                              電子信箱 / 電話
                            </th>
                            <th className="px-4 py-3 text-xs font-bold text-slate-700 tracking-wide w-32 text-right">
                              快捷操作
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200/80">
                          {groupItems.map((card) => {
                            const displayCtry = normalizeCountry(
                              card.country || card.translations?.country || ''
                            );

                            return (
                              <tr
                                key={card.id}
                                onClick={() => onSelectCard(card.id)}
                                className={`group hover:bg-slate-50/90 cursor-pointer transition-colors ${
                                  selectedCardIds.has(card.id) ? 'bg-indigo-50/40' : ''
                                }`}
                              >
                                <td
                                  className="px-3 py-3.5 text-center align-top pt-4"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <input
                                    type="checkbox"
                                    checked={selectedCardIds.has(card.id)}
                                    onChange={() => onToggleCard?.(card.id)}
                                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer accent-indigo-600"
                                  />
                                </td>

                                <td className="px-2 py-3.5 align-top">
                                  <CardThumbnail card={card} size="md" className="rounded-md" />
                                </td>

                                <td className="px-4 py-3.5 align-top">
                                  <div className="text-[15px] font-bold text-slate-900 flex items-center gap-1.5 flex-wrap leading-snug">
                                    {card.firstName || card.lastName ? (
                                      <>
                                        <HighlightText text={card.lastName} highlight={query} />{' '}
                                        <HighlightText text={card.firstName} highlight={query} />
                                      </>
                                    ) : (
                                      <HighlightText
                                        text={card.company || '未知名片'}
                                        highlight={query}
                                      />
                                    )}
                                    {card.backImageUrl && (
                                      <span title="含雙面名片影像" className="text-slate-500">
                                        <FlipHorizontal2 className="w-4 h-4" />
                                      </span>
                                    )}
                                    {duplicateCardIds?.has(card.id) && (
                                      <span className="text-xs font-bold text-amber-700">
                                        · 重複
                                      </span>
                                    )}
                                  </div>

                                  <div className="mt-2" onClick={(e) => e.stopPropagation()}>
                                    <select
                                      value={card.category || 'employer'}
                                      onChange={(e) =>
                                        onUpdateCardCategory?.(card.id, e.target.value as any)
                                      }
                                      className={`text-xs font-semibold px-2.5 py-1 rounded-md border cursor-pointer outline-none ${
                                        card.category === 'academic'
                                          ? 'bg-amber-50 text-amber-900 border-amber-300'
                                          : card.category === 'staff'
                                          ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                                          : card.category === 'other'
                                          ? 'bg-slate-100 text-slate-800 border-slate-300'
                                          : 'bg-blue-50 text-blue-900 border-blue-300'
                                      }`}
                                    >
                                      <option value="employer">企業夥伴 (Business)</option>
                                      <option value="academic">學研專家 (Academic)</option>
                                      <option value="staff">機關社團 (Organization)</option>
                                      <option value="other">一般聯絡人 (General)</option>
                                    </select>
                                  </div>
                                </td>

                                <td className="px-4 py-3.5 align-top">
                                  <div className="text-[15px] font-semibold text-slate-900 leading-snug">
                                    <HighlightText text={card.company} highlight={query} />
                                  </div>

                                  {/* Zero-Pill Static Metadata Row */}
                                  <div className="text-[13px] text-slate-700 mt-1 flex items-center gap-1.5 flex-wrap leading-relaxed">
                                    {card.title && (
                                      <span className="font-medium">
                                        <HighlightText text={card.title} highlight={query} />
                                      </span>
                                    )}
                                    {displayCtry && (
                                      <>
                                        {card.title && <span className="text-slate-400">·</span>}
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            updateState({ filterCountry: displayCtry });
                                          }}
                                          className="text-indigo-700 hover:underline font-semibold cursor-pointer"
                                          title={`篩選國家：${displayCtry}`}
                                        >
                                          <HighlightText
                                            text={getCountryBilingualLabel(displayCtry)}
                                            highlight={query}
                                          />
                                        </button>
                                      </>
                                    )}
                                    {card.source && card.source !== 'BizMind' && (
                                      <>
                                        <span className="text-slate-400">·</span>
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            updateState({ filterSource: card.source });
                                          }}
                                          className="text-slate-600 hover:text-indigo-700 hover:underline cursor-pointer"
                                          title={`篩選活動來源：${card.source}`}
                                        >
                                          來源：<HighlightText text={card.source} highlight={query} />
                                        </button>
                                      </>
                                    )}
                                  </div>

                                  {card.tags && card.tags.length > 0 && (
                                    <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                                      {card.tags.map((t) => (
                                        <button
                                          key={t}
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            updateState({ filterTag: t });
                                          }}
                                          className="text-xs font-semibold text-indigo-800 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-2 py-0.5 rounded transition-colors cursor-pointer"
                                          title={`篩選標籤：${t}`}
                                        >
                                          #<HighlightText text={t} highlight={query} />
                                        </button>
                                      ))}
                                    </div>
                                  )}

                                  {card.summary && (
                                    <p className="mt-1.5 text-[13px] text-slate-700 leading-relaxed line-clamp-2">
                                      <HighlightText text={card.summary} highlight={query} />
                                    </p>
                                  )}

                                  {card.notes && (
                                    <p className="mt-1 text-[13px] text-amber-900 leading-relaxed line-clamp-1">
                                      備註：<HighlightText text={card.notes} highlight={query} />
                                    </p>
                                  )}
                                </td>

                                <td className="px-4 py-3.5 hidden md:table-cell align-top">
                                  {card.email && (
                                    <div className="text-[13px] text-slate-800 font-mono truncate max-w-[230px]">
                                      <HighlightText
                                        text={String(card.email).split('/')[0].trim()}
                                        highlight={query}
                                      />
                                    </div>
                                  )}
                                  {card.phone && (
                                    <div className="text-[13px] text-slate-600 font-mono tabular-nums mt-1 truncate max-w-[230px]">
                                      <HighlightText
                                        text={String(card.phone).split('/')[0].trim()}
                                        highlight={query}
                                      />
                                    </div>
                                  )}
                                </td>

                                <td
                                  className="px-4 py-3.5 text-right align-top"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <div className="flex items-center justify-end gap-1">
                                    {onOpenQrModal && (
                                      <button
                                        type="button"
                                        onClick={() => onOpenQrModal(card)}
                                        className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:bg-indigo-50 hover:text-indigo-700 transition-colors cursor-pointer"
                                        title="顯示 vCard QR Code"
                                      >
                                        <QrCode className="w-4 h-4" />
                                      </button>
                                    )}
                                    {onOpenEmailDrawer && (
                                      <button
                                        type="button"
                                        onClick={() => onOpenEmailDrawer(card)}
                                        className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:bg-indigo-50 hover:text-indigo-700 transition-colors cursor-pointer"
                                        title="撰寫跟進開發信草稿"
                                      >
                                        <Send className="w-4 h-4" />
                                      </button>
                                    )}
                                    {onDeleteCard && (
                                      <button
                                        type="button"
                                        onClick={(e) => onDeleteCard(e, card.id)}
                                        className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:bg-rose-50 hover:text-rose-600 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity cursor-pointer"
                                        title="刪除名片"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => onSelectCard(card.id)}
                                      className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 group-hover:text-indigo-700 transition-colors cursor-pointer"
                                      title="開啟審閱詳情"
                                    >
                                      <ChevronRight className="w-4 h-4" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    )}
                  </div>
                )
              )}
            </div>
          )}
        </div>
      </div>
    );
  }
);

SearchPage.displayName = 'SearchPage';

export default SearchPage;