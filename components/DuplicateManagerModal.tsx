import React, { useState, useMemo } from 'react';
import {
  Layers,
  Zap,
  Check,
  Trash2,
  X,
  Info,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import { DuplicateGroup, calculateCardQualityScore } from '../utils/duplicateUtils';
import { CardThumbnail } from './CardThumbnail';

interface DuplicateManagerModalProps {
  groups: DuplicateGroup[];
  onClose: () => void;
  onAutoCleanAll: (groupKeepMap: Map<string, string>) => Promise<void>;
  onDeleteSingle: (cardId: string) => Promise<void>;
  onBatchDelete: (cardIds: string[]) => Promise<void>;
  isProcessing?: boolean;
}

export const DuplicateManagerModal: React.FC<DuplicateManagerModalProps> = ({
  groups,
  onClose,
  onAutoCleanAll,
  onDeleteSingle,
  onBatchDelete,
  isProcessing = false,
}) => {
  const [keepMap, setKeepMap] = useState<Map<string, string>>(() => {
    const map = new Map<string, string>();
    groups.forEach((g) => {
      map.set(g.id, g.primaryCardId);
    });
    return map;
  });

  const [selectedDeletions, setSelectedDeletions] = useState<Set<string>>(() => {
    const set = new Set<string>();
    groups.forEach((g) => {
      const keepId = g.primaryCardId;
      g.cards.forEach((c) => {
        if (c.id !== keepId) {
          set.add(c.id);
        }
      });
    });
    return set;
  });

  const redundantCount = useMemo(() => {
    return groups.reduce((acc, g) => acc + (g.cards.length - 1), 0);
  }, [groups]);

  const handleSelectKeep = (groupId: string, cardId: string) => {
    const newKeepMap = new Map(keepMap);
    newKeepMap.set(groupId, cardId);
    setKeepMap(newKeepMap);

    const newSelected = new Set(selectedDeletions);
    const targetGroup = groups.find((g) => g.id === groupId);
    if (targetGroup) {
      targetGroup.cards.forEach((c) => {
        if (c.id === cardId) {
          newSelected.delete(c.id);
        } else {
          newSelected.add(c.id);
        }
      });
    }
    setSelectedDeletions(newSelected);
  };

  return (
    <div
      className="fixed inset-0 z-[9999] bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-white w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl shadow-xl overflow-hidden border border-slate-200 animate-scaleUp"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex justify-between items-center bg-white">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center shrink-0">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-semibold font-display text-slate-900">
                  重複聯絡人偵測與合併管理
                </h3>
                <span className="text-xs font-semibold text-amber-700 tabular-nums">
                  · {groups.length} 組重複 ({redundantCount} 筆可合併清理)
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                自動保留完整度最高之主紀錄，並將重複卡片的備註、電話、標籤與反面影像合併至主名片
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
            aria-label="關閉"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Action Strip */}
        <div className="bg-amber-50/60 border-b border-amber-200/70 px-5 py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-amber-900">
            <Info className="w-4 h-4 text-amber-600 shrink-0" />
            <span>點擊任一張名片可改設為「主保留項目」，再執行自動合併清理。</span>
          </div>
          <button
            type="button"
            onClick={() => onAutoCleanAll(keepMap)}
            disabled={isProcessing || groups.length === 0}
            className="w-full sm:w-auto px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shrink-0 tabular-nums"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>合併清理中...</span>
              </>
            ) : (
              <>
                <Zap className="w-3.5 h-3.5" />
                <span>一鍵合併並清理 ({redundantCount} 筆)</span>
              </>
            )}
          </button>
        </div>

        {/* Groups List */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 custom-scrollbar bg-slate-50/60">
          {groups.length === 0 ? (
            <div className="py-14 text-center text-slate-500 flex flex-col items-center">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mb-3" />
              <p className="text-sm font-semibold text-slate-800">名片庫目前沒有任何重複項目</p>
            </div>
          ) : (
            groups.map((group, groupIndex) => {
              const currentKeepId = keepMap.get(group.id) || group.primaryCardId;

              return (
                <div
                  key={group.id}
                  className="bg-white rounded-xl border border-slate-200 overflow-hidden"
                >
                  <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs font-mono font-semibold text-indigo-600 tabular-nums">
                        #{groupIndex + 1}
                      </span>
                      <h4 className="font-semibold text-slate-800 text-xs truncate">
                        {group.reason}
                      </h4>
                    </div>
                    <span className="text-xs text-slate-500 tabular-nums">
                      共 {group.cards.length} 筆相似紀錄
                    </span>
                  </div>

                  <div className="p-3.5 space-y-2">
                    {group.cards.map((card) => {
                      const isKeep = card.id === currentKeepId;
                      const isMarkedDelete = selectedDeletions.has(card.id);
                      const qualityScore = calculateCardQualityScore(card);
                      const isRecommendedOriginal = card.id === group.primaryCardId;

                      return (
                        <div
                          key={card.id}
                          onClick={() => handleSelectKeep(group.id, card.id)}
                          className={`p-3 rounded-lg border transition-colors cursor-pointer flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                            isKeep
                              ? 'bg-emerald-50/40 border-emerald-400 ring-1 ring-emerald-400/20'
                              : isMarkedDelete
                              ? 'bg-rose-50/20 border-rose-200 hover:border-rose-300'
                              : 'bg-white border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div
                              className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                                isKeep
                                  ? 'border-emerald-600 bg-emerald-600 text-white'
                                  : 'border-slate-300 bg-white'
                              }`}
                            >
                              {isKeep && <Check className="w-3 h-3" />}
                            </div>

                            <CardThumbnail card={card} size="md" className="rounded-md" />

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-semibold text-slate-900 text-sm">
                                  {`${card.lastName || ''}${card.firstName || ''}` ||
                                    card.company ||
                                    '未命名'}
                                </span>
                                {card.title && (
                                  <span className="text-xs text-slate-500">· {card.title}</span>
                                )}
                                {isKeep && (
                                  <span className="text-[11px] font-semibold text-emerald-700">
                                    · 保留主版本
                                  </span>
                                )}
                                {!isKeep && isRecommendedOriginal && (
                                  <span className="text-[11px] font-medium text-indigo-600">
                                    · 系統推薦
                                  </span>
                                )}
                                {!isKeep && isMarkedDelete && (
                                  <span className="text-[11px] font-medium text-rose-600">
                                    · 待合併移除
                                  </span>
                                )}
                              </div>

                              <div className="text-xs text-slate-600 mt-0.5 truncate">
                                {[card.company || '無公司', card.country, card.email, card.phone]
                                  .filter(Boolean)
                                  .join(' · ')}
                              </div>

                              <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-2 tabular-nums">
                                <span>掃描日期：{new Date(card.scannedAt).toLocaleDateString()}</span>
                                <span>·</span>
                                <span>完整度：{qualityScore} 分</span>
                                {card.syncStatus === 'firebase' && (
                                  <>
                                    <span>·</span>
                                    <span className="text-sky-600 font-medium">已同步雲端</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          <div
                            className="flex items-center gap-2 self-end sm:self-center shrink-0"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {isKeep ? (
                              <span className="text-xs font-semibold text-emerald-700 px-2.5 py-1">
                                主保留項目
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => onDeleteSingle(card.id)}
                                disabled={isProcessing}
                                className="px-2.5 py-1.5 bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                                title="直接刪除此筆重複資料"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>單獨刪除</span>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-slate-200 bg-white flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-500 tabular-nums">
            {selectedDeletions.size > 0 ? (
              <span>
                已標記 <strong className="text-slate-900">{selectedDeletions.size}</strong> 筆冗餘名片待清理
              </span>
            ) : (
              <span>目前無選取待清理名片</span>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {selectedDeletions.size > 0 && (
              <button
                type="button"
                onClick={() => onBatchDelete(Array.from(selectedDeletions))}
                disabled={isProcessing}
                className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-semibold rounded-lg text-xs transition-colors cursor-pointer flex items-center gap-1.5 tabular-nums"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>僅刪除勾選 ({selectedDeletions.size})</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              disabled={isProcessing}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-xs transition-colors cursor-pointer"
            >
              關閉
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
