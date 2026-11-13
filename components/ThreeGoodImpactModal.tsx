import React, { useMemo } from 'react';
import { BusinessCardData } from '../types';
import { normalizeCountry } from '../utils/countries';

interface ThreeGoodImpactModalProps {
  isOpen: boolean;
  onClose: () => void;
  cards: BusinessCardData[];
  onLoadDemoCards?: () => void;
  onOpenAiAssistant?: () => void;
}

export const ThreeGoodImpactModal: React.FC<ThreeGoodImpactModalProps> = ({
  isOpen,
  onClose,
  cards,
  onLoadDemoCards,
  onOpenAiAssistant
}) => {
  const metrics = useMemo(() => {
    const totalCards = cards.length;
    const physicalSheets = cards.reduce((acc, c) => acc + (c.physicalCount || 1), 0);
    // Estimated ~8.5g CO2e saved per card digitized & avoided reprint/shipping + cloud workflow
    const co2SavedGrams = Math.round(physicalSheets * 8.5);
    // ~3.5 minutes saved per card vs manual multilingual typing, translation, country lookup & QS classification
    const minutesSaved = Math.round(totalCards * 3.5);
    const countries = new Set<string>();
    let qsPartnerCount = 0;
    for (const c of cards) {
      const norm = normalizeCountry(c.country || c.translations?.country || '');
      if (norm) countries.add(norm);
      if (c.category !== 'other') qsPartnerCount++;
    }
    return {
      totalCards,
      physicalSheets,
      co2SavedGrams,
      minutesSaved,
      countryCount: countries.size,
      qsPartnerCount
    };
  }, [cards]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9990] bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl border border-slate-200/80 flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 bg-gradient-to-r from-emerald-50/80 via-white to-indigo-50/70 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-600 text-white flex items-center justify-center shadow-sm shrink-0">
              <i className="fa-solid fa-seedling text-lg"></i>
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-bold text-slate-900">BizMind · 三好永續智慧人脈平台</h2>
                <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200/60">
                  科技向善 · 人文優先
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                融合「做好事、說好話、存好心」與「四給」精神的 AI 無紙化國際永續交流系統
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer shrink-0"
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto custom-scrollbar space-y-6 flex-1">
          {/* 1. Real-time Sustainability & Efficiency Impact Metrics */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <i className="fa-solid fa-chart-simple text-emerald-600"></i>
                即時環境永續與行政減負效益
              </h3>
              {cards.length === 0 && onLoadDemoCards && (
                <button
                  type="button"
                  onClick={() => {
                    onLoadDemoCards();
                  }}
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-3 py-1 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <i className="fa-solid fa-flask text-[11px]"></i>
                  <span>載入 6 筆示範名片查看實測效益</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-xl bg-emerald-50/60 border border-emerald-100">
                <div className="text-[11px] font-semibold text-emerald-700">無紙化減碳貢獻</div>
                <div className="text-2xl font-bold text-emerald-900 mt-1 tabular-nums">
                  {metrics.co2SavedGrams >= 1000
                    ? `${(metrics.co2SavedGrams / 1000).toFixed(2)} kg`
                    : `${metrics.co2SavedGrams} g`}
                </div>
                <div className="text-[10px] text-emerald-700/75 mt-0.5">估算減少 CO₂e 碳足跡</div>
              </div>

              <div className="p-3.5 rounded-xl bg-indigo-50/60 border border-indigo-100">
                <div className="text-[11px] font-semibold text-indigo-700">節省人工建檔工時</div>
                <div className="text-2xl font-bold text-indigo-900 mt-1 tabular-nums">
                  {metrics.minutesSaved >= 60
                    ? `${(metrics.minutesSaved / 60).toFixed(1)} 小時`
                    : `${metrics.minutesSaved} 分鐘`}
                </div>
                <div className="text-[10px] text-indigo-700/75 mt-0.5">免除人工逐字登打與查國別</div>
              </div>

              <div className="p-3.5 rounded-xl bg-amber-50/60 border border-amber-100">
                <div className="text-[11px] font-semibold text-amber-800">國際善緣連結國別</div>
                <div className="text-2xl font-bold text-amber-900 mt-1 tabular-nums">
                  {metrics.countryCount} <span className="text-xs font-semibold">國/地區</span>
                </div>
                <div className="text-[10px] text-amber-800/75 mt-0.5">自動對齊 197 標準國別規範</div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
                <div className="text-[11px] font-semibold text-slate-600">永續與高教夥伴庫</div>
                <div className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">
                  {metrics.qsPartnerCount} <span className="text-xs font-semibold">/ {metrics.totalCards} 筆</span>
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">雇主 · 學者 · 校務夥伴</div>
              </div>
            </div>
          </div>

          {/* 2. Three Acts of Goodness & Four Givings Mapping */}
          <div>
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <i className="fa-solid fa-hands-holding-circle text-indigo-600"></i>
              「三好 × 四給」核心理念與系統實踐
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="p-4 rounded-xl border border-slate-200/90 bg-white shadow-2xs">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold">好</span>
                  <h4 className="text-sm font-bold text-slate-900">做好事 · 環境永續</h4>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  以 AI 多卡框選與批量數位化取代紙本名片重印與紙本名冊歸檔，推動校園與機構無紙化綠色治理，量化每一次永續減碳行動。
                </p>
              </div>

              <div className="p-4 rounded-xl border border-slate-200/90 bg-white shadow-2xs">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-6 h-6 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center text-xs font-bold">話</span>
                  <h4 className="text-sm font-bold text-slate-900">說好話 · 給人歡喜與信心</h4>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  內建「AI 說好話溫暖問候助手」，依交流情境與對方專業背景生成真誠致謝與合作祝福草稿，讓數位名單化為有溫度的善緣互動。
                </p>
              </div>

              <div className="p-4 rounded-xl border border-slate-200/90 bg-white shadow-2xs">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold">心</span>
                  <h4 className="text-sm font-bold text-slate-900">存好心 · 給人方便與希望</h4>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  自動處理多語翻譯、旋轉校正、重複名片比對與 QS 高教國際格式匯出，大幅減輕行政同仁繁瑣負擔，將心力專注於國際合作與公益推動。
                </p>
              </div>
            </div>
          </div>

          {/* 3. Mandatory Competition AI Tool Disclosure */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/90 space-y-2.5">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <i className="fa-solid fa-microchip text-indigo-600"></i>
                AI 技術整合架構與透明揭露聲明 (AI Disclosure)
              </h3>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-600">
                Human-in-the-Loop 人工審核把關
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-600">
              <div className="bg-white p-2.5 rounded-lg border border-slate-200/70">
                <span className="font-semibold text-slate-800">1. Google Gemini 多模態視覺與結構化解析：</span>
                負責 A4/多張名片自動邊界偵測、多方向旋轉容錯 OCR、多語系欄位翻譯與機構背景簡介生成。
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-slate-200/70">
                <span className="font-semibold text-slate-800">2. QS 高教角色推論與可解釋依據：</span>
                自動判讀雇主 (Employer)、學者 (Academic)、校務職員 (Staff)，並附上分類推論理由供人工覆核。
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-slate-200/70">
                <span className="font-semibold text-slate-800">3. 兩階段自然語言檢索 + Google Search 查證：</span>
                AI 助理先萃取查詢意圖過濾本地資料庫，並支援開啟聯網檢索查證機構公開資訊與附註來源連結。
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-slate-200/70">
                <span className="font-semibold text-slate-800">4. 責任與資料主權設計：</span>
                所有 AI 產出欄位與問候信草稿均支援使用者即時編修確認；API 金鑰嚴格隔離於後端伺服器，確保資訊安全。
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            {onLoadDemoCards && (
              <button
                type="button"
                onClick={onLoadDemoCards}
                className="px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <i className="fa-solid fa-database text-indigo-500 text-[11px]"></i>
                <span>載入示範名片</span>
              </button>
            )}
            {onOpenAiAssistant && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenAiAssistant();
                }}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
              >
                <i className="fa-solid fa-comments text-[11px]"></i>
                <span>體驗 AI 人脈助理</span>
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer ml-auto"
          >
            完成檢視
          </button>
        </div>
      </div>
    </div>
  );
};

export default ThreeGoodImpactModal;
