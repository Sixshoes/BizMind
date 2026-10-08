import React, { useState, useMemo } from 'react';
import { BusinessCardData, ExportMode } from '../types';
import { normalizeCountry, STANDARD_COUNTRIES, getCountryBilingualLabel } from '../utils/countries';
import { useToast } from './ToastProvider';

interface QsConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCardIds: Set<string>;
  allCards: BusinessCardData[];
  onToggleCard: (id: string) => void;
  onSelectAll?: () => void;
  onDeselectAll: () => void;
  onUpdateCardCategory: (id: string, newCategory: 'employer' | 'academic' | 'staff' | 'other') => void;
  onStandardizeSelectedCountries: () => void;
  onExport: (mode: ExportMode, selectedCards: BusinessCardData[]) => Promise<void>;
  isExporting?: boolean;
  onOpenCardDetail?: (id: string) => void;
}

export const QsConfirmationModal: React.FC<QsConfirmationModalProps> = ({
  isOpen,
  onClose,
  selectedCardIds,
  allCards,
  onToggleCard,
  onDeselectAll,
  onUpdateCardCategory,
  onStandardizeSelectedCountries,
  onExport,
  isExporting,
  onOpenCardDetail
}) => {
  const { addToast } = useToast();
  const [filterTab, setFilterTab] = useState<'all' | 'employer' | 'academic' | 'staff' | 'warning'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showExportOptions, setShowExportOptions] = useState(false);

  // Filter cards to only those currently selected
  const selectedCards = useMemo(() => {
    return allCards.filter(c => selectedCardIds.has(c.id));
  }, [allCards, selectedCardIds]);

  // Analyze validation/warnings for QS submission requirements
  const cardValidation = useMemo(() => {
    const map = new Map<string, string[]>();
    selectedCards.forEach(c => {
      const issues: string[] = [];
      const hasName = (c.firstName && c.firstName.trim()) || (c.lastName && c.lastName.trim());
      if (!hasName) issues.push('缺少姓名');
      
      if (!c.email || !c.email.trim()) {
        issues.push('缺少 Email (QS 必要欄位)');
      }
      
      const normalizedCtry = normalizeCountry(c.country || c.translations?.country || '');
      if (!normalizedCtry) {
        issues.push('缺少國家/地區');
      } else if (c.country !== normalizedCtry && (c.country === 'Taiwan' || c.country === '台灣')) {
        issues.push('國家未轉為 Taiwan SAR');
      }

      if (!c.company || !c.company.trim()) {
        issues.push(c.category === 'academic' ? '缺少機構名稱 (Institution)' : '缺少公司名稱 (Company)');
      }

      if (!c.title || !c.title.trim()) {
        issues.push('缺少職稱 (Job Title/Position)');
      }

      if (c.category === 'other') {
        issues.push('分類為 Not QS (建議指定 Employer / Academic / Staff)');
      }

      if (issues.length > 0) {
        map.set(c.id, issues);
      }
    });
    return map;
  }, [selectedCards]);

  // Summary statistics
  const stats = useMemo(() => {
    const employerCount = selectedCards.filter(c => c.category === 'employer').length;
    const academicCount = selectedCards.filter(c => c.category === 'academic').length;
    const staffCount = selectedCards.filter(c => c.category === 'staff').length;
    const otherCount = selectedCards.filter(c => c.category === 'other').length;
    const warningCount = Array.from(cardValidation.keys()).length;
    const readyCount = selectedCards.length - warningCount;
    return { employerCount, academicCount, staffCount, otherCount, warningCount, readyCount };
  }, [selectedCards, cardValidation]);

  // Filtered list according to tab & search query
  const displayedCards = useMemo(() => {
    return selectedCards.filter(c => {
      // Tab filter
      if (filterTab === 'employer' && c.category !== 'employer') return false;
      if (filterTab === 'academic' && c.category !== 'academic') return false;
      if (filterTab === 'staff' && c.category !== 'staff') return false;
      if (filterTab === 'warning' && !cardValidation.has(c.id)) return false;

      // Query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const name = `${c.firstName || ''} ${c.lastName || ''}`.toLowerCase();
        const company = (c.company || '').toLowerCase();
        const title = (c.title || '').toLowerCase();
        const email = (c.email || '').toLowerCase();
        const country = (c.country || '').toLowerCase();
        return name.includes(q) || company.includes(q) || title.includes(q) || email.includes(q) || country.includes(q);
      }

      return true;
    });
  }, [selectedCards, filterTab, searchQuery, cardValidation]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-2 md:p-6 animate-fadeIn">
      <div 
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl h-[92vh] max-h-[900px] flex flex-col overflow-hidden animate-scaleUp"
        onClick={e => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="px-5 py-4 border-b border-slate-200 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white shrink-0 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/30 border border-indigo-400/40 flex items-center justify-center text-indigo-300 shadow-inner">
              <i className="fa-solid fa-clipboard-check text-lg"></i>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black tracking-tight text-white flex items-center gap-2">
                  QS 聯絡人名單確認與匯出
                </h2>
                <span className="px-2 py-0.5 rounded-full text-xs font-black bg-indigo-500 text-white shadow-xs">
                  已選 {selectedCards.length} 筆
                </span>
              </div>
              <p className="text-xs text-indigo-200/80 mt-0.5">
                審核即將匯出至 QS Hub 的聯絡人名單，可切換分類、修正格式與確認合規性
              </p>
            </div>
          </div>

          {/* Quick Global Actions */}
          <div className="flex items-center gap-2 self-end md:self-auto">
            {stats.warningCount > 0 && (
              <button
                type="button"
                onClick={onStandardizeSelectedCountries}
                className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-400/30 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs"
                title="自動修正所有台灣為 QS 標準 Taiwan SAR"
              >
                <i className="fa-solid fa-wand-magic-sparkles text-amber-400"></i>
                <span>國家名稱一鍵標準化</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 hover:text-white flex items-center justify-center transition-colors"
              title="關閉視窗"
            >
              <i className="fa-solid fa-xmark text-base"></i>
            </button>
          </div>
        </div>

        {/* Metrics Summary Strip */}
        <div className="bg-slate-50 border-b border-slate-200 px-5 py-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 shrink-0">
          <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-xs flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-sm shrink-0">
              <i className="fa-solid fa-users"></i>
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider truncate">總選取</div>
              <div className="text-base font-black text-slate-900 leading-tight">{selectedCards.length} 位</div>
            </div>
          </div>

          <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-xs flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-sm shrink-0">
              <i className="fa-solid fa-briefcase"></i>
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider truncate">QS 雇主 (Employer)</div>
              <div className="text-base font-black text-blue-700 leading-tight">{stats.employerCount} 位</div>
            </div>
          </div>

          <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-xs flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-bold text-sm shrink-0">
              <i className="fa-solid fa-graduation-cap"></i>
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider truncate">QS 學者 (Academic)</div>
              <div className="text-base font-black text-amber-700 leading-tight">{stats.academicCount} 位</div>
            </div>
          </div>

          <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-xs flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-sm shrink-0">
              <i className="fa-solid fa-user-tag"></i>
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider truncate">QS 職員 (Staff)</div>
              <div className="text-base font-black text-emerald-700 leading-tight">{stats.staffCount} 位</div>
            </div>
          </div>

          <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-xs flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-sm shrink-0">
              <i className="fa-solid fa-circle-check text-emerald-500"></i>
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider truncate">完全合規</div>
              <div className="text-base font-black text-emerald-600 leading-tight">{stats.readyCount} 位</div>
            </div>
          </div>

          <div className={`p-2.5 rounded-xl border shadow-xs flex items-center gap-2.5 ${stats.warningCount > 0 ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-white border-slate-200 text-slate-400'}`}>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm shrink-0 ${stats.warningCount > 0 ? 'bg-rose-100 text-rose-600 animate-pulse' : 'bg-slate-50 text-slate-400'}`}>
              <i className="fa-solid fa-triangle-exclamation"></i>
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-wider truncate">待補齊提示</div>
              <div className="text-base font-black leading-tight">{stats.warningCount} 筆</div>
            </div>
          </div>
        </div>

        {/* Filter Controls & Search */}
        <div className="px-5 py-3 border-b border-slate-200 bg-white flex flex-col md:flex-row items-center justify-between gap-3 shrink-0">
          {/* Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
            <button
              onClick={() => setFilterTab('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                filterTab === 'all'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <span>全部已勾選</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${filterTab === 'all' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'}`}>
                {selectedCards.length}
              </span>
            </button>

            <button
              onClick={() => setFilterTab('employer')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                filterTab === 'employer'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
              }`}
            >
              <span>🏢 QS Employer</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${filterTab === 'employer' ? 'bg-white/20 text-white' : 'bg-blue-100 text-blue-700'}`}>
                {stats.employerCount}
              </span>
            </button>

            <button
              onClick={() => setFilterTab('academic')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                filterTab === 'academic'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
              }`}
            >
              <span>🎓 QS Academic</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${filterTab === 'academic' ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-700'}`}>
                {stats.academicCount}
              </span>
            </button>

            <button
              onClick={() => setFilterTab('staff')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                filterTab === 'staff'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
              }`}
            >
              <span>🤝 QS Staff</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${filterTab === 'staff' ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-700'}`}>
                {stats.staffCount}
              </span>
            </button>

            {stats.warningCount > 0 && (
              <button
                onClick={() => setFilterTab('warning')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  filterTab === 'warning'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                }`}
              >
                <span>⚠️ 需補齊欄位</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${filterTab === 'warning' ? 'bg-white/20 text-white' : 'bg-rose-100 text-rose-700'}`}>
                  {stats.warningCount}
                </span>
              </button>
            )}
          </div>

          {/* Search inside Modal & Batch Deselect */}
          <div className="flex items-center gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <i className="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="搜尋已勾選名單..."
                className="w-full pl-8 pr-7 py-1.5 bg-slate-100 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                >
                  <i className="fa-solid fa-circle-xmark"></i>
                </button>
              )}
            </div>

            <button
              onClick={() => {
                if (window.confirm('確定要清除所有已勾選的 QS 聯絡人嗎？')) {
                  onDeselectAll();
                }
              }}
              className="px-2.5 py-1.5 text-xs font-bold text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors shrink-0"
              title="清除所有勾選"
            >
              <i className="fa-solid fa-trash-can mr-1"></i> 全部取消
            </button>
          </div>
        </div>

        {/* Content Table / List */}
        <div className="flex-1 overflow-y-auto p-4 md:p-5 custom-scrollbar bg-slate-50/50">
          {selectedCards.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 p-8">
              <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center text-3xl mb-3 text-slate-300">
                📋
              </div>
              <h3 className="text-base font-bold text-slate-700 mb-1">目前沒有勾選任何 QS 聯絡人</h3>
              <p className="text-xs text-slate-400 max-w-sm text-center mb-4">
                請在左側名片列表或搜尋庫中，點擊名片旁的打勾方框，即可將名片加入此 QS 確認名單。
              </p>
              <button
                onClick={onClose}
                className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold shadow-md hover:bg-indigo-700 transition-colors"
              >
                返回名片列表勾選
              </button>
            </div>
          ) : displayedCards.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 p-8">
              <i className="fa-solid fa-filter-circle-xmark text-3xl mb-2 text-slate-300"></i>
              <p className="text-xs font-medium">在此分類或搜尋條件下沒有找到名片</p>
              <button
                onClick={() => { setFilterTab('all'); setSearchQuery(''); }}
                className="mt-2 text-xs font-bold text-indigo-600 hover:underline"
              >
                重設篩選條件
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-100/80 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="py-2.5 px-3 w-10 text-center">勾選</th>
                      <th className="py-2.5 px-3">聯絡人 / 稱謂</th>
                      <th className="py-2.5 px-3">職稱 / 單位</th>
                      <th className="py-2.5 px-3">公司 / 機構名稱</th>
                      <th className="py-2.5 px-3">國家/地區 (QS標準)</th>
                      <th className="py-2.5 px-3">QS 優先 Email</th>
                      <th className="py-2.5 px-3">QS 分類設定</th>
                      <th className="py-2.5 px-3">合規檢核</th>
                      <th className="py-2.5 px-3 w-16 text-center">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {displayedCards.map((c, idx) => {
                      const issues = cardValidation.get(c.id) || [];
                      const isAcademic = c.category === 'academic';
                      const isStaff = c.category === 'staff';
                      const isEmployer = c.category === 'employer' || c.category === 'other';

                      return (
                        <tr 
                          key={c.id} 
                          className="hover:bg-indigo-50/40 transition-colors group"
                        >
                          {/* Checkbox */}
                          <td className="py-3 px-3 text-center">
                            <input
                              type="checkbox"
                              checked={selectedCardIds.has(c.id)}
                              onChange={() => onToggleCard(c.id)}
                              className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer accent-indigo-600"
                              title="取消勾選此聯絡人"
                            />
                          </td>

                          {/* Contact Name & Prefix */}
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-2">
                              {c.imageUrl ? (
                                <img
                                  src={c.imageUrl}
                                  alt=""
                                  className="w-8 h-8 rounded-lg object-contain bg-slate-100 border border-slate-200 shrink-0"
                                  referrerPolicy="no-referrer"
                                />
                              ) : (
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-white text-xs shrink-0 ${
                                  isAcademic ? 'bg-amber-400' : isStaff ? 'bg-emerald-400' : 'bg-blue-400'
                                }`}>
                                  {c.lastName ? c.lastName.charAt(0) : (c.company ? c.company.charAt(0).toUpperCase() : '?')}
                                </div>
                              )}
                              <div className="min-w-0">
                                <div className="font-bold text-slate-800 flex items-center gap-1.5 truncate">
                                  <span>{(c.firstName || c.lastName) ? `${c.lastName || ''} ${c.firstName || ''}` : (c.company || '未知名片')}</span>
                                  {c.prefix && (
                                    <span className="text-[9px] px-1 py-0.2 bg-slate-100 text-slate-600 rounded font-normal shrink-0">
                                      {c.prefix}
                                    </span>
                                  )}
                                </div>
                                <div className="text-[10px] text-slate-400 font-mono">
                                  #{idx + 1}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Title / Dept */}
                          <td className="py-3 px-3">
                            <div className="font-bold text-slate-700 truncate max-w-[150px]" title={c.title}>
                              {c.title || <span className="text-rose-500 italic">未填寫職稱</span>}
                            </div>
                            {c.department && (
                              <div className="text-[10px] text-slate-400 truncate max-w-[150px]" title={c.department}>
                                {c.department}
                              </div>
                            )}
                          </td>

                          {/* Company / Institution */}
                          <td className="py-3 px-3">
                            <div className="font-bold text-slate-800 truncate max-w-[160px]" title={c.company}>
                              {c.company || <span className="text-rose-500 italic">未填寫機構/公司</span>}
                            </div>
                            {c.industry && (
                              <div className="text-[10px] text-slate-400 truncate max-w-[160px]" title={c.industry}>
                                產業: {c.industry}
                              </div>
                            )}
                          </td>

                          {/* Country */}
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-1">
                              {c.country ? (
                                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-bold ${
                                  c.country.includes('Taiwan SAR') ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-700'
                                }`}>
                                  <i className="fa-solid fa-flag text-[9px] text-indigo-400"></i>
                                  {getCountryBilingualLabel(c.country)}
                                </span>
                              ) : (
                                <span className="text-rose-500 italic flex items-center gap-1 text-[11px]">
                                  <i className="fa-solid fa-circle-exclamation text-[10px]"></i> 未設定
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Email */}
                          <td className="py-3 px-3">
                            {c.email ? (
                              <div className="truncate max-w-[170px]" title={c.email}>
                                <span className={`text-[11px] font-mono ${
                                  isAcademic && c.email.toLowerCase().includes('.edu')
                                    ? 'text-emerald-700 font-bold bg-emerald-50 px-1 py-0.2 rounded'
                                    : 'text-slate-700'
                                }`}>
                                  {c.email}
                                </span>
                              </div>
                            ) : (
                              <span className="text-rose-600 font-bold bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200 text-[10px] flex items-center gap-1 w-fit">
                                <i className="fa-solid fa-triangle-exclamation"></i> 缺 Email
                              </span>
                            )}
                          </td>

                          {/* Category Switcher Pill */}
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => onUpdateCardCategory(c.id, 'employer')}
                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-all ${
                                  c.category === 'employer'
                                    ? 'bg-blue-600 text-white shadow-2xs'
                                    : 'bg-slate-100 text-slate-500 hover:bg-blue-50 hover:text-blue-600'
                                }`}
                                title="設為 QS Employer 雇主"
                              >
                                🏢 雇主
                              </button>
                              <button
                                type="button"
                                onClick={() => onUpdateCardCategory(c.id, 'academic')}
                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-all ${
                                  c.category === 'academic'
                                    ? 'bg-amber-600 text-white shadow-2xs'
                                    : 'bg-slate-100 text-slate-500 hover:bg-amber-50 hover:text-amber-600'
                                }`}
                                title="設為 QS Academic 學者"
                              >
                                🎓 學者
                              </button>
                              <button
                                type="button"
                                onClick={() => onUpdateCardCategory(c.id, 'staff')}
                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-all ${
                                  c.category === 'staff'
                                    ? 'bg-emerald-600 text-white shadow-2xs'
                                    : 'bg-slate-100 text-slate-500 hover:bg-emerald-50 hover:text-emerald-600'
                                }`}
                                title="設為 QS Staff 職員"
                              >
                                🤝 職員
                              </button>
                            </div>
                          </td>

                          {/* Validation Status */}
                          <td className="py-3 px-3">
                            {issues.length === 0 ? (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded text-[10px] font-bold">
                                <i className="fa-solid fa-check text-[9px]"></i> QS 合規
                              </span>
                            ) : (
                              <div className="flex flex-col gap-0.5">
                                {issues.slice(0, 2).map((iss, i) => (
                                  <span key={i} className="text-[9px] font-bold text-rose-600 bg-rose-50 px-1 py-0.2 rounded flex items-center gap-1 truncate max-w-[130px]" title={iss}>
                                    <i className="fa-solid fa-circle-exclamation text-[8px]"></i> {iss}
                                  </span>
                                ))}
                                {issues.length > 2 && (
                                  <span className="text-[8px] text-slate-400">+{issues.length - 2} 個提示</span>
                                )}
                              </div>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="py-3 px-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => {
                                  onClose();
                                  onOpenCardDetail(c.id);
                                }}
                                className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                                title="編輯名片詳細內容"
                              >
                                <i className="fa-solid fa-pen-to-square text-xs"></i>
                              </button>
                              <button
                                onClick={() => onToggleCard(c.id)}
                                className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                                title="從此名單移除"
                              >
                                <i className="fa-solid fa-xmark text-xs"></i>
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

        {/* Bottom Export Action Footer */}
        <div className="px-5 py-4 border-t border-slate-200 bg-white shrink-0 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-lg">
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <span className="font-bold text-slate-900">匯出準備就緒：</span>
            <span>共 <strong className="text-indigo-600 font-black">{selectedCards.length}</strong> 位 QS 聯絡人</span>
            {stats.warningCount > 0 && (
              <span className="text-rose-600 text-[11px] font-medium bg-rose-50 px-2 py-0.5 rounded-full border border-rose-100 hidden md:inline-flex items-center gap-1">
                <i className="fa-solid fa-triangle-exclamation"></i> {stats.warningCount} 筆有欄位提示（仍可正常匯出）
              </span>
            )}
          </div>

          {/* Export Buttons */}
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              繼續選取
            </button>

            {/* Main QS Standard Excel Export Button */}
            <button
              disabled={selectedCards.length === 0 || isExporting}
              onClick={() => onExport('selected_qs', selectedCards)}
              className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wide transition-all flex items-center gap-2 shadow-md ${
                selectedCards.length > 0 && !isExporting
                  ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200 active:scale-95'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
              title="匯出符合 QS 官方標準的 Multi-Sheet Excel 檔案"
            >
              {isExporting ? (
                <i className="fa-solid fa-circle-notch fa-spin"></i>
              ) : (
                <i className="fa-solid fa-file-excel text-emerald-300 text-sm"></i>
              )}
              <span>確認名單並匯出 QS Excel (.xlsx)</span>
            </button>

            {/* Other Export Formats Dropdown */}
            <div className="relative">
              <button
                disabled={selectedCards.length === 0 || isExporting}
                onClick={() => setShowExportOptions(!showExportOptions)}
                className={`w-9 h-9 rounded-xl border flex items-center justify-center text-xs font-bold transition-colors ${
                  showExportOptions ? 'bg-slate-100 border-slate-300 text-slate-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
                title="更多匯出格式"
              >
                <i className="fa-solid fa-ellipsis-vertical"></i>
              </button>

              {showExportOptions && (
                <div 
                  className="absolute right-0 bottom-full mb-2 w-64 bg-white rounded-xl shadow-2xl border border-slate-200 py-2 z-50 animate-fadeIn origin-bottom-right"
                  onClick={() => setShowExportOptions(false)}
                >
                  <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50">
                    特定類別 Excel
                  </div>
                  <button
                    onClick={() => onExport('selected_employer', selectedCards.filter(c => c.category === 'employer'))}
                    className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 flex items-center gap-2 font-bold"
                  >
                    <i className="fa-solid fa-briefcase text-blue-500 w-4 text-center"></i> 僅匯出 QS Employer 表格 (.xlsx)
                  </button>
                  <button
                    onClick={() => onExport('selected_academic', selectedCards.filter(c => c.category === 'academic'))}
                    className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 flex items-center gap-2 font-bold"
                  >
                    <i className="fa-solid fa-graduation-cap text-amber-500 w-4 text-center"></i> 僅匯出 QS Academic 表格 (.xlsx)
                  </button>
                  <button
                    onClick={() => onExport('selected_staff', selectedCards.filter(c => c.category === 'staff'))}
                    className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 flex items-center gap-2 font-bold"
                  >
                    <i className="fa-solid fa-user-tag text-emerald-500 w-4 text-center"></i> 僅匯出 QS Staff 表格 (.xlsx)
                  </button>

                  <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50 mt-1">
                    其他標準格式
                  </div>
                  <button
                    onClick={() => onExport('selected_csv', selectedCards)}
                    className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 flex items-center gap-2 font-bold"
                  >
                    <i className="fa-solid fa-file-csv text-indigo-500 w-4 text-center"></i> 匯出 QS 標準 CSV (.csv)
                  </button>
                  <button
                    onClick={() => onExport('vcard', selectedCards)}
                    className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 flex items-center gap-2 font-bold"
                  >
                    <i className="fa-regular fa-address-card text-emerald-500 w-4 text-center"></i> 匯出 vCard 電子通訊錄 (.vcf)
                  </button>
                  <button
                    onClick={() => onExport('zip', selectedCards)}
                    className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 flex items-center gap-2 font-bold"
                  >
                    <i className="fa-solid fa-file-zipper text-purple-500 w-4 text-center"></i> 打包下載 ZIP (含圖片與名片)
                  </button>
                  <button
                    onClick={() => onExport('json', selectedCards)}
                    className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 flex items-center gap-2 font-bold"
                  >
                    <i className="fa-solid fa-code text-slate-500 w-4 text-center"></i> 匯出 JSON 備份檔 (.json)
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
