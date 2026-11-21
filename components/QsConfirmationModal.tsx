import React, { useState, useMemo, useEffect } from 'react';
import {
  ClipboardCheck,
  Sparkles,
  X,
  Briefcase,
  GraduationCap,
  UserCheck,
  CheckCircle2,
  AlertTriangle,
  Search,
  Trash2,
  FileSpreadsheet,
  MoreVertical,
  SquarePen,
  Loader2,
  Users,
  ShieldCheck,
  Link2,
  ArrowRight,
} from 'lucide-react';
import { BusinessCardData, ExportMode } from '../types';
import { getCountryBilingualLabel } from '../utils/countries';
import {
  evaluateQsReadiness,
  getBoundQsSubmissionList,
  DEFAULT_CARD_SOURCE,
} from '../utils/qsValidation';
import { useConfirm } from './ConfirmDialogProvider';

interface QsConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCardIds: Set<string>;
  allCards: BusinessCardData[];
  onToggleCard: (id: string) => void;
  onSelectAll?: () => void;
  onBindCompliantList?: () => void;
  onAutoFixCategories?: () => Promise<void>;
  onDeselectAll: () => void;
  onUpdateCardCategory: (
    id: string,
    newCategory: 'employer' | 'academic' | 'staff' | 'other'
  ) => void;
  onStandardizeSelectedCountries: () => void;
  onExport: (mode: ExportMode, selectedCards: BusinessCardData[]) => Promise<void>;
  isExporting?: boolean;
  onOpenCardDetail?: (id: string) => void;
}

const CATEGORY_LABELS: Record<BusinessCardData['category'], string> = {
  employer: '企業夥伴 (Business)',
  academic: '學研專家 (Academic)',
  staff: '機關社團 (Organization)',
  other: '一般聯絡人 (General)',
};

