import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { motion } from 'motion/react';
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
  SlidersHorizontal,
  LayoutGrid,
  List,
  Copy,
  Check,
  Upload,
  CheckSquare,
  ChevronDown,
} from 'lucide-react';
import { BusinessCardData, SearchPageState, SearchSortOption } from '../types';
import { filterCards } from '../utils/cardFilters';
import { normalizeCountry, getCountryBilingualLabel } from '../utils/countries';
import { getBoundQsSubmissionList } from '../utils/qsValidation';
import { CardThumbnail } from './CardThumbnail';
import { OrientedCardImage } from './OrientedCardImage';
import { useToast } from './ToastProvider';

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
  onTriggerUpload?: () => void;
  dualSideReorgProgress?: { current: number; total: number } | null;
  isExporting?: boolean;
  isAutoUprighting?: boolean;
  searchInputRef?: React.RefObject<HTMLInputElement | null>;
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
          <mark
            key={i}
            className="bg-amber-200/90 dark:bg-amber-500/40 text-slate-950 dark:text-amber-100 rounded-xs px-0.5 font-semibold"
          >
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </span>
  );
};

const CATEGORY_TEXT_MAP: Record<BusinessCardData['category'], string> = {
  employer: '企業夥伴',
  academic: '學研專家',
  staff: '機關社團',
  other: '一般聯絡人',
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
    onTriggerUpload,
    dualSideReorgProgress = null,
    isExporting = false,
    isAutoUprighting = false,
    searchInputRef,
  }) => {
    const { addToast } = useToast();
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

    const [showFilterPopover, setShowFilterPopover] = useState(false);
    const [showRosterMenu, setShowRosterMenu] = useState(false);
    const [flippedCardIds, setFlippedCardIds] = useState<Set<string>>(new Set());
    const [copiedCardId, setCopiedCardId] = useState<string | null>(null);
    const [renderLimit, setRenderLimit] = useState(80);

    const filterPopoverRef = useRef<HTMLDivElement>(null);
    const rosterMenuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      const onClickOutside = (e: MouseEvent) => {
        if (filterPopoverRef.current && !filterPopoverRef.current.contains(e.target as Node)) {
          setShowFilterPopover(false);
        }
        if (rosterMenuRef.current && !rosterMenuRef.current.contains(e.target as Node)) {
          setShowRosterMenu(false);
        }
      };
      document.addEventListener('mousedown', onClickOutside);
      return () => document.removeEventListener('mousedown', onClickOutside);
    }, []);

    const state = searchState || localState;
    const updateState = useCallback(
      (patch: Partial<SearchPageState>) => {
        setRenderLimit(80);
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

    const categoryCounts = useMemo(
      () => ({
        all: cards.length,
        employer: cards.filter((c) => c.category === 'employer').length,
        academic: cards.filter((c) => c.category === 'academic').length,
        staff: cards.filter((c) => c.category === 'staff').length,
        other: cards.filter((c) => c.category === 'other').length,
      }),
      [cards]
    );

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
      setRenderLimit(80);
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
        displayMode,
      };
      if (onSearchStateChange) onSearchStateChange(resetObj);
      else setLocalState(resetObj);
    }, [onSearchStateChange, displayMode]);

    // Count active secondary filters for badge
    const advancedFilterCount = useMemo(() => {
      let count = 0;
      if (filterCountry !== 'all') count++;
      if (filterSource && filterSource !== 'all') count++;
      if (filterTag && filterTag !== 'all') count++;
      if (filterHasEmail) count++;
      if (filterHasPhone) count++;
      if (filterHasBackImage) count++;
      return count;
    }, [filterCountry, filterSource, filterTag, filterHasEmail, filterHasPhone, filterHasBackImage]);

    // Active dismissible filter chips
    const activeChips = useMemo(() => {
      const chips: { key: string; label: string; onRemove: () => void }[] = [];
      if (filterCountry !== 'all') {
        chips.push({
          key: 'country',
          label:
            filterCountry === '__empty__'
              ? '未標註國家'
              : `國家：${getCountryBilingualLabel(filterCountry)}`,
          onRemove: () => updateState({ filterCountry: 'all' }),
        });
      }
      if (filterSource && filterSource !== 'all') {
        chips.push({
          key: 'source',
          label: `來源：${filterSource}`,
          onRemove: () => updateState({ filterSource: 'all' }),
        });
      }
      if (filterTag && filterTag !== 'all') {
        chips.push({
          key: 'tag',
          label: `#${filterTag}`,
          onRemove: () => updateState({ filterTag: 'all' }),
        });
      }
      if (filterHasEmail) {
        chips.push({
          key: 'email',
          label: '含 Email',
          onRemove: () => updateState({ filterHasEmail: false }),
        });
      }
      if (filterHasPhone) {
        chips.push({
          key: 'phone',
          label: '含電話',
          onRemove: () => updateState({ filterHasPhone: false }),
        });
      }
      if (filterHasBackImage) {
        chips.push({
          key: 'back',
          label: '雙面名片',
          onRemove: () => updateState({ filterHasBackImage: false }),
        });
      }
      return chips;
    }, [
      filterCountry,
      filterSource,
      filterTag,
      filterHasEmail,
      filterHasPhone,
      filterHasBackImage,
      updateState,
    ]);

    const hasActiveFilters = Boolean(
      query.trim() !== '' || filterCategory !== 'all' || activeChips.length > 0 || sortBy !== 'name_asc'
    );

    const filteredCards = useMemo(
      () =>
        filterCards(cards, {
          searchText: query,
          category: filterCategory,
          country: filterCountry,
          tag: filterTag,
          source: filterSource,
          requireEmail: filterHasEmail,
          requirePhone: filterHasPhone,
          requireBackImage: filterHasBackImage,
        }),
      [
        cards,
        query,
        filterCategory,
        filterCountry,
        filterTag,
        filterSource,
        filterHasEmail,
        filterHasPhone,
        filterHasBackImage,
      ]
    );

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

    // Windowed slice for smooth 60fps performance even with 1000+ cards
    const renderedSlice = useMemo(() => sortedCards.slice(0, renderLimit), [sortedCards, renderLimit]);

    const groupedCards = useMemo<Record<string, BusinessCardData[]>>(() => {
      if (!isGrouped || sortBy.includes('date')) return { All: renderedSlice };

      const groups: Record<string, BusinessCardData[]> = {};
      renderedSlice.forEach((card) => {
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
    }, [renderedSlice, isGrouped, sortBy]);

    const toggleFlipCard = (e: React.MouseEvent, cardId: string) => {
      e.stopPropagation();
      setFlippedCardIds((prev) => {
        const next = new Set(prev);
        if (next.has(cardId)) next.delete(cardId);
        else next.add(cardId);
        return next;
      });
    };

    const handleQuickCopyContact = async (e: React.MouseEvent, card: BusinessCardData) => {
      e.stopPropagation();
      const target = card.email?.split('/')[0]?.trim() || card.phone?.split('/')[0]?.trim();
      if (!target) return;
      try {
        await navigator.clipboard.writeText(target);
        setCopiedCardId(card.id);
        addToast({ type: 'success', message: `已複製 ${target}`, duration: 2000 });
        setTimeout(() => setCopiedCardId((cur) => (cur === card.id ? null : cur)), 1800);
      } catch {
        addToast({ type: 'error', message: '複製失敗' });
      }
    };

    const allFilteredSelected =
      filteredCards.length > 0 && filteredCards.every((c) => selectedCardIds.has(c.id));

    return (
      <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 w-full overflow-hidden">
        {/* ============================================================
            STREAMLINED 2-ROW CONTROL HEADER (Reclaims ~40% more viewport)
           ============================================================ */}
        <div className="bg-white dark:bg-slate-900 border-b border-slate-200/90 dark:border-slate-800 px-4 lg:px-6 py-2.5 flex flex-col gap-2.5 shrink-0 z-10">
          {/* Row 1: Category Segmented Tabs + Compact Roster Capsule + Duplicate Pill + View Mode */}
          <div className="flex items-center justify-between gap-2.5 flex-wrap">
            {/* Animated Segmented Category Tabs */}
            <div className="flex items-center gap-0.5 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl overflow-x-auto custom-scrollbar max-w-full">
              {[
                { id: 'all', label: '全部', count: categoryCounts.all },
                { id: 'employer', label: '企業夥伴', count: categoryCounts.employer },
                { id: 'academic', label: '學研專家', count: categoryCounts.academic },
                { id: 'staff', label: '機關社團', count: categoryCounts.staff },
                { id: 'other', label: '一般', count: categoryCounts.other },
              ].map((tab) => {
                const active = filterCategory === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => updateState({ filterCategory: tab.id as any })}
                    className={`relative px-3 py-1.5 rounded-lg text-[13px] font-semibold transition-colors whitespace-nowrap flex items-center gap-1.5 cursor-pointer tabular-nums ${
                      active
                        ? 'text-slate-900 dark:text-white'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    {active && (
                      <motion.span
                        layoutId="search-category-pill"
                        transition={{ type: 'spring', stiffness: 460, damping: 34 }}
                        className="absolute inset-0 bg-white dark:bg-slate-700 rounded-lg shadow-xs border border-slate-200/80 dark:border-slate-600"
                      />
                    )}
                    <span className="relative z-10">{tab.label}</span>
                    <span
                      className={`relative z-10 text-xs font-bold ${
                        active
                          ? 'text-indigo-600 dark:text-indigo-300'
                          : 'text-slate-400 dark:text-slate-500'
                      }`}
                    >
                      {tab.count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Right Status Capsules: Duplicate Alert + Verified Roster Capsule + Display Switch */}
            <div className="flex items-center gap-2 ml-auto flex-wrap">
              {redundantDuplicateCount > 0 && (
                <div className="flex items-center gap-1.5 bg-amber-50 dark:bg-amber-950/50 border border-amber-300/90 dark:border-amber-800 rounded-xl pl-2.5 pr-1.5 py-1 text-xs text-amber-950 dark:text-amber-200">
                  <span className="font-semibold tabular-nums whitespace-nowrap">
                    {duplicateGroupCount} 組重複 ({redundantDuplicateCount})
                  </span>
                  {onOpenDuplicateModal && (
                    <button
                      type="button"
                      onClick={onOpenDuplicateModal}
                      className="px-2 py-0.5 bg-white dark:bg-slate-900 hover:bg-amber-100 dark:hover:bg-amber-900/60 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700 font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap"
                    >
                      檢視
                    </button>
                  )}
                  {onAutoDeduplicate && (
                    <button
                      type="button"
                      onClick={onAutoDeduplicate}
                      className="px-2 py-0.5 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-md transition-colors flex items-center gap-1 cursor-pointer whitespace-nowrap"
                    >
                      <Zap className="w-3 h-3" />
                      <span>合併</span>
                    </button>
                  )}
                </div>
              )}

              {/* Compact Verified Roster & Maintenance Pill (replaces tall Row 0 banner) */}
              {cards.length > 0 && (onExportBoundQsList || onReviewBoundQsList) && (
                <div className="relative" ref={rosterMenuRef} id="qs-bound-banner">
                  <div className="inline-flex items-center rounded-xl border border-indigo-200/90 dark:border-indigo-800/80 bg-indigo-50/75 dark:bg-indigo-950/45 overflow-hidden">
                    {onExportBoundQsList && (
                      <button
                        type="button"
                        disabled={isExporting || boundQs.readyCards.length === 0}
                        onClick={onExportBoundQsList}
                        className="h-8 px-3 text-xs font-bold text-indigo-800 dark:text-indigo-200 hover:bg-indigo-100/80 dark:hover:bg-indigo-900/60 disabled:opacity-50 flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap tabular-nums"
                        title={`一鍵匯出完整名冊（企業 ${boundQs.employerCards.length} · 學研 ${boundQs.academicCards.length} · 社團 ${boundQs.staffCards?.length || 0}）`}
                      >
                        {isExporting ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <FileSpreadsheet className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                        )}
                        <span>匯出完整名冊 ({boundQs.readyCards.length})</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setShowRosterMenu((p) => !p)}
                      className="h-8 px-2 border-l border-indigo-200/80 dark:border-indigo-800/80 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100/80 dark:hover:bg-indigo-900/60 flex items-center justify-center cursor-pointer transition-colors"
                      title="名單健檢與資料整理工具"
                      aria-label="名單健檢與資料整理工具"
                    >
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {showRosterMenu && (
                    <div className="absolute right-0 top-full mt-1.5 w-68 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 py-1.5 z-50 animate-fadeIn">
                      <div className="px-3.5 py-1.5 border-b border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                        完整名單：企業 {boundQs.employerCards.length} · 學研{' '}
                        {boundQs.academicCards.length} · 社團 {boundQs.staffCards?.length || 0}
                      </div>
                      {onReviewBoundQsList && (
                        <button
                          type="button"
                          onClick={() => {
                            setShowRosterMenu(false);
                            onReviewBoundQsList();
                          }}
                          className="w-full text-left px-3.5 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 flex items-center justify-between cursor-pointer"
                        >
                          <span className="flex items-center gap-2">
                            <ClipboardCheck className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                            <span>名單健檢與篩選匯出</span>
                          </span>
                          {boundQs.auditIssues.length > 0 && (
                            <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400">
                              {boundQs.auditIssues.length} 建議
                            </span>
                          )}
                        </button>
                      )}
                      {onAutoUprightAll && (
                        <button
                          type="button"
                          disabled={isAutoUprighting}
                          onClick={() => {
                            setShowRosterMenu(false);
                            onAutoUprightAll();
                          }}
                          className="w-full text-left px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 cursor-pointer disabled:opacity-50"
                        >
                          {isAutoUprighting ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                          ) : (
                            <RotateCw className="w-3.5 h-3.5 text-slate-500" />
                          )}
                          <span>{isAutoUprighting ? '翻正處理中...' : '自動翻正全部名片影像'}</span>
                        </button>
                      )}
                      {dualSideCount > 0 && onBatchReorganizeDualSide && (
                        <button
                          type="button"
                          disabled={Boolean(dualSideReorgProgress)}
                          onClick={() => {
                            setShowRosterMenu(false);
                            onBatchReorganizeDualSide();
                          }}
                          className="w-full text-left px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-between cursor-pointer disabled:opacity-50"
                        >
                          <span className="flex items-center gap-2">
                            {dualSideReorgProgress ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                            ) : (
                              <FlipHorizontal2 className="w-3.5 h-3.5 text-slate-500" />
                            )}
                            <span>
                              {dualSideReorgProgress
                                ? `雙面重整 (${dualSideReorgProgress.current}/${dualSideReorgProgress.total})`
                                : '批次雙面重整'}
                            </span>
                          </span>
                          <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 tabular-nums">
                            {dualSideCount}
                          </span>
                        </button>
                      )}
                      {onStandardizeCountries && (
                        <button
                          type="button"
                          onClick={() => {
                            setShowRosterMenu(false);
                            onStandardizeCountries();
                          }}
                          className="w-full text-left px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 cursor-pointer"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-slate-500" />
                          <span>標準化 197 國別名稱</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* View Mode Segmented Switch (Desktop/Tablet) */}
              <div className="hidden sm:flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200/80 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => updateState({ displayMode: 'table' })}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
                    displayMode === 'table'
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                  title="表格清單檢視"
                >
                  <List className="w-3.5 h-3.5" />
                  <span>清單</span>
                </button>
                <button
                  type="button"
                  onClick={() => updateState({ displayMode: 'grid' })}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
                    displayMode === 'grid'
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                  title="名片卡片牆檢視"
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span>卡片牆</span>
                </button>
              </div>
            </div>
          </div>

          {/* Row 2: Wide Search Input + Filter Popover + Sort + Select All + Result Counter */}
          <div id="search-filter-bar" className="flex items-center gap-2 flex-wrap">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                ref={searchInputRef}
                type="text"
                className="w-full h-9 pl-9 pr-14 bg-slate-50/70 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 rounded-xl focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-colors text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
                placeholder="搜尋姓名、公司、職稱、Email、標籤或摘要..."
                value={query}
                onChange={(e) => updateState({ query: e.target.value })}
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => updateState({ query: '' })}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                  title="清除關鍵字"
                >
                  <X className="w-4 h-4" />
                </button>
              ) : (
                <kbd className="hidden md:inline-flex absolute right-2.5 top-1/2 -translate-y-1/2 px-1.5 py-0.5 text-[10px] font-mono font-semibold text-slate-400 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded pointer-events-none">
                  /
                </kbd>
              )}
            </div>

            {/* Multi-Dimensional Filter Popover */}
            <div className="relative" ref={filterPopoverRef}>
              <button
                type="button"
                onClick={() => setShowFilterPopover((p) => !p)}
                className={`h-9 px-3 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                  advancedFilterCount > 0 || showFilterPopover
                    ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-300 dark:border-indigo-700 text-indigo-800 dark:text-indigo-200'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>條件篩選</span>
                {advancedFilterCount > 0 && (
                  <span className="px-1.5 py-0.5 bg-indigo-600 text-white rounded-full text-[11px] font-bold leading-none tabular-nums">
                    {advancedFilterCount}
                  </span>
                )}
              </button>

              {showFilterPopover && (
                <div className="absolute right-0 sm:left-0 sm:right-auto top-full mt-1.5 w-[310px] sm:w-[360px] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 p-4 z-50 space-y-3.5 animate-fadeIn">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                      多維度篩選條件
                    </span>
                    {advancedFilterCount > 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          updateState({
                            filterCountry: 'all',
                            filterSource: 'all',
                            filterTag: 'all',
                            filterHasEmail: false,
                            filterHasPhone: false,
                            filterHasBackImage: false,
                          })
                        }
                        className="text-xs font-semibold text-rose-600 dark:text-rose-400 hover:underline cursor-pointer"
                      >
                        重設條件
                      </button>
                    )}
                  </div>

                  {/* Country */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                      <Globe className="w-3 h-3" /> 國家 / 地區
                    </label>
                    <select
                      value={filterCountry}
                      onChange={(e) => updateState({ filterCountry: e.target.value })}
                      className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-800 dark:text-slate-200 outline-none cursor-pointer"
                    >
                      <option value="all">全部國家 ({cards.length})</option>
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

                  {/* Source */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                      <Award className="w-3 h-3" /> 活動 / 展會來源
                    </label>
                    <select
                      value={filterSource}
                      onChange={(e) => updateState({ filterSource: e.target.value })}
                      className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-800 dark:text-slate-200 outline-none cursor-pointer"
                    >
                      <option value="all">全部來源</option>
                      {sourceStats.map(([src, count]) => (
                        <option key={src} value={src}>
                          {src} ({count})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Tag */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                      <Tag className="w-3 h-3" /> 自訂標籤
                    </label>
                    <select
                      value={filterTag}
                      onChange={(e) => updateState({ filterTag: e.target.value })}
                      className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-800 dark:text-slate-200 outline-none cursor-pointer"
                    >
                      <option value="all">全部標籤</option>
                      {tagStats.map(([tag, count]) => (
                        <option key={tag} value={tag}>
                          #{tag} ({count})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Quick Boolean Toggles */}
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => updateState({ filterHasEmail: !filterHasEmail })}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors flex items-center gap-1 cursor-pointer ${
                        filterHasEmail
                          ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200'
                          : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      <Mail className="w-3 h-3" />
                      <span>含 Email</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => updateState({ filterHasPhone: !filterHasPhone })}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors flex items-center gap-1 cursor-pointer ${
                        filterHasPhone
                          ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-300 dark:border-blue-700 text-blue-800 dark:text-blue-200'
                          : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      <Phone className="w-3 h-3" />
                      <span>含電話</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => updateState({ filterHasBackImage: !filterHasBackImage })}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors flex items-center gap-1 cursor-pointer tabular-nums ${
                        filterHasBackImage
                          ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-300 dark:border-indigo-700 text-indigo-800 dark:text-indigo-200'
                          : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      <FlipHorizontal2 className="w-3 h-3" />
                      <span>雙面 ({dualSideCount})</span>
                    </button>
                    <button
                      type="button"
                      disabled={sortBy.includes('date')}
                      onClick={() => updateState({ isGrouped: !isGrouped })}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-40 ${
                        isGrouped && !sortBy.includes('date')
                          ? 'bg-slate-900 dark:bg-slate-100 border-slate-900 dark:border-slate-100 text-white dark:text-slate-900'
                          : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      <Layers className="w-3 h-3" />
                      <span>字母分組</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Sort Select */}
            <div className="relative">
              <ArrowUpDown className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <select
                value={sortBy}
                onChange={(e) => updateState({ sortBy: e.target.value as SearchSortOption })}
                className="h-9 pl-8 pr-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 outline-none cursor-pointer"
                aria-label="排序方式"
              >
                <option value="name_asc">姓名 (A–Z)</option>
                <option value="name_desc">姓名 (Z–A)</option>
                <option value="company_asc">公司 (A–Z)</option>
                <option value="date_desc">最新掃描</option>
                <option value="date_asc">最早掃描</option>
              </select>
            </div>

            {/* Select All / Clear Selection */}
            {filteredCards.length > 0 && (
              <button
                type="button"
                onClick={() =>
                  allFilteredSelected
                    ? onDeselectAll?.()
                    : onSelectBatch?.(filteredCards.map((c) => c.id))
                }
                className={`h-9 px-3 rounded-xl text-xs font-semibold border transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap tabular-nums ${
                  allFilteredSelected
                    ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-200'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <CheckSquare className="w-3.5 h-3.5" />
                <span className="hidden md:inline">
                  {allFilteredSelected ? '取消全選' : `全選 (${filteredCards.length})`}
                </span>
              </button>
            )}

            <div className="text-xs font-medium text-slate-500 dark:text-slate-400 tabular-nums whitespace-nowrap ml-auto hidden lg:block">
              顯示 <strong className="text-slate-900 dark:text-slate-100">{filteredCards.length}</strong> /{' '}
              {cards.length} 筆
            </div>
          </div>

          {/* Conditional Dismissible Filter Chips Strip (only appears when secondary filters active) */}
          {activeChips.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-slate-100 dark:border-slate-800">
              <span className="text-[11px] font-semibold text-slate-400">已套用篩選：</span>
              {activeChips.map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  onClick={chip.onRemove}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-200 border border-indigo-200/80 dark:border-indigo-800 hover:bg-rose-50 dark:hover:bg-rose-950/50 hover:text-rose-700 dark:hover:text-rose-300 hover:border-rose-200 transition-colors cursor-pointer"
                >
                  <span>{chip.label}</span>
                  <X className="w-3 h-3" />
                </button>
              ))}
              <button
                type="button"
                onClick={handleResetAllFilters}
                className="text-xs font-semibold text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 px-1.5 py-0.5 cursor-pointer"
              >
                全部清除
              </button>
            </div>
          )}
        </div>

        {/* ============================================================
            CONTENT AREA (Windowed Scroll + Responsive Grid / Table)
           ============================================================ */}
        <div
          className="flex-1 overflow-y-auto p-4 lg:p-6 custom-scrollbar relative"
          onScroll={(e) => {
            const target = e.currentTarget;
            if (target.scrollTop + target.clientHeight >= target.scrollHeight - 300) {
              if (renderLimit < sortedCards.length) {
                setRenderLimit((prev) => Math.min(sortedCards.length, prev + 80));
              }
            }
          }}
        >
          {cards.length === 0 ? (
            /* Actionable Empty State with Direct Upload Dropzone */
            <div className="h-full flex flex-col items-center justify-center text-center max-w-lg mx-auto px-4">
              <div
                onClick={onTriggerUpload}
                className={`w-full rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/70 p-8 sm:p-10 transition-colors ${
                  onTriggerUpload
                    ? 'hover:border-indigo-400 dark:hover:border-indigo-500 hover:bg-indigo-50/30 dark:hover:bg-indigo-950/20 cursor-pointer'
                    : ''
                }`}
              >
                <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-100 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto mb-4 shadow-2xs">
                  <Upload className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold font-display text-slate-900 dark:text-slate-100 mb-2">
                  開始建立您的智慧人脈庫
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-6">
                  直接拖曳名片照片 (JPG / PNG) 或多頁掃描 PDF 至此處，AI 將自動完成多卡框選、方向翻正、雙語對照與分類整理。
                </p>
                <div
                  className="flex items-center justify-center gap-2.5 flex-wrap"
                  onClick={(e) => e.stopPropagation()}
                >
                  {onTriggerUpload && (
                    <button
                      type="button"
                      onClick={onTriggerUpload}
                      className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition-colors flex items-center gap-2 cursor-pointer shadow-xs"
                    >
                      <Upload className="w-4 h-4" />
                      <span>選擇名片或 PDF</span>
                    </button>
                  )}
                  {onLoadDemoCards && (
                    <button
                      type="button"
                      onClick={onLoadDemoCards}
                      className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 text-slate-800 dark:text-slate-200 hover:text-indigo-700 dark:hover:text-indigo-300 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold transition-colors flex items-center gap-2 cursor-pointer"
                    >
                      <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      <span>載入 6 筆示範名片</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : filteredCards.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 dark:text-slate-400">
              <FilterX className="w-11 h-11 mb-3 text-slate-400" />
              <p className="text-base font-semibold text-slate-700 dark:text-slate-200">
                沒有找到符合篩選條件的名片
              </p>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={handleResetAllFilters}
                  className="mt-3.5 px-4 py-2 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 rounded-xl text-sm font-semibold hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>重設所有篩選條件</span>
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-6 pb-24">
              {Object.entries(groupedCards).map(
                ([groupTitle, groupItems]: [string, BusinessCardData[]]) => (
                  <div key={groupTitle}>
                    {isGrouped && !sortBy.includes('date') && (
                      <div className="flex items-center gap-3 mb-3">
                        <span className="text-xs font-bold font-display text-indigo-800 dark:text-indigo-200 bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-200/80 dark:border-indigo-800 px-2.5 py-0.5 rounded-lg">
                          {groupTitle}
                        </span>
                        <div className="h-px bg-slate-200/80 dark:bg-slate-800 flex-1" />
                        <span className="text-xs font-medium text-slate-500 dark:text-slate-400 tabular-nums">
                          {groupItems.length} 筆
                        </span>
                      </div>
                    )}

                    {/* Card Wall View (also auto-used on small mobile screens < 640px) */}
                    <div
                      className={
                        displayMode === 'grid'
                          ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'
                          : 'grid grid-cols-1 gap-3 sm:hidden'
                      }
                    >
                      {groupItems.map((card) => {
                        const isSelected = selectedCardIds.has(card.id);
                        const isFlipped = flippedCardIds.has(card.id);
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
                        const primaryPhone = card.phone
                          ? String(card.phone).split('/')[0].trim()
                          : '';

                        return (
                          <div
                            key={card.id}
                            onClick={() => onSelectCard(card.id)}
                            className={`group bg-white dark:bg-slate-900 rounded-2xl border transition-all duration-200 cursor-pointer flex flex-col overflow-hidden hover:-translate-y-0.5 ${
                              isSelected
                                ? 'border-indigo-500 ring-2 ring-indigo-500/20 shadow-md'
                                : 'border-slate-200/90 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-md'
                            }`}
                          >
                            {/* 3D Flip-capable Business Card Image Stage */}
                            <div className="relative aspect-[1.6/1] bg-slate-100 dark:bg-slate-800/80 border-b border-slate-100 dark:border-slate-800 overflow-hidden perspective-1000">
                              <div
                                className={`relative w-full h-full preserve-3d transition-transform duration-500 ${
                                  isFlipped ? 'rotate-y-180' : ''
                                }`}
                              >
                                {/* Front Face */}
                                <div className="absolute inset-0 backface-hidden">
                                  {card.imageUrl ? (
                                    <OrientedCardImage
                                      src={card.imageUrl}
                                      alt={displayName}
                                      rotation={card.rotation || 0}
                                      padding={10}
                                    />
                                  ) : (
                                    <div className="w-full h-full bg-gradient-to-br from-slate-50 via-white to-indigo-50/70 dark:from-slate-800 dark:via-slate-900 dark:to-indigo-950/60 p-4 flex flex-col justify-between">
                                      <span className="text-[11px] font-semibold text-slate-400 truncate">
                                        {card.company || 'BizMind Contact'}
                                      </span>
                                      <div>
                                        <div className="text-base font-bold text-slate-900 dark:text-slate-100 truncate">
                                          {displayName}
                                        </div>
                                        <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                          {card.title || ''}
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>

                                {/* Back Face (when dual-side) */}
                                {card.backImageUrl && (
                                  <div className="absolute inset-0 backface-hidden rotate-y-180 bg-slate-900">
                                    <OrientedCardImage
                                      src={card.backImageUrl}
                                      alt={`${displayName} 反面`}
                                      rotation={card.backRotation || 0}
                                      padding={10}
                                    />
                                  </div>
                                )}
                              </div>

                              {/* Checkbox Top-Left */}
                              <div
                                className="absolute top-2.5 left-2.5 z-10 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xs rounded-lg p-1 border border-slate-200 dark:border-slate-700 shadow-2xs"
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

                              {/* Category & 3D Flip Top-Right */}
                              <div className="absolute top-2.5 right-2.5 z-10 flex items-center gap-1">
                                {card.backImageUrl && (
                                  <button
                                    type="button"
                                    onClick={(e) => toggleFlipCard(e, card.id)}
                                    className={`px-2 py-0.5 rounded-md text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer shadow-xs ${
                                      isFlipped
                                        ? 'bg-indigo-600 text-white'
                                        : 'bg-slate-900/80 hover:bg-indigo-600 text-white'
                                    }`}
                                    title="點擊翻轉預覽正反面"
                                  >
                                    <FlipHorizontal2 className="w-3 h-3" />
                                    <span>{isFlipped ? '反面' : '翻面'}</span>
                                  </button>
                                )}
                                <span
                                  className={`text-[11px] font-semibold px-2 py-0.5 rounded-md border backdrop-blur-xs ${
                                    card.category === 'academic'
                                      ? 'bg-amber-50/95 dark:bg-amber-950/90 text-amber-900 dark:text-amber-200 border-amber-300 dark:border-amber-700'
                                      : card.category === 'staff'
                                      ? 'bg-emerald-50/95 dark:bg-emerald-950/90 text-emerald-900 dark:text-emerald-200 border-emerald-300 dark:border-emerald-700'
                                      : card.category === 'other'
                                      ? 'bg-slate-100/95 dark:bg-slate-800/90 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                                      : 'bg-blue-50/95 dark:bg-blue-950/90 text-blue-900 dark:text-blue-200 border-blue-300 dark:border-blue-700'
                                  }`}
                                >
                                  {CATEGORY_TEXT_MAP[card.category || 'employer']}
                                </span>
                              </div>
                            </div>

                            {/* Card Metadata & Quick Actions */}
                            <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                              <div>
                                <div className="flex items-center justify-between gap-2">
                                  <h4 className="text-[15px] font-bold text-slate-900 dark:text-slate-100 truncate">
                                    <HighlightText text={displayName} highlight={query} />
                                  </h4>
                                  {displayCtry && (
                                    <span className="text-xs text-slate-500 dark:text-slate-400 shrink-0">
                                      {displayCtry}
                                    </span>
                                  )}
                                </div>
                                <div className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate mt-0.5">
                                  <HighlightText text={card.company} highlight={query} />
                                </div>
                                {card.title && (
                                  <div className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                                    <HighlightText text={card.title} highlight={query} />
                                  </div>
                                )}
                                {card.summary && (
                                  <p className="mt-2 text-xs text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed">
                                    <HighlightText text={card.summary} highlight={query} />
                                  </p>
                                )}
                              </div>

                              <div
                                className="pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <button
                                  type="button"
                                  disabled={!primaryEmail && !primaryPhone}
                                  onClick={(e) => handleQuickCopyContact(e, card)}
                                  className="text-xs text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 font-mono truncate flex items-center gap-1 cursor-pointer disabled:cursor-default"
                                  title={
                                    primaryEmail || primaryPhone ? '點擊複製聯絡方式' : undefined
                                  }
                                >
                                  {copiedCardId === card.id ? (
                                    <Check className="w-3 h-3 text-emerald-500 shrink-0" />
                                  ) : primaryEmail || primaryPhone ? (
                                    <Copy className="w-3 h-3 opacity-50 shrink-0" />
                                  ) : null}
                                  <span className="truncate">
                                    {primaryEmail || primaryPhone || '點擊檢視詳情'}
                                  </span>
                                </button>
                                <div className="flex items-center gap-0.5 shrink-0">
                                  {onOpenQrModal && (
                                    <button
                                      type="button"
                                      onClick={() => onOpenQrModal(card)}
                                      className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-500 dark:text-slate-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 hover:text-indigo-700 dark:hover:text-indigo-300 cursor-pointer"
                                      title="顯示 QR 電子名片"
                                    >
                                      <QrCode className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                  {onOpenEmailDrawer && (
                                    <button
                                      type="button"
                                      onClick={() => onOpenEmailDrawer(card)}
                                      className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-500 dark:text-slate-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 hover:text-indigo-700 dark:hover:text-indigo-300 cursor-pointer"
                                      title="AI 撰寫問候跟進信"
                                    >
                                      <Send className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                  {onDeleteCard && (
                                    <button
                                      type="button"
                                      onClick={(e) => onDeleteCard(e, card.id)}
                                      className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 hover:text-rose-600 opacity-0 group-hover:opacity-100 focus:opacity-100 touch-visible transition-opacity cursor-pointer"
                                      title="刪除名片"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Desktop/Tablet Table View */}
                    {displayMode === 'table' && (
                      <div className="hidden sm:block bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 overflow-hidden shadow-2xs">
                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse">
                            <thead className="bg-slate-50/90 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800">
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
                                <th className="px-2 py-3 w-18" />
                                <th className="px-4 py-3 text-xs font-bold text-slate-600 dark:text-slate-300 tracking-wide">
                                  聯絡人姓名 / 分類
                                </th>
                                <th className="px-4 py-3 text-xs font-bold text-slate-600 dark:text-slate-300 tracking-wide">
                                  任職機構 · 職稱 · 來源與摘要
                                </th>
                                <th className="px-4 py-3 text-xs font-bold text-slate-600 dark:text-slate-300 tracking-wide hidden md:table-cell">
                                  電子信箱 / 電話
                                </th>
                                <th className="px-4 py-3 text-xs font-bold text-slate-600 dark:text-slate-300 tracking-wide w-36 text-right">
                                  快捷操作
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200/75 dark:divide-slate-800">
                              {groupItems.map((card) => {
                                const displayCtry = normalizeCountry(
                                  card.country || card.translations?.country || ''
                                );

                                return (
                                  <tr
                                    key={card.id}
                                    onClick={() => onSelectCard(card.id)}
                                    className={`group hover:bg-slate-50/90 dark:hover:bg-slate-800/50 cursor-pointer transition-colors ${
                                      selectedCardIds.has(card.id)
                                        ? 'bg-indigo-50/50 dark:bg-indigo-950/30'
                                        : ''
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
                                      <CardThumbnail card={card} size="md" />
                                    </td>

                                    <td className="px-4 py-3.5 align-top">
                                      <div className="text-[15px] font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5 flex-wrap leading-snug">
                                        {card.firstName || card.lastName ? (
                                          <>
                                            <HighlightText text={card.lastName} highlight={query} />{' '}
                                            <HighlightText
                                              text={card.firstName}
                                              highlight={query}
                                            />
                                          </>
                                        ) : (
                                          <HighlightText
                                            text={card.company || '未知名片'}
                                            highlight={query}
                                          />
                                        )}
                                        {card.backImageUrl && (
                                          <span
                                            title="含雙面名片影像"
                                            className="text-indigo-500 dark:text-indigo-400"
                                          >
                                            <FlipHorizontal2 className="w-3.5 h-3.5" />
                                          </span>
                                        )}
                                        {duplicateCardIds?.has(card.id) && (
                                          <span className="text-xs font-bold text-amber-700 dark:text-amber-400">
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
                                          className={`text-xs font-semibold px-2 py-0.5 rounded-md border cursor-pointer outline-none ${
                                            card.category === 'academic'
                                              ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 border-amber-300 dark:border-amber-700'
                                              : card.category === 'staff'
                                              ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-200 border-emerald-300 dark:border-emerald-700'
                                              : card.category === 'other'
                                              ? 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                                              : 'bg-blue-50 dark:bg-blue-950/60 text-blue-900 dark:text-blue-200 border-blue-300 dark:border-blue-700'
                                          }`}
                                        >
                                          <option value="employer">企業夥伴</option>
                                          <option value="academic">學研專家</option>
                                          <option value="staff">機關社團</option>
                                          <option value="other">一般聯絡人</option>
                                        </select>
                                      </div>
                                    </td>

                                    <td className="px-4 py-3.5 align-top">
                                      <div className="text-[15px] font-semibold text-slate-900 dark:text-slate-100 leading-snug">
                                        <HighlightText text={card.company} highlight={query} />
                                      </div>

                                      <div className="text-[13px] text-slate-600 dark:text-slate-300 mt-1 flex items-center gap-1.5 flex-wrap leading-relaxed">
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
                                              className="text-indigo-700 dark:text-indigo-400 hover:underline font-semibold cursor-pointer"
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
                                              className="text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline cursor-pointer"
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
                                              className="text-xs font-semibold text-indigo-800 dark:text-indigo-200 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 border border-indigo-200 dark:border-indigo-800 px-2 py-0.5 rounded transition-colors cursor-pointer"
                                              title={`篩選標籤：${t}`}
                                            >
                                              #<HighlightText text={t} highlight={query} />
                                            </button>
                                          ))}
                                        </div>
                                      )}

                                      {card.summary && (
                                        <p className="mt-1.5 text-[13px] text-slate-600 dark:text-slate-400 leading-relaxed line-clamp-2">
                                          <HighlightText text={card.summary} highlight={query} />
                                        </p>
                                      )}

                                      {card.notes && (
                                        <p className="mt-1 text-[13px] text-amber-800 dark:text-amber-300/90 leading-relaxed line-clamp-1">
                                          備註：<HighlightText text={card.notes} highlight={query} />
                                        </p>
                                      )}
                                    </td>

                                    <td
                                      className="px-4 py-3.5 hidden md:table-cell align-top"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      {card.email && (
                                        <button
                                          type="button"
                                          onClick={(e) => handleQuickCopyContact(e, card)}
                                          className="text-[13px] text-slate-800 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400 font-mono truncate max-w-[220px] block text-left cursor-pointer"
                                          title="點擊複製 Email"
                                        >
                                          <HighlightText
                                            text={String(card.email).split('/')[0].trim()}
                                            highlight={query}
                                          />
                                        </button>
                                      )}
                                      {card.phone && (
                                        <div className="text-[13px] text-slate-500 dark:text-slate-400 font-mono tabular-nums mt-1 truncate max-w-[220px]">
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
                                            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 dark:text-slate-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors cursor-pointer"
                                            title="顯示 vCard QR Code"
                                          >
                                            <QrCode className="w-4 h-4" />
                                          </button>
                                        )}
                                        {onOpenEmailDrawer && (
                                          <button
                                            type="button"
                                            onClick={() => onOpenEmailDrawer(card)}
                                            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 dark:text-slate-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors cursor-pointer"
                                            title="撰寫跟進開發信草稿"
                                          >
                                            <Send className="w-4 h-4" />
                                          </button>
                                        )}
                                        {onDeleteCard && (
                                          <button
                                            type="button"
                                            onClick={(e) => onDeleteCard(e, card.id)}
                                            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 hover:text-rose-600 opacity-0 group-hover:opacity-100 focus:opacity-100 touch-visible transition-opacity cursor-pointer"
                                            title="刪除名片"
                                          >
                                            <Trash2 className="w-4 h-4" />
                                          </button>
                                        )}
                                        <button
                                          type="button"
                                          onClick={() => onSelectCard(card.id)}
                                          className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors cursor-pointer"
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
                      </div>
                    )}
                  </div>
                )
              )}

              {/* Load More Button for Large Collections */}
              {renderLimit < sortedCards.length && (
                <div className="flex justify-center pt-2">
                  <button
                    type="button"
                    onClick={() => setRenderLimit((prev) => Math.min(sortedCards.length, prev + 100))}
                    className="px-5 py-2.5 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold shadow-2xs transition-colors cursor-pointer tabular-nums"
                  >
                    載入更多名片（尚有 {sortedCards.length - renderLimit} 筆）
                  </button>
                </div>
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
