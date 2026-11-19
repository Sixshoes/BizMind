import React, { useEffect, useMemo } from 'react';
import {
  AlertTriangle,
  GitMerge,
  Split,
  Image as ImageIcon,
  X,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react';
import {
  DualSideConflictItem,
  DualSideResolutionStrategy,
  BusinessCardData,
} from '../types';
import { applyDualSideMerge } from '../utils/dualSideCardUtils';

interface DualSideConflictModalProps {
  conflictQueue: DualSideConflictItem[];
  onResolveCurrent: (
    item: DualSideConflictItem,
    strategy: Exclude<DualSideResolutionStrategy, 'auto'>
  ) => Promise<void>;
  onSkipCurrent: () => void;
  onCloseAll: () => void;
  isSubmitting?: boolean;
}

const CATEGORY_LABELS: Record<BusinessCardData['category'], string> = {
  academic: '學研專家 (Academic)',
  employer: '企業夥伴 (Business)',
  staff: '機關社團 (Organization)',
  other: '一般聯絡人 (General)',
};

export const DualSideConflictModal: React.FC<DualSideConflictModalProps> = ({
  conflictQueue,
  onResolveCurrent,
  onSkipCurrent,
  onCloseAll,
  isSubmitting = false,
}) => {
  const currentItem = conflictQueue[0] || null;

  useEffect(() => {
    if (!currentItem) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting) {
        e.preventDefault();
        onCloseAll();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [currentItem, isSubmitting, onCloseAll]);

  const previewMerged = useMemo(() => {
    if (!currentItem) return null;
    return applyDualSideMerge(
      currentItem.card,
      currentItem.extraction,
      'merge_concurrent'
    ).updatedCard;
  }, [currentItem]);

  if (!currentItem) return null;

  const { card, extraction, conflictReason, isDifferentPerson } = currentItem;
  const back = extraction.backOnly || {};

  const frontName =
    `${card.prefix || ''} ${card.firstName || ''} ${card.lastName || ''}`.trim() || '（未填寫）';
  const backName =
    `${back.prefix || ''} ${back.firstName || ''} ${back.lastName || ''}`.trim() || '（未印姓名）';

  const comparisonRows = [
    {
      label: '聯絡人姓名',
      front: frontName,
      back: backName,
      diff:
        Boolean(back.firstName || back.lastName) &&
        frontName.toLowerCase() !== backName.toLowerCase(),
    },
    {
      label: '公司 / 學校機構',
      front:
        [card.company, card.translations?.company].filter(Boolean).join(' · ') || '（未填寫）',
      back:
        [back.company, back.translations?.company].filter(Boolean).join(' · ') || '（未印機構）',
      diff: Boolean(back.company) && (card.company || '').trim() !== (back.company || '').trim(),
    },
    {
      label: '職稱頭銜',
      front: [card.title, card.translations?.title].filter(Boolean).join(' · ') || '（未填寫）',
      back: [back.title, back.translations?.title].filter(Boolean).join(' · ') || '（未印職稱）',
      diff: Boolean(back.title) && (card.title || '').trim() !== (back.title || '').trim(),
    },
    {
      label: '部門 / 單位',
      front:
        [card.department, card.translations?.department].filter(Boolean).join(' · ') || '—',
      back:
        [back.department, back.translations?.department].filter(Boolean).join(' · ') || '—',
      diff:
        Boolean(back.department) &&
        (card.department || '').trim() !== (back.department || '').trim(),
    },
    {
      label: 'Email / 電話',
      front: [card.email, card.phone].filter(Boolean).join(' · ') || '—',
      back: [back.email, back.phone].filter(Boolean).join(' · ') || '—',
      diff: Boolean(back.email && back.email !== card.email),
    },
  ];

  return (
    <div
      className="fixed inset-0 z-[9990] bg-slate-900/55 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-fadeIn"
      onClick={() => !isSubmitting && onCloseAll()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="dual-conflict-modal-title"
    >
      <div
        className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-scaleUp"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 bg-white flex items-start justify-between gap-4 shrink-0">
          <div className="flex items-start gap-3.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center shrink-0 mt-0.5">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2
                  id="dual-conflict-modal-title"
                  className="text-lg font-bold font-display text-slate-900"
                >
                  偵測到雙面名片機構或身分差異
                </h2>
                {conflictQueue.length > 1 && (
                  <span className="text-sm font-semibold text-amber-800 tabular-nums">
                    · 待確認剩餘 {conflictQueue.length} 筆
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-700 mt-1 leading-relaxed">{conflictReason}</p>
            </div>
          </div>

          <button
            type="button"
            disabled={isSubmitting}
            onClick={onCloseAll}
            className="w-9 h-9 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer shrink-0"
            aria-label="關閉視窗"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 custom-scrollbar bg-slate-50/60">
          {/* Dual Image Side-by-Side Preview */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden flex flex-col">
              <div className="px-3.5 py-2 border-b border-white/10 text-xs font-semibold text-slate-200 flex items-center justify-between">
                <span>正面影像 (Front)</span>
                <span className="text-slate-400">現有主卡</span>
              </div>
              <div className="h-40 flex items-center justify-center p-3 overflow-hidden bg-slate-950/60">
                {card.imageUrl ? (
                  <img
                    src={card.imageUrl}
                    alt="名片正面影像"
                    referrerPolicy="no-referrer"
                    className="max-h-full max-w-full object-contain rounded transition-transform"
                    style={{ transform: `rotate(${card.rotation || 0}deg)` }}
                  />
                ) : (
                  <div className="text-xs text-slate-400 flex flex-col items-center gap-1.5">
                    <ImageIcon className="w-6 h-6 opacity-50" />
                    <span>無正面影像</span>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden flex flex-col">
              <div className="px-3.5 py-2 border-b border-white/10 text-xs font-semibold text-slate-200 flex items-center justify-between">
                <span>反面影像 (Back)</span>
                <span className="text-amber-300">偵測到不同機構 / 對象</span>
              </div>
              <div className="h-40 flex items-center justify-center p-3 overflow-hidden bg-slate-950/60">
                {card.backImageUrl ? (
                  <img
                    src={card.backImageUrl}
                    alt="名片反面影像"
                    referrerPolicy="no-referrer"
                    className="max-h-full max-w-full object-contain rounded transition-transform"
                    style={{
                      transform: `rotate(${
                        extraction.recommendedBackRotation ?? card.backRotation ?? 0
                      }deg)`,
                    }}
                  />
                ) : (
                  <div className="text-xs text-slate-400 flex flex-col items-center gap-1.5">
                    <ImageIcon className="w-6 h-6 opacity-50" />
                    <span>無反面影像</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Field Diff Table */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-700">
                  <tr>
                    <th className="py-2.5 px-4 w-32">比對欄位</th>
                    <th className="py-2.5 px-4">正面現有內容</th>
                    <th className="py-2.5 px-4">反面擷取內容</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/80">
                  {comparisonRows.map((row) => (
                    <tr key={row.label} className={row.diff ? 'bg-amber-50/40' : ''}>
                      <td className="py-3 px-4 font-semibold text-slate-800 whitespace-nowrap align-top">
                        {row.label}
                      </td>
                      <td className="py-3 px-4 text-slate-800 align-top break-words max-w-xs">
                        {row.front}
                      </td>
                      <td className="py-3 px-4 align-top break-words max-w-xs">
                        <span
                          className={
                            row.diff ? 'font-semibold text-amber-950' : 'text-slate-700'
                          }
                        >
                          {row.back}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Preview of Concurrent Merge Result */}
          {previewMerged && (
            <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-1.5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-xs font-bold text-slate-600">
                  若選擇「合併為兼任／雙機構身分」預覽結果：
                </span>
                <span className="text-xs font-semibold text-indigo-700 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>自動對應分類：{CATEGORY_LABELS[previewMerged.category]}</span>
                </span>
              </div>
              <div className="text-sm text-slate-900 font-semibold flex items-center gap-2 flex-wrap">
                <span>
                  {`${previewMerged.firstName} ${previewMerged.lastName}`.trim() || '聯絡人'}
                </span>
                <span className="text-slate-400">·</span>
                <span className="text-indigo-800">{previewMerged.title || '—'}</span>
              </div>
              <div className="text-sm text-slate-700">
                機構：{previewMerged.company || '—'}
                {previewMerged.translations?.company
                  ? `（對照：${previewMerged.translations.company}）`
                  : ''}
              </div>
            </div>
          )}
        </div>

        {/* Footer Decision Actions */}
        <div className="px-5 py-4 border-t border-slate-200 bg-white flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            {conflictQueue.length > 1 && (
              <button
                type="button"
                disabled={isSubmitting}
                onClick={onSkipCurrent}
                className="px-3.5 py-2 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer whitespace-nowrap"
              >
                暫時略過此筆
              </button>
            )}
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => onResolveCurrent(currentItem, 'keep_image_only')}
              className="px-3.5 py-2 rounded-lg text-sm font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 transition-colors cursor-pointer whitespace-nowrap"
              title="維持正面機構與職稱，不混入反面機構名稱"
            >
              僅保留雙面影像
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2.5">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => onResolveCurrent(currentItem, 'split_into_two')}
              className={`px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                isDifferentPerson
                  ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                  : 'bg-white border border-indigo-300 text-indigo-800 hover:bg-indigo-50'
              }`}
            >
              <Split className="w-4 h-4" />
              <span>拆分為兩筆獨立名片</span>
            </button>

            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => onResolveCurrent(currentItem, 'merge_concurrent')}
              className={`px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                !isDifferentPerson
                  ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                  : 'bg-slate-900 hover:bg-slate-800 text-white'
              }`}
            >
              <GitMerge className="w-4 h-4" />
              <span>合併為兼任身分（斜線併列）</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
