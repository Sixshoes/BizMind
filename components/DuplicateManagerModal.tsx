import React, { useState, useMemo } from 'react';
import { BusinessCardData } from '../types';
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
  isProcessing = false
}) => {
  // Map of groupId -> cardId to keep
  const [keepMap, setKeepMap] = useState<Map<string, string>>(() => {
    const map = new Map<string, string>();
    groups.forEach(g => {
      map.set(g.id, g.primaryCardId);
    });
    return map;
  });

  // Set of selected cards for manual deletion
  const [selectedDeletions, setSelectedDeletions] = useState<Set<string>>(() => {
    const set = new Set<string>();
    groups.forEach(g => {
      const keepId = g.primaryCardId;
      g.cards.forEach(c => {
        if (c.id !== keepId) {
          set.add(c.id);
        }
      });
    });
    return set;
  });

  // Calculate stats
  const totalCardsInGroups = useMemo(() => {
    return groups.reduce((acc, g) => acc + g.cards.length, 0);
  }, [groups]);

  const redundantCount = useMemo(() => {
    return groups.reduce((acc, g) => acc + (g.cards.length - 1), 0);
  }, [groups]);

  const handleSelectKeep = (groupId: string, cardId: string) => {
    const newKeepMap = new Map(keepMap);
    newKeepMap.set(groupId, cardId);
    setKeepMap(newKeepMap);

    // Update selected deletions
    const newSelected = new Set(selectedDeletions);
    const targetGroup = groups.find(g => g.id === groupId);
    if (targetGroup) {
      targetGroup.cards.forEach(c => {
        if (c.id === cardId) {
          newSelected.delete(c.id);
        } else {
          newSelected.add(c.id);
        }
      });
    }
    setSelectedDeletions(newSelected);
  };

  const handleToggleCardDelete = (cardId: string, groupId: string) => {
    const currentKeepId = keepMap.get(groupId);
    if (cardId === currentKeepId) {
      // Cannot delete the keep card without picking another keep card
      return;
    }
    const newSelected = new Set(selectedDeletions);
    if (newSelected.has(cardId)) {
      newSelected.delete(cardId);
    } else {
      newSelected.add(cardId);
    }
    setSelectedDeletions(newSelected);
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-fadeIn">
      <div className="bg-white w-full max-w-3xl max-h-[92vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden border border-slate-200">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-md shadow-amber-200 shrink-0">
              <i className="fa-solid fa-wand-magic-sparkles text-lg"></i>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg sm:text-xl font-black text-slate-900">智慧移除重複名片</h3>
                <span className="bg-rose-50 text-rose-600 text-xs font-bold px-2 py-0.5 rounded-full border border-rose-100">
                  {groups.length} 組重複 ({redundantCount} 張可清理)
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                判定標準：必須同時符合 <span className="font-bold text-slate-700">Email</span> 與 <span className="font-bold text-slate-700">姓名</span>，且至少再符合 1 項其他欄位（如公司、電話、職稱等，共 3 項以上）
              </p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose} 
            disabled={isProcessing}
            className="w-9 h-9 rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-slate-600 hover:bg-slate-50 flex items-center justify-center transition-colors cursor-pointer"
            title="關閉"
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        {/* Quick Action Banner */}
        <div className="bg-amber-50/60 border-b border-amber-100 px-4 sm:px-6 py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-amber-900 font-medium">
            <i className="fa-solid fa-circle-info text-amber-500 text-sm shrink-0"></i>
            <span>執行「自動一鍵清理」會將重複項的補充欄位（備註、電話、紙本數）自動合併至主名片中，並安全刪除多餘重複項。</span>
          </div>
          <button
            type="button"
            onClick={() => onAutoCleanAll(keepMap)}
            disabled={isProcessing || groups.length === 0}
            className="w-full sm:w-auto px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-black flex items-center justify-center gap-2 shadow-md shadow-indigo-100 transition-all cursor-pointer shrink-0"
          >
            {isProcessing ? (
              <>
                <i className="fa-solid fa-circle-notch fa-spin"></i>
                <span>清理合併中...</span>
              </>
            ) : (
              <>
                <i className="fa-solid fa-bolt"></i>
                <span>一鍵自動清理 ({redundantCount} 張)</span>
              </>
            )}
          </button>
        </div>

        {/* Groups List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 custom-scrollbar bg-slate-50/40">
          {groups.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <i className="fa-solid fa-circle-check text-4xl text-emerald-500 mb-3"></i>
              <p className="text-base font-bold text-slate-700">太棒了！名片庫已沒有任何重複項目</p>
            </div>
          ) : (
            groups.map((group, groupIndex) => {
              const currentKeepId = keepMap.get(group.id) || group.primaryCardId;
              
              return (
                <div key={group.id} className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
                  
                  {/* Group Header */}
                  <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200/70 flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-[11px] font-black flex items-center justify-center">
                        {groupIndex + 1}
                      </span>
                      <h4 className="font-bold text-slate-800 text-sm">
                        {group.reason}
                      </h4>
                    </div>
                    <span className="text-[11px] text-slate-400 font-medium">
                      共 {group.cards.length} 筆相似資料
                    </span>
                  </div>

                  {/* Cards in Group */}
                  <div className="p-3 sm:p-4 space-y-2.5">
                    {group.cards.map(card => {
                      const isKeep = card.id === currentKeepId;
                      const isMarkedDelete = selectedDeletions.has(card.id);
                      const qualityScore = calculateCardQualityScore(card);
                      const isRecommendedOriginal = card.id === group.primaryCardId;

                      return (
                        <div 
                          key={card.id}
                          onClick={() => handleSelectKeep(group.id, card.id)}
                          className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                            isKeep
                              ? 'bg-emerald-50/40 border-emerald-400 ring-2 ring-emerald-400/20'
                              : isMarkedDelete
                              ? 'bg-rose-50/20 border-rose-200 hover:border-rose-300'
                              : 'bg-white border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          {/* Selection Control & Thumbnail */}
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className="shrink-0 flex items-center justify-center">
                              <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${
                                isKeep 
                                  ? 'border-emerald-600 bg-emerald-600 text-white' 
                                  : 'border-slate-300 bg-white'
                              }`}>
                                {isKeep && <i className="fa-solid fa-check text-[10px]"></i>}
                              </div>
                            </div>

                            {/* Card Image / Avatar */}
                            <CardThumbnail card={card} size="lg" className="rounded-lg shadow-2xs" />

                            {/* Card Info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-slate-900 text-sm">
                                  {`${card.lastName || ''}${card.firstName || ''}` || card.company || '未命名'}
                                </span>
                                {card.title && (
                                  <span className="text-xs text-slate-500 font-medium">
                                    • {card.title}
                                  </span>
                                )}
                                {isKeep && (
                                  <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1">
                                    <i className="fa-solid fa-star text-[9px]"></i> 保留此主版本
                                  </span>
                                )}
                                {!isKeep && isRecommendedOriginal && (
                                  <span className="bg-blue-50 text-blue-700 text-[10px] font-bold px-1.5 py-0.5 rounded border border-blue-200">
                                    AI 建議
                                  </span>
                                )}
                                {!isKeep && isMarkedDelete && (
                                  <span className="bg-rose-100 text-rose-700 text-[10px] font-bold px-1.5 py-0.5 rounded">
                                    預計刪除
                                  </span>
                                )}
                              </div>

                              <div className="text-xs text-slate-600 mt-0.5 flex items-center gap-2 flex-wrap">
                                <span className="font-medium text-slate-700">{card.company || '無公司'}</span>
                                {card.country && (
                                  <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded">
                                    📍 {card.country}
                                  </span>
                                )}
                                {card.email && (
                                  <span className="text-slate-500 text-[11px] truncate max-w-[180px]">
                                    ✉️ {card.email}
                                  </span>
                                )}
                                {card.phone && (
                                  <span className="text-slate-500 text-[11px]">
                                    📞 {card.phone}
                                  </span>
                                )}
                              </div>

                              <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-3">
                                <span>掃描於: {new Date(card.scannedAt).toLocaleDateString()}</span>
                                <span>完整度評分: <strong className="text-slate-600">{qualityScore} 分</strong></span>
                                {card.syncStatus === 'notion' && (
                                  <span className="text-emerald-600 font-medium">✓ 已同步 Notion</span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Action Button */}
                          <div className="flex items-center gap-2 self-end sm:self-center shrink-0" onClick={e => e.stopPropagation()}>
                            {isKeep ? (
                              <span className="text-xs font-bold text-emerald-700 px-2 py-1 bg-emerald-100/70 rounded-lg">
                                主要保留項目
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => onDeleteSingle(card.id)}
                                disabled={isProcessing}
                                className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                                title="直接刪除此筆重複資料"
                              >
                                <i className="fa-solid fa-trash-can text-[11px]"></i>
                                <span>刪除</span>
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

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-slate-100 bg-white flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-500">
            {selectedDeletions.size > 0 ? (
              <span>已勾選 <strong className="text-slate-900">{selectedDeletions.size}</strong> 張重複名片進行清理</span>
            ) : (
              <span>無選取的重複名片</span>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {selectedDeletions.size > 0 && (
              <button
                type="button"
                onClick={() => onBatchDelete(Array.from(selectedDeletions))}
                disabled={isProcessing}
                className="flex-1 sm:flex-none px-4 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition-colors shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
              >
                <i className="fa-solid fa-trash-can"></i>
                <span>刪除選取的 {selectedDeletions.size} 張</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              disabled={isProcessing}
              className="flex-1 sm:flex-none px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
            >
              完成
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
