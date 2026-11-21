import React, { useMemo, useEffect } from 'react';
import { Leaf, Clock, Globe, Users, Cpu, X, Database, Sparkles } from 'lucide-react';
import { BusinessCardData } from '../types';
import { normalizeCountry } from '../utils/countries';

interface ThreeGoodImpactModalProps {
  isOpen: boolean;
  onClose: () => void;
  cards: BusinessCardData[];
  onLoadDemoCards?: () => void;
}

export const ThreeGoodImpactModal: React.FC<ThreeGoodImpactModalProps> = ({
  isOpen,
  onClose,
  cards,
  onLoadDemoCards,
}) => {
  const metrics = useMemo(() => {
    const totalCards = cards.length;
    const physicalSheets = cards.reduce((acc, c) => acc + (c.physicalCount || 1), 0);
    const co2SavedGrams = Math.round(physicalSheets * 8.5);
    const minutesSaved = Math.round(totalCards * 3.5);
    const countries = new Set<string>();
    for (const c of cards) {
      const norm = normalizeCountry(c.country || c.translations?.country || '');
      if (norm) countries.add(norm);
    }
    return {
      totalCards,
      co2SavedGrams,
      minutesSaved,
      countryCount: countries.size,
    };
  }, [cards]);

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
      className="fixed inset-0 z-[9600] bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 flex flex-col max-h-[88vh] overflow-hidden animate-scaleUp"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4 bg-white dark:bg-slate-900">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <Leaf className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold font-display text-slate-900 dark:text-slate-100">
                無紙化減碳效益與 AI 技術揭露
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                BizMind 數位典藏影響力統計與生成式 AI 運用透明說明
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto custom-scrollbar space-y-5 flex-1">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/35 border border-emerald-200/70 dark:border-emerald-800/70">
              <div className="text-xs font-semibold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                <Leaf className="w-3.5 h-3.5" />
                <span>無紙化減碳</span>
              </div>
              <div className="text-xl font-bold font-display text-emerald-950 dark:text-emerald-100 mt-1 tabular-nums">
                {metrics.co2SavedGrams >= 1000
                  ? `${(metrics.co2SavedGrams / 1000).toFixed(2)} kg`
                  : `${metrics.co2SavedGrams} g`}
              </div>
              <div className="text-[11px] text-emerald-700/80 dark:text-emerald-400/80 mt-0.5">估算減少 CO₂e</div>
            </div>

            <div className="p-3.5 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/35 border border-indigo-200/70 dark:border-indigo-800/70">
              <div className="text-xs font-semibold text-indigo-800 dark:text-indigo-300 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                <span>節省建檔工時</span>
              </div>
              <div className="text-xl font-bold font-display text-indigo-950 dark:text-indigo-100 mt-1 tabular-nums">
                {metrics.minutesSaved >= 60
                  ? `${(metrics.minutesSaved / 60).toFixed(1)} hr`
                  : `${metrics.minutesSaved} min`}
              </div>
              <div className="text-[11px] text-indigo-700/80 dark:text-indigo-400/80 mt-0.5">免除人工逐字登打</div>
            </div>

            <div className="p-3.5 rounded-xl bg-amber-50/60 dark:bg-amber-950/35 border border-amber-200/70 dark:border-amber-800/70">
              <div className="text-xs font-semibold text-amber-900 dark:text-amber-300 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5" />
                <span>跨國連結地區</span>
              </div>
              <div className="text-xl font-bold font-display text-amber-950 dark:text-amber-100 mt-1 tabular-nums">
                {metrics.countryCount}
              </div>
              <div className="text-[11px] text-amber-800/80 dark:text-amber-400/80 mt-0.5">標準化國家/地區</div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700">
              <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" />
                <span>數位典藏總數</span>
              </div>
              <div className="text-xl font-bold font-display text-slate-900 dark:text-white mt-1 tabular-nums">
                {metrics.totalCards}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">筆名片聯絡人</div>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Cpu className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span>AI 技術應用架構與透明揭露 (AI Disclosure)</span>
              </h3>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                Human-in-the-Loop 人工審閱把關
              </span>
            </div>

            <div className="space-y-2 text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
              <div className="bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200/80 dark:border-slate-700/80">
                <strong className="text-slate-900 dark:text-white">1. 視覺多卡偵測與自動翻正：</strong>
                運用 Google Gemini 多模態視覺模型偵測單頁多張名片邊界，搭配影像方向分析自動將橫拍或顛倒名片轉正。
              </div>
              <div className="bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200/80 dark:border-slate-700/80">
                <strong className="text-slate-900 dark:text-white">2. 多語系 OCR 擷取與雙面語意合併：</strong>
                自動提取中英與多國語言欄位、推論聯絡人角色分類並附上分類依據；支援正反面雙語對照與雙職稱差異偵測。
              </div>
              <div className="bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200/80 dark:border-slate-700/80">
                <strong className="text-slate-900 dark:text-white">3. 友善問候跟進信草擬與自然語言檢索：</strong>
                依據名片背景與認識場合自動生成真誠有禮的中英文會後問候信草稿，並提供結合 Google Search 查證之智慧人脈對話助理。所有 AI 產出皆由使用者確認後儲存或寄送。
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/95 flex items-center justify-between gap-3">
          {onLoadDemoCards ? (
            <button
              type="button"
              onClick={() => {
                onLoadDemoCards();
                onClose();
              }}
              className="px-3.5 py-2 bg-white dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Database className="w-3.5 h-3.5" />
              <span>載入 6 筆示範名片</span>
            </button>
          ) : (
            <div />
          )}
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 dark:bg-indigo-600 hover:bg-slate-800 dark:hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
          >
            關閉
          </button>
        </div>
      </div>
    </div>
  );
};

export default ThreeGoodImpactModal;
