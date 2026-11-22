import React, { useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  BarChart3,
  Globe,
  Award,
  Tag,
  Leaf,
  Clock,
  Users,
  X,
  TrendingUp,
  BellRing,
} from 'lucide-react';
import { BusinessCardData, FOLLOW_UP_STATUS_LABELS, FollowUpStatus } from '../types';
import { normalizeCountry, getCountryBilingualLabel } from '../utils/countries';

interface InsightsDashboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  cards: BusinessCardData[];
  onFilterByCountry?: (country: string) => void;
  onFilterBySource?: (source: string) => void;
  onFilterByTag?: (tag: string) => void;
}

export const InsightsDashboardModal: React.FC<InsightsDashboardModalProps> = ({
  isOpen,
  onClose,
  cards,
  onFilterByCountry,
  onFilterBySource,
  onFilterByTag,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  const metrics = useMemo(() => {
    const total = cards.length;
    const catCounts = { employer: 0, academic: 0, staff: 0, other: 0 };
    const followCounts: Record<FollowUpStatus, number> = {
      new: 0,
      emailed: 0,
      in_progress: 0,
      partner: 0,
    };
    const countryMap = new Map<string, number>();
    const sourceMap = new Map<string, number>();
    const tagMap = new Map<string, number>();

    const now = Date.now();
    let upcomingReminders = 0;

    // Last 6 months buckets
    const monthBuckets: { key: string; label: string; count: number }[] = [];
    const nowDate = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(nowDate.getFullYear(), nowDate.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthBuckets.push({ key, label: `${d.getMonth() + 1}月`, count: 0 });
    }
    const bucketIdxMap = new Map(monthBuckets.map((b, idx) => [b.key, idx]));

    cards.forEach((c) => {
      if (c.category in catCounts) catCounts[c.category]++;
      else catCounts.other++;

      const st: FollowUpStatus = c.followUpStatus || 'new';
      followCounts[st] = (followCounts[st] || 0) + 1;

      if (c.nextFollowUpAt && c.nextFollowUpAt <= now + 7 * 86400000) {
        upcomingReminders++;
      }

      const ctry = normalizeCountry(c.country || c.translations?.country || '');
      if (ctry) countryMap.set(ctry, (countryMap.get(ctry) || 0) + 1);

      const src = (c.source || '').trim();
      if (src && src !== 'BizMind') sourceMap.set(src, (sourceMap.get(src) || 0) + 1);

      (c.tags || []).forEach((t) => {
        const clean = t.trim();
        if (clean) tagMap.set(clean, (tagMap.get(clean) || 0) + 1);
      });

      if (c.scannedAt) {
        const sd = new Date(c.scannedAt);
        const mk = `${sd.getFullYear()}-${String(sd.getMonth() + 1).padStart(2, '0')}`;
        const idx = bucketIdxMap.get(mk);
        if (idx !== undefined) monthBuckets[idx].count++;
      }
    });

    const topCountries = Array.from(countryMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);
    const topSources = Array.from(sourceMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    const topTags = Array.from(tagMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12);

    const maxMonthCount = Math.max(1, ...monthBuckets.map((b) => b.count));

    return {
      total,
      catCounts,
      followCounts,
      countryCount: countryMap.size,
      topCountries,
      topSources,
      topTags,
      monthBuckets,
      maxMonthCount,
      upcomingReminders,
      co2SavedGrams: Math.round(total * 3.5),
      minutesSaved: Math.round(total * 2.5),
    };
  }, [cards]);

  const safeDiv = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          className="fixed inset-0 z-[9600] bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label="人脈洞察與永續減碳儀表板"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
            className="w-full max-w-4xl bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden flex flex-col max-h-[88vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800 flex items-center justify-center">
                  <BarChart3 className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold font-display text-slate-900 dark:text-white">
                    人脈洞察與永續效益儀表板
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    即時統計跨國網絡分佈、活動來源效益、CRM 跟進進度與無紙化減碳貢獻
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center cursor-pointer"
                aria-label="關閉"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
              {/* KPI Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
                <div className="p-4 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900">
                  <div className="flex items-center justify-between text-indigo-600 dark:text-indigo-400 mb-1.5">
                    <span className="text-xs font-bold">總聯絡人脈</span>
                    <Users className="w-4 h-4" />
                  </div>
                  <div className="text-2xl font-bold font-display text-slate-900 dark:text-white tabular-nums">
                    {metrics.total}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
                    橫跨 {metrics.countryCount} 個國家/地區
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/35 border border-amber-200/70 dark:border-amber-900">
                  <div className="flex items-center justify-between text-amber-700 dark:text-amber-400 mb-1.5">
                    <span className="text-xs font-bold">近期跟進提醒</span>
                    <BellRing className="w-4 h-4" />
                  </div>
                  <div className="text-2xl font-bold font-display text-slate-900 dark:text-white tabular-nums">
                    {metrics.upcomingReminders}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
                    長期夥伴 {metrics.followCounts.partner} 位
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/35 border border-emerald-200/70 dark:border-emerald-900">
                  <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-400 mb-1.5">
                    <span className="text-xs font-bold">減碳估算 (CO₂e)</span>
                    <Leaf className="w-4 h-4" />
                  </div>
                  <div className="text-2xl font-bold font-display text-slate-900 dark:text-white tabular-nums">
                    {metrics.co2SavedGrams}g
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    數位化保存與電子名片交換
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-sky-50/70 dark:bg-sky-950/35 border border-sky-200/70 dark:border-sky-900">
                  <div className="flex items-center justify-between text-sky-700 dark:text-sky-400 mb-1.5">
                    <span className="text-xs font-bold">AI 節省工時</span>
                    <Clock className="w-4 h-4" />
                  </div>
                  <div className="text-2xl font-bold font-display text-slate-900 dark:text-white tabular-nums">
                    {metrics.minutesSaved >= 60
                      ? `${(metrics.minutesSaved / 60).toFixed(1)}h`
                      : `${metrics.minutesSaved}m`}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    免手動逐筆建檔時間
                  </div>
                </div>
              </div>

              {/* Category Stacked Bar + Follow-Up Pipeline */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="p-5 rounded-2xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 space-y-3.5">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    聯絡人角色分佈
                  </h3>
                  <div className="h-3.5 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden flex">
                    {metrics.total > 0 && (
                      <>
                        <div
                          style={{ width: `${safeDiv(metrics.catCounts.employer, metrics.total)}%` }}
                          className="bg-blue-500 h-full transition-all"
                          title={`企業夥伴 ${metrics.catCounts.employer}`}
                        />
                        <div
                          style={{ width: `${safeDiv(metrics.catCounts.academic, metrics.total)}%` }}
                          className="bg-amber-500 h-full transition-all"
                          title={`學研專家 ${metrics.catCounts.academic}`}
                        />
                        <div
                          style={{ width: `${safeDiv(metrics.catCounts.staff, metrics.total)}%` }}
                          className="bg-emerald-500 h-full transition-all"
                          title={`機關社團 ${metrics.catCounts.staff}`}
                        />
                        <div
                          style={{ width: `${safeDiv(metrics.catCounts.other, metrics.total)}%` }}
                          className="bg-slate-400 h-full transition-all"
                          title={`一般聯絡人 ${metrics.catCounts.other}`}
                        />
                      </>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
                    {[
                      { label: '企業夥伴', count: metrics.catCounts.employer, dot: 'bg-blue-500' },
                      { label: '學研專家', count: metrics.catCounts.academic, dot: 'bg-amber-500' },
                      { label: '機關社團', count: metrics.catCounts.staff, dot: 'bg-emerald-500' },
                      { label: '一般聯絡人', count: metrics.catCounts.other, dot: 'bg-slate-400' },
                    ].map((item) => (
                      <div key={item.label} className="flex items-center justify-between bg-white dark:bg-slate-900 px-3 py-2 rounded-xl border border-slate-200/70 dark:border-slate-800">
                        <span className="flex items-center gap-2 text-slate-700 dark:text-slate-300 font-medium">
                          <span className={`w-2.5 h-2.5 rounded-full ${item.dot}`} />
                          {item.label}
                        </span>
                        <span className="font-bold text-slate-900 dark:text-white tabular-nums">
                          {item.count} ({safeDiv(item.count, metrics.total)}%)
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* CRM Follow-up Pipeline */}
                <div className="p-5 rounded-2xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 space-y-3">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    個人 CRM 跟進進度漏斗
                  </h3>
                  <div className="space-y-2.5">
                    {(['new', 'emailed', 'in_progress', 'partner'] as FollowUpStatus[]).map((st) => {
                      const count = metrics.followCounts[st];
                      const pct = safeDiv(count, metrics.total);
                      const barColor =
                        st === 'partner'
                          ? 'bg-emerald-500'
                          : st === 'in_progress'
                          ? 'bg-amber-500'
                          : st === 'emailed'
                          ? 'bg-sky-500'
                          : 'bg-slate-400';
                      return (
                        <div key={st} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-slate-700 dark:text-slate-300">
                              {FOLLOW_UP_STATUS_LABELS[st].label}
                            </span>
                            <span className="font-bold text-slate-900 dark:text-white tabular-nums">
                              {count} 位 ({pct}%)
                            </span>
                          </div>
                          <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                            <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Countries + Monthly Growth + Sources */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Top Countries */}
                <div className="p-5 rounded-2xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 space-y-3">
                  <div className="flex items-center gap-1.5 text-sm font-bold text-slate-900 dark:text-white">
                    <Globe className="w-4 h-4 text-indigo-500" />
                    <span>主要國家 / 地區</span>
                  </div>
                  {metrics.topCountries.length === 0 ? (
                    <p className="text-xs text-slate-400 py-4">尚無國別資料</p>
                  ) : (
                    <div className="space-y-2">
                      {metrics.topCountries.map(([ctry, cnt]) => {
                        const pct = safeDiv(cnt, metrics.total);
                        return (
                          <button
                            key={ctry}
                            type="button"
                            onClick={() => {
                              onFilterByCountry?.(ctry);
                              onClose();
                            }}
                            className="w-full text-left group cursor-pointer"
                          >
                            <div className="flex items-center justify-between text-xs mb-0.5">
                              <span className="font-medium text-slate-700 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 truncate">
                                {getCountryBilingualLabel(ctry)}
                              </span>
                              <span className="font-bold text-slate-900 dark:text-white tabular-nums">
                                {cnt}
                              </span>
                            </div>
                            <div className="h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                              <div
                                className="h-full rounded-full bg-indigo-500 group-hover:bg-indigo-600 transition-all"
                                style={{ width: `${Math.max(6, pct)}%` }}
                              />
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Activity Sources ROI */}
                <div className="p-5 rounded-2xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 space-y-3">
                  <div className="flex items-center gap-1.5 text-sm font-bold text-slate-900 dark:text-white">
                    <Award className="w-4 h-4 text-amber-500" />
                    <span>活動 / 展會人脈排行</span>
                  </div>
                  {metrics.topSources.length === 0 ? (
                    <p className="text-xs text-slate-400 py-4">
                      為名片設定「活動來源」後即可追蹤各展會人脈成效
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {metrics.topSources.map(([src, cnt]) => (
                        <button
                          key={src}
                          type="button"
                          onClick={() => {
                            onFilterBySource?.(src);
                            onClose();
                          }}
                          className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700 text-xs transition-colors cursor-pointer"
                        >
                          <span className="font-medium text-slate-700 dark:text-slate-200 truncate">
                            {src}
                          </span>
                          <span className="font-bold text-indigo-600 dark:text-indigo-400 tabular-nums shrink-0 ml-2">
                            {cnt} 人
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Monthly Growth */}
                <div className="p-5 rounded-2xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between space-y-3">
                  <div className="flex items-center gap-1.5 text-sm font-bold text-slate-900 dark:text-white">
                    <TrendingUp className="w-4 h-4 text-emerald-500" />
                    <span>近 6 個月人脈成長</span>
                  </div>
                  <div className="flex items-end justify-between gap-2 h-32 pt-4">
                    {metrics.monthBuckets.map((b) => {
                      const heightPct = Math.round((b.count / metrics.maxMonthCount) * 100);
                      return (
                        <div key={b.key} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                          <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 tabular-nums">
                            {b.count > 0 ? b.count : ''}
                          </span>
                          <div className="w-full max-w-[28px] bg-slate-200/80 dark:bg-slate-800 rounded-t-lg overflow-hidden h-20 flex items-end">
                            <div
                              className="w-full bg-indigo-500 dark:bg-indigo-400 rounded-t-lg transition-all"
                              style={{ height: `${b.count > 0 ? Math.max(12, heightPct) : 0}%` }}
                            />
                          </div>
                          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                            {b.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Tag Cloud */}
              {metrics.topTags.length > 0 && (
                <div className="p-4 rounded-2xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 mb-2.5">
                    <Tag className="w-3.5 h-3.5 text-indigo-500" />
                    <span>熱門自訂標籤（點擊快速篩選）</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {metrics.topTags.map(([tag, cnt]) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => {
                          onFilterByTag?.(tag);
                          onClose();
                        }}
                        className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-indigo-400 text-slate-700 dark:text-slate-200 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors cursor-pointer tabular-nums"
                      >
                        #{tag} ({cnt})
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