export const QsConfirmationModal: React.FC<QsConfirmationModalProps> = ({
  isOpen,
  onClose,
  selectedCardIds,
  allCards,
  onToggleCard,
  onBindCompliantList,
  onAutoFixCategories,
  onDeselectAll,
  onUpdateCardCategory,
  onStandardizeSelectedCountries,
  onExport,
  isExporting,
  onOpenCardDetail,
}) => {
  const confirm = useConfirm();
  const [filterTab, setFilterTab] = useState<
    'all' | 'employer' | 'academic' | 'staff' | 'warning' | 'audit'
  >('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showExportOptions, setShowExportOptions] = useState(false);

  const boundSummary = useMemo(() => {
    return getBoundQsSubmissionList(allCards);
  }, [allCards]);

  const selectedCards = useMemo(() => {
    return allCards.filter((c) => selectedCardIds.has(c.id));
  }, [allCards, selectedCardIds]);

  const cardValidation = useMemo(() => {
    const map = new Map<string, string[]>();
    selectedCards.forEach((c) => {
      const check = evaluateQsReadiness(c);
      if (!check.isReady) {
        map.set(c.id, check.blockingReasons);
      }
    });
    return map;
  }, [selectedCards]);

  const stats = useMemo(() => {
    const employerCount = selectedCards.filter((c) => c.category === 'employer').length;
    const academicCount = selectedCards.filter((c) => c.category === 'academic').length;
    const staffCount = selectedCards.filter((c) => c.category === 'staff').length;
    const warningCount = Array.from(cardValidation.keys()).length;
    const readyCount = selectedCards.length - warningCount;
    return { employerCount, academicCount, staffCount, warningCount, readyCount };
  }, [selectedCards, cardValidation]);

  const displayedCards = useMemo(() => {
    return selectedCards.filter((c) => {
      if (filterTab === 'employer' && c.category !== 'employer') return false;
      if (filterTab === 'academic' && c.category !== 'academic') return false;
      if (filterTab === 'staff' && c.category !== 'staff') return false;
      if (filterTab === 'warning' && !cardValidation.has(c.id)) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const name = `${c.firstName || ''} ${c.lastName || ''}`.toLowerCase();
        const company = (c.company || '').toLowerCase();
        const title = (c.title || '').toLowerCase();
        const email = (c.email || '').toLowerCase();
        const country = (c.country || '').toLowerCase();
        return (
          name.includes(q) ||
          company.includes(q) ||
          title.includes(q) ||
          email.includes(q) ||
          country.includes(q)
        );
      }

      return true;
    });
  }, [selectedCards, filterTab, searchQuery, cardValidation]);

  const filteredAuditIssues = useMemo(() => {
    if (!searchQuery.trim()) return boundSummary.auditIssues;
    const q = searchQuery.toLowerCase().trim();
    return boundSummary.auditIssues.filter(({ card: c, audit }) => {
      const text = `${c.firstName} ${c.lastName} ${c.company} ${c.title} ${c.email} ${
        audit.reason || ''
      }`.toLowerCase();
      return text.includes(q);
    });
  }, [boundSummary.auditIssues, searchQuery]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 md:p-6 animate-fadeIn"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-6xl h-[90vh] max-h-[880px] flex flex-col overflow-hidden animate-scaleUp"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 bg-white shrink-0 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
              <ClipboardCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-bold font-display text-slate-900">
                  聯絡人名單健檢與分類匯出
                </h2>
              </div>
              <p className="text-sm text-slate-600 mt-0.5 tabular-nums leading-relaxed">
                全庫資料完整且已去重之有效聯絡人共{' '}
                <strong className="text-slate-900">{boundSummary.readyCards.length}</strong> 筆（企業夥伴{' '}
                {boundSummary.employerCards.length} 位 · 學研專家 {boundSummary.academicCards.length}{' '}
                位 · 機關社團 {boundSummary.staffCards?.length || 0} 位）
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end md:self-auto flex-wrap">
            {onBindCompliantList && (
              <button
                type="button"
                onClick={onBindCompliantList}
                className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 rounded-lg text-sm font-semibold transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap tabular-nums"
                title="一鍵勾選全庫資料完整的聯絡人名單"
              >
                <Link2 className="w-4 h-4" />
                <span>勾選完整名單 ({boundSummary.readyCards.length})</span>
              </button>
            )}

            {boundSummary.auditIssues.length > 0 && onAutoFixCategories && (
              <button
                type="button"
                onClick={onAutoFixCategories}
                className="px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-lg text-sm font-semibold transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap tabular-nums"
              >
                <Sparkles className="w-4 h-4 text-amber-700" />
                <span>一鍵修正分類建議 ({boundSummary.auditIssues.length})</span>
              </button>
            )}

            {stats.warningCount > 0 && (
              <button
                type="button"
                onClick={onStandardizeSelectedCountries}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-sm font-semibold transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                title="自動將國家別名標準化為 197 國規範格式"
              >
                <Sparkles className="w-4 h-4 text-indigo-600" />
                <span>國家標準化</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
              aria-label="關閉"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* KPI Metrics Strip */}
        <div className="bg-slate-50 border-b border-slate-200 px-5 py-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5 shrink-0">
          {[
            { label: '目前勾選數', val: `${selectedCards.length}`, Icon: Users, cls: 'text-slate-900' },
            {
              label: '企業夥伴',
              val: `${stats.employerCount}`,
              Icon: Briefcase,
              cls: 'text-blue-700',
            },
            {
              label: '學研專家',
              val: `${stats.academicCount}`,
              Icon: GraduationCap,
              cls: 'text-amber-700',
            },
            { label: '機關社團', val: `${stats.staffCount}`, Icon: UserCheck, cls: 'text-emerald-700' },
            {
              label: '欄位完整數',
              val: `${stats.readyCount}`,
              Icon: CheckCircle2,
              cls: 'text-emerald-700',
            },
            {
              label: '全庫資料健檢',
              val:
                boundSummary.auditIssues.length === 0
                  ? '0 異常'
                  : `${boundSummary.auditIssues.length} 待修`,
              Icon: boundSummary.auditIssues.length === 0 ? ShieldCheck : AlertTriangle,
              cls: boundSummary.auditIssues.length > 0 ? 'text-amber-700' : 'text-emerald-700',
            },
          ].map((m, idx) => {
            const IconComp = m.Icon;
            return (
              <div
                key={idx}
                className="bg-white px-3.5 py-2.5 rounded-xl border border-slate-200 flex items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-slate-600 truncate">{m.label}</div>
                  <div className={`text-lg font-bold font-display tabular-nums mt-0.5 ${m.cls}`}>
                    {m.val}
                  </div>
                </div>
                <IconComp className="w-4 h-4 text-slate-500 shrink-0" />
              </div>
            );
          })}
        </div>

        {/* Filter Bar */}
        <div className="px-5 py-3 border-b border-slate-200 bg-white flex flex-col md:flex-row items-center justify-between gap-3 shrink-0">
          <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
            {[
              { id: 'all', label: '全部已勾選', count: selectedCards.length },
              { id: 'employer', label: '企業夥伴', count: stats.employerCount },
              { id: 'academic', label: '學研專家', count: stats.academicCount },
              ...(stats.staffCount > 0
                ? [{ id: 'staff', label: '機關社團', count: stats.staffCount }]
                : []),
              ...(stats.warningCount > 0
                ? [{ id: 'warning', label: '待補欄位', count: stats.warningCount }]
                : []),
              {
                id: 'audit',
                label: '全庫分類健檢',
                count: boundSummary.auditIssues.length,
              },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setFilterTab(t.id as any)}
                className={`px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap tabular-nums ${
                  filterTab === t.id
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <span>{t.label}</span>
                <span className={filterTab === t.id ? 'text-slate-300' : 'text-slate-500'}>
                  ({t.count})
                </span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜尋姓名、機構、職稱或信箱..."
                className="w-full pl-9 pr-8 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:border-indigo-600 outline-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-800 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {selectedCards.length > 0 && filterTab !== 'audit' && (
              <button
                type="button"
                onClick={async () => {
                  const ok = await confirm({
                    title: '清除全部勾選名單',
                    message: `確定要取消勾選目前全部 ${selectedCards.length} 位聯絡人嗎？（不會刪除名片本身）`,
                    confirmLabel: '清除勾選',
                    variant: 'warning',
                  });
                  if (ok) onDeselectAll();
                }}
                className="px-3 py-2 text-sm font-semibold text-slate-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors shrink-0 flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <Trash2 className="w-4 h-4" />
                <span>清除勾選</span>
              </button>
            )}
          </div>
        </div>

        {/* Table Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-5 custom-scrollbar bg-slate-50/50">
          {filterTab === 'audit' ? (
            filteredAuditIssues.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8">
                <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mb-3">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-slate-900 mb-1.5">
                  全庫聯絡人分類健檢已全數通過
                </h3>
                <p className="text-sm text-slate-600 max-w-md leading-relaxed">
                  已自動檢查聯絡人姓名、機構與電子信箱完整性，目前無任何分類異常。
                </p>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold text-xs">
                      <tr>
                        <th className="py-3 px-3.5">聯絡人 / 機構</th>
                        <th className="py-3 px-3.5">職稱</th>
                        <th className="py-3 px-3.5">原分類 → 建議分類</th>
                        <th className="py-3 px-3.5">健檢原因說明</th>
                        <th className="py-3 px-3.5 text-right">單筆套用</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200/80">
                      {filteredAuditIssues.map(({ card: c, audit }) => (
                        <tr key={c.id} className="hover:bg-slate-50/80">
                          <td className="py-3 px-3.5 align-top">
                            <div className="font-bold text-slate-900">
                              {`${c.lastName || ''} ${c.firstName || ''}`.trim() ||
                                c.company ||
                                '未知名片'}
                            </div>
                            <div className="text-xs text-slate-600 mt-0.5">
                              {c.company || '未填機構'}
                            </div>
                          </td>
                          <td className="py-3 px-3.5 align-top text-slate-800">
                            <div>{c.title || '—'}</div>
                            {c.translations?.title && (
                              <div className="text-xs text-slate-600 mt-0.5">
                                {c.translations.title}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-3.5 align-top whitespace-nowrap">
                            <span className="inline-flex items-center gap-1.5 font-semibold text-slate-800">
                              <span>{CATEGORY_LABELS[audit.currentCategory]}</span>
                              <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                              <span className="text-indigo-700">
                                {CATEGORY_LABELS[audit.suggestedCategory]}
                              </span>
                            </span>
                          </td>
                          <td className="py-3 px-3.5 align-top text-slate-700 max-w-xs leading-relaxed">
                            {audit.reason}
                          </td>
                          <td className="py-3 px-3.5 align-top text-right whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => onUpdateCardCategory(c.id, audit.suggestedCategory)}
                              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                            >
                              套用修正
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          ) : selectedCards.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 p-8">
              <ClipboardCheck className="w-11 h-11 mb-3 text-slate-400" />
              <h3 className="text-base font-bold text-slate-900 mb-1.5">目前尚未勾選名單</h3>
              <p className="text-sm text-slate-600 max-w-md text-center mb-5 leading-relaxed">
                您可以直接點擊下方按鈕，自動選取全庫欄位完整的{' '}
                <strong className="text-slate-900">{boundSummary.readyCards.length} 筆</strong>
                聯絡人（企業夥伴 {boundSummary.employerCards.length} 位 · 學研專家{' '}
                {boundSummary.academicCards.length} 位 · 機關社團 {boundSummary.staffCards?.length || 0} 位）。
              </p>
              <div className="flex items-center gap-2.5 flex-wrap justify-center">
                {onBindCompliantList && (
                  <button
                    type="button"
                    onClick={onBindCompliantList}
                    className="px-4 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors flex items-center gap-1.5 cursor-pointer tabular-nums"
                  >
                    <Link2 className="w-4 h-4" />
                    <span>一鍵選取完整聯絡人名單 ({boundSummary.readyCards.length} 筆)</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 bg-white border border-slate-300 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  返回列表手動勾選
                </button>
              </div>
            </div>
          ) : displayedCards.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-600 p-8">
              <p className="text-sm font-semibold">在此篩選條件下沒有符合的名片</p>
              <button
                type="button"
                onClick={() => {
                  setFilterTab('all');
                  setSearchQuery('');
                }}
                className="mt-2.5 text-sm font-semibold text-indigo-700 hover:underline cursor-pointer"
              >
                重設篩選條件
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold text-xs">
                    <tr>
                      <th className="py-3 px-3 w-11 text-center">選取</th>
                      <th className="py-3 px-3">聯絡人</th>
                      <th className="py-3 px-3">職稱 / 部門</th>
                      <th className="py-3 px-3">公司 / 機構</th>
                      <th className="py-3 px-3">國家/地區</th>
                      <th className="py-3 px-3">Email</th>
                      <th className="py-3 px-3">聯絡人分類</th>
                      <th className="py-3 px-3">欄位狀態</th>
                      <th className="py-3 px-3 w-18 text-center">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/80">
                    {displayedCards.map((c, idx) => {
                      const issues = cardValidation.get(c.id) || [];

                      return (
                        <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-3 text-center">
                            <input
                              type="checkbox"
                              checked={selectedCardIds.has(c.id)}
                              onChange={() => onToggleCard(c.id)}
                              className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer accent-indigo-600"
                            />
                          </td>

                          <td className="py-3 px-3">
                            <div className="font-bold text-slate-900 truncate max-w-[160px]">
                              {c.firstName || c.lastName
                                ? `${c.lastName || ''} ${c.firstName || ''}`.trim()
                                : c.company || '未知名片'}
                              {c.prefix && (
                                <span className="text-slate-500 font-normal ml-1">({c.prefix})</span>
                              )}
                            </div>
                            <div className="text-xs text-slate-500 font-mono tabular-nums">
                              #{idx + 1}
                            </div>
                          </td>

                          <td className="py-3 px-3">
                            <div className="font-medium text-slate-800 truncate max-w-[160px]">
                              {c.title || <span className="text-rose-600 font-semibold">未填職稱</span>}
                            </div>
                            {c.department && (
                              <div className="text-xs text-slate-600 truncate max-w-[160px] mt-0.5">
                                {c.department}
                              </div>
                            )}
                          </td>

                          <td className="py-3 px-3">
                            <div className="font-medium text-slate-800 truncate max-w-[170px]">
                              {c.company || <span className="text-rose-600 font-semibold">未填機構</span>}
                            </div>
                          </td>

                          <td className="py-3 px-3">
                            {c.country ? (
                              <span className="text-slate-800 font-medium">
                                {getCountryBilingualLabel(c.country)}
                              </span>
                            ) : (
                              <span className="text-rose-600 font-semibold">未設定</span>
                            )}
                          </td>

                          <td className="py-3 px-3">
                            {c.email ? (
                              <span className="font-mono text-xs text-slate-800 truncate block max-w-[180px]">
                                {c.email}
                              </span>
                            ) : (
                              <span className="text-rose-600 font-semibold">缺 Email</span>
                            )}
                          </td>

                          <td className="py-3 px-3">
                            <div className="flex items-center gap-1">
                              {[
                                { id: 'employer', label: '企業', active: 'bg-blue-600 text-white' },
                                { id: 'academic', label: '學研', active: 'bg-amber-600 text-white' },
                                { id: 'staff', label: '社團', active: 'bg-emerald-600 text-white' },
                                { id: 'other', label: '一般', active: 'bg-slate-700 text-white' },
                              ].map((opt) => (
                                <button
                                  key={opt.id}
                                  type="button"
                                  onClick={() => onUpdateCardCategory(c.id, opt.id as any)}
                                  className={`px-2 py-1 rounded text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                                    c.category === opt.id
                                      ? opt.active
                                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                  }`}
                                >
                                  {opt.label}
                                </button>
                              ))}
                            </div>
                          </td>

                          <td className="py-3 px-3">
                            {issues.length === 0 ? (
                              <span className="text-emerald-700 font-semibold inline-flex items-center gap-1 whitespace-nowrap">
                                <CheckCircle2 className="w-4 h-4" />
                                <span>合規</span>
                              </span>
                            ) : (
                              <div
                                className="text-xs text-rose-700 font-medium truncate max-w-[160px]"
                                title={issues.join('、')}
                              >
                                {issues[0]}
                                {issues.length > 1 ? ` (+${issues.length - 1})` : ''}
                              </div>
                            )}
                          </td>

                          <td className="py-3 px-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              {onOpenCardDetail && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    onClose();
                                    onOpenCardDetail(c.id);
                                  }}
                                  className="w-7 h-7 rounded-md flex items-center justify-center text-slate-500 hover:text-indigo-700 hover:bg-indigo-50 transition-colors cursor-pointer"
                                  title="開啟編輯詳情"
                                >
                                  <SquarePen className="w-4 h-4" />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => onToggleCard(c.id)}
                                className="w-7 h-7 rounded-md flex items-center justify-center text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                                title="從選取名單移除"
                              >
                                <X className="w-4 h-4" />
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

        {/* Footer */}
        <div className="px-5 py-4 border-t border-slate-200 bg-white shrink-0 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-slate-700 tabular-nums">
            <span>
              已勾選：<strong className="text-slate-900">{selectedCards.length}</strong> 位 ·
              全庫資料完整：<strong className="text-indigo-700">{boundSummary.readyCards.length}</strong> 位
            </span>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end flex-wrap">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
            >
              關閉視窗
            </button>

            <button
              type="button"
              disabled={boundSummary.readyCards.length === 0 || isExporting}
              onClick={() => onExport('qs_ready_all', boundSummary.readyCards)}
              className="px-4 py-2 rounded-lg text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap tabular-nums"
            >
              {isExporting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileSpreadsheet className="w-4 h-4" />
              )}
              <span>匯出完整聯絡人分表 (.xlsx · {boundSummary.readyCards.length} 筆)</span>
            </button>

            {selectedCards.length > 0 && (
              <div className="relative">
                <button
                  type="button"
                  disabled={isExporting}
                  onClick={() => setShowExportOptions(!showExportOptions)}
                  className="w-10 h-10 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 flex items-center justify-center transition-colors cursor-pointer"
                  title="更多匯出格式（依勾選名單或單獨分表）"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>

                {showExportOptions && (
                  <div
                    className="absolute right-0 bottom-full mb-2 w-72 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-50 animate-fadeIn origin-bottom-right"
                    onClick={() => setShowExportOptions(false)}
                  >
                    <div className="px-3.5 py-1 text-xs font-bold text-slate-500">
                      依角色分表獨立匯出
                    </div>
                    <button
                      type="button"
                      onClick={() => onExport('employer', boundSummary.employerCards)}
                      className="w-full text-left px-3.5 py-2 text-sm text-slate-800 hover:bg-slate-50 font-medium cursor-pointer tabular-nums"
                    >
                      僅匯出企業夥伴 ({boundSummary.employerCards.length} 筆)
                    </button>
                    <button
                      type="button"
                      onClick={() => onExport('academic', boundSummary.academicCards)}
                      className="w-full text-left px-3.5 py-2 text-sm text-slate-800 hover:bg-slate-50 font-medium cursor-pointer tabular-nums"
                    >
                      僅匯出學研專家 ({boundSummary.academicCards.length} 筆)
                    </button>
                    <div className="h-px bg-slate-100 my-1" />
                    <div className="px-3.5 py-1 text-xs font-bold text-slate-500">
                      自訂勾選名單匯出 ({selectedCards.length} 筆)
                    </div>
                    <button
                      type="button"
                      onClick={() => onExport('selected_qs', selectedCards)}
                      className="w-full text-left px-3.5 py-2 text-sm text-indigo-700 hover:bg-indigo-50 font-semibold cursor-pointer"
                    >
                      匯出目前勾選多頁簿 (.xlsx)
                    </button>
                    <button
                      type="button"
                      onClick={() => onExport('selected_csv', selectedCards)}
                      className="w-full text-left px-3.5 py-2 text-sm text-slate-800 hover:bg-slate-50 font-medium cursor-pointer"
                    >
                      匯出目前勾選 CSV (.csv)
                    </button>
                    <button
                      type="button"
                      onClick={() => onExport('vcard', selectedCards)}
                      className="w-full text-left px-3.5 py-2 text-sm text-slate-800 hover:bg-slate-50 font-medium cursor-pointer"
                    >
                      匯出 vCard 通訊錄 (.vcf)
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
