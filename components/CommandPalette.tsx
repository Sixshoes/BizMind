import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search,
  Database,
  LayoutPanelLeft,
  Plus,
  Camera,
  Layers,
  ClipboardCheck,
  BookOpen,
  RotateCcw,
  Sun,
  Moon,
  Sparkles,
  Leaf,
  CornerDownLeft,
  X,
} from 'lucide-react';
import { BusinessCardData } from '../types';
import { filterCards } from '../utils/cardFilters';
import { CardThumbnail } from './CardThumbnail';
import { ThemePreference } from '../utils/theme';

export interface CommandPaletteAction {
  id: string;
  label: string;
  hint?: string;
  icon: React.ReactNode;
  keywords?: string;
  onExecute: () => void;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  cards: BusinessCardData[];
  onSelectCard: (id: string) => void;
  onSwitchView: (mode: 'search' | 'detail') => void;
  onUpload: () => void;
  onOpenCamera: () => void;
  onOpenDuplicates: () => void;
  onOpenQsReview: () => void;
  onOpenGuide: () => void;
  onStartTour: () => void;
  onOpenImpact: () => void;
  theme: ThemePreference;
  onCycleTheme: () => void;
  duplicateCount: number;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  cards,
  onSelectCard,
  onSwitchView,
  onUpload,
  onOpenCamera,
  onOpenDuplicates,
  onOpenQsReview,
  onOpenGuide,
  onStartTour,
  onOpenImpact,
  theme,
  onCycleTheme,
  duplicateCount,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 20);
    }
  }, [isOpen]);

  const actions = useMemo<CommandPaletteAction[]>(
    () => [
      {
        id: 'upload',
        label: '新增或上傳名片 / PDF',
        hint: '支援批次與多頁智慧裁切',
        icon: <Plus className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />,
        keywords: 'upload add pdf import 新增 上傳 匯入',
        onExecute: onUpload,
      },
      {
        id: 'camera',
        label: '開啟相機拍攝名片',
        hint: '支援展會連拍模式',
        icon: <Camera className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />,
        keywords: 'camera scan photo 拍照 掃描 相機',
        onExecute: onOpenCamera,
      },
      {
        id: 'view-search',
        label: '切換至「名片資料庫」',
        hint: `共 ${cards.length} 筆聯絡人`,
        icon: <Database className="w-4 h-4 text-slate-600 dark:text-slate-300" />,
        keywords: 'database search list 資料庫 清單 搜尋',
        onExecute: () => onSwitchView('search'),
      },
      {
        id: 'view-workspace',
        label: '切換至「審閱工作台」',
        hint: '雙面併排檢視與欄位編修',
        icon: <LayoutPanelLeft className="w-4 h-4 text-slate-600 dark:text-slate-300" />,
        keywords: 'workspace review detail 工作台 審閱 編輯',
        onExecute: () => onSwitchView('detail'),
      },
      {
        id: 'qs-review',
        label: '名單健檢與分類匯出',
        hint: '檢查必填欄位與匯出 .xlsx',
        icon: <ClipboardCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />,
        keywords: 'export excel review 健檢 匯出 報表',
        onExecute: onOpenQsReview,
      },
      {
        id: 'duplicates',
        label: '開啟重複名片管理',
        hint: duplicateCount > 0 ? `偵測到 ${duplicateCount} 筆可合併` : '檢查重複聯絡人',
        icon: <Layers className="w-4 h-4 text-amber-600 dark:text-amber-400" />,
        keywords: 'duplicate merge 重複 合併 清理',
        onExecute: onOpenDuplicates,
      },
      {
        id: 'theme',
        label: `切換介面外觀（目前：${
          theme === 'dark' ? '深色' : theme === 'system' ? '跟隨系統' : '淺色'
        }）`,
        hint: '淺色 / 深色 / 跟隨系統',
        icon:
          theme === 'dark' ? (
            <Moon className="w-4 h-4 text-indigo-400" />
          ) : (
            <Sun className="w-4 h-4 text-amber-500" />
          ),
        keywords: 'dark light theme appearance 深色 淺色 主題 外觀',
        onExecute: onCycleTheme,
      },
      {
        id: 'guide',
        label: '開啟完整使用教學指南',
        icon: <BookOpen className="w-4 h-4 text-slate-600 dark:text-slate-300" />,
        keywords: 'guide help manual tutorial 教學 手冊 說明',
        onExecute: onOpenGuide,
      },
      {
        id: 'tour',
        label: '重看互動步驟導覽',
        icon: <RotateCcw className="w-4 h-4 text-slate-600 dark:text-slate-300" />,
        keywords: 'tour onboarding 導覽 教學',
        onExecute: onStartTour,
      },
      {
        id: 'impact',
        label: '檢視無紙化減碳統計與 AI 揭露',
        icon: <Leaf className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />,
        keywords: 'co2 green sustainability ai 減碳 永續 揭露',
        onExecute: onOpenImpact,
      },
    ],
    [
      cards.length,
      duplicateCount,
      theme,
      onUpload,
      onOpenCamera,
      onSwitchView,
      onOpenQsReview,
      onOpenDuplicates,
      onCycleTheme,
      onOpenGuide,
      onStartTour,
      onOpenImpact,
    ]
  );

  const matchedCards = useMemo(() => {
    const q = query.trim();
    if (!q) return cards.slice(0, 5);
    return filterCards(cards, { searchText: q }).slice(0, 8);
  }, [cards, query]);

  const matchedActions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return actions.slice(0, 6);
    return actions.filter(
      (a) =>
        a.label.toLowerCase().includes(q) ||
        (a.hint || '').toLowerCase().includes(q) ||
        (a.keywords || '').toLowerCase().includes(q)
    );
  }, [actions, query]);

  const flatItems = useMemo(() => {
    const list: Array<
      { kind: 'card'; card: BusinessCardData } | { kind: 'action'; action: CommandPaletteAction }
    > = [];
    matchedCards.forEach((card) => list.push({ kind: 'card', card }));
    matchedActions.forEach((action) => list.push({ kind: 'action', action }));
    return list;
  }, [matchedCards, matchedActions]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) =>
          flatItems.length === 0 ? 0 : (prev + 1) % flatItems.length
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) =>
          flatItems.length === 0 ? 0 : (prev - 1 + flatItems.length) % flatItems.length
        );
      } else if (e.key === 'Enter' && flatItems[selectedIndex]) {
        e.preventDefault();
        const item = flatItems[selectedIndex];
        onClose();
        if (item.kind === 'card') {
          onSelectCard(item.card.id);
        } else {
          item.action.onExecute();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, flatItems, selectedIndex, onClose, onSelectCard]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.14 }}
          className="fixed inset-0 z-[9700] bg-slate-950/55 backdrop-blur-xs flex items-start justify-center pt-[12vh] px-4"
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label="快速搜尋與指令面板"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -8 }}
            transition={{ type: 'spring', stiffness: 460, damping: 34 }}
            className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden flex flex-col max-h-[70vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Search Input */}
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-200 dark:border-slate-800">
              <Search className="w-4.5 h-4.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="搜尋聯絡人姓名、公司、Email，或輸入功能指令..."
                className="flex-1 bg-transparent text-sm sm:text-[15px] text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
              <kbd className="hidden sm:inline-flex px-1.5 py-0.5 text-[11px] font-mono text-slate-400 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded">
                ESC
              </kbd>
            </div>

            {/* Results List */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-3">
              {flatItems.length === 0 ? (
                <div className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">
                  找不到符合「{query}」的名片或指令
                </div>
              ) : (
                <>
                  {matchedCards.length > 0 && (
                    <div>
                      <div className="px-2.5 py-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        {query.trim() ? `符合聯絡人 (${matchedCards.length})` : '最近掃描聯絡人'}
                      </div>
                      <div className="space-y-0.5 mt-0.5">
                        {matchedCards.map((card, idx) => {
                          const isSelected = selectedIndex === idx;
                          const displayName =
                            card.firstName || card.lastName
                              ? `${card.lastName || ''} ${card.firstName || ''}`.trim()
                              : card.company || '未知名片';
                          return (
                            <button
                              key={card.id}
                              type="button"
                              onMouseEnter={() => setSelectedIndex(idx)}
                              onClick={() => {
                                onClose();
                                onSelectCard(card.id);
                              }}
                              className={`w-full px-3 py-2 rounded-xl flex items-center gap-3 text-left transition-colors cursor-pointer ${
                                isSelected
                                  ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-900 dark:text-indigo-100'
                                  : 'text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                              }`}
                            >
                              <CardThumbnail card={card} size="sm" />
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-bold truncate">{displayName}</div>
                                <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                  {[card.company, card.title, card.email]
                                    .filter(Boolean)
                                    .join(' · ')}
                                </div>
                              </div>
                              {isSelected && (
                                <CornerDownLeft className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {matchedActions.length > 0 && (
                    <div>
                      <div className="px-2.5 py-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        快捷指令
                      </div>
                      <div className="space-y-0.5 mt-0.5">
                        {matchedActions.map((action, aIdx) => {
                          const flatIdx = matchedCards.length + aIdx;
                          const isSelected = selectedIndex === flatIdx;
                          return (
                            <button
                              key={action.id}
                              type="button"
                              onMouseEnter={() => setSelectedIndex(flatIdx)}
                              onClick={() => {
                                onClose();
                                action.onExecute();
                              }}
                              className={`w-full px-3 py-2 rounded-xl flex items-center justify-between gap-3 text-left transition-colors cursor-pointer ${
                                isSelected
                                  ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-900 dark:text-indigo-100'
                                  : 'text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                                  {action.icon}
                                </div>
                                <div className="min-w-0">
                                  <div className="text-sm font-semibold truncate">
                                    {action.label}
                                  </div>
                                  {action.hint && (
                                    <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                      {action.hint}
                                    </div>
                                  )}
                                </div>
                              </div>
                              {isSelected && (
                                <CornerDownLeft className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Footer hints */}
            <div className="px-4 py-2 bg-slate-50 dark:bg-slate-900/90 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <kbd className="px-1 py-0.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded font-mono">
                    ↑↓
                  </kbd>{' '}
                  選擇
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1 py-0.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded font-mono">
                    ↵
                  </kbd>{' '}
                  開啟
                </span>
              </div>
              <span className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400 font-medium">
                <Sparkles className="w-3 h-3" /> BizMind Spotlight
              </span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
