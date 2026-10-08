import React, { useState, useEffect } from 'react';
import { BusinessCardData } from '../types';
import { CardThumbnail } from './CardThumbnail';
import { saveAllCardsToDB } from '../services/dbService';
import { useToast } from './ToastProvider';

interface NotionTrashModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRestoredCards: (restored: BusinessCardData[]) => void;
  onLoadAllFromNotion?: () => void;
}

export const NotionTrashModal: React.FC<NotionTrashModalProps> = ({
  isOpen,
  onClose,
  onRestoredCards,
  onLoadAllFromNotion
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [archivedCards, setArchivedCards] = useState<BusinessCardData[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { addToast } = useToast();

  const fetchArchivedCards = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch('/api/notion/archived');
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || '無法讀取 Notion 封存名片');
      }
      setArchivedCards(data.archivedCards || []);
      setSelectedIds(new Set((data.archivedCards || []).map((c: any) => c.id)));
    } catch (e: any) {
      setErrorMessage(e.message || '查詢失敗');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchArchivedCards();
    }
  }, [isOpen]);

  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === archivedCards.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(archivedCards.map(c => c.id)));
    }
  };

  const handleRestoreSelected = async () => {
    const idsToRestore = Array.from(selectedIds);
    if (idsToRestore.length === 0) return;

    setIsRestoring(true);
    try {
      const res = await fetch('/api/notion/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageIds: idsToRestore })
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || '還原失敗');
      }

      const restoredCardsList = archivedCards.filter(c => selectedIds.has(c.id));
      await saveAllCardsToDB(restoredCardsList);
      onRestoredCards(restoredCardsList);

      addToast({
        type: 'success',
        message: `🎉 成功還原 ${data.restoredCount} 筆名片回 Notion 與系統中！`
      });

      // Update remaining list
      setArchivedCards(prev => prev.filter(c => !selectedIds.has(c.id)));
      setSelectedIds(new Set());

      if (restoredCardsList.length === archivedCards.length) {
        setTimeout(onClose, 1000);
      }
    } catch (err: any) {
      addToast({
        type: 'error',
        message: `還原過程發生錯誤: ${err.message}`
      });
    } finally {
      setIsRestoring(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-fadeIn">
      <div className="bg-white w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden border border-slate-200">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-200 shrink-0">
              <i className="fa-solid fa-box-archive text-lg"></i>
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <span>Notion 封存與垃圾桶名片檢查</span>
                {!isLoading && (
                  <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                    archivedCards.length > 0 
                      ? 'bg-amber-100 text-amber-800' 
                      : 'bg-emerald-100 text-emerald-800'
                  }`}>
                    {archivedCards.length} 筆已封存
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                自動掃描 Notion 資料庫中已被封存或移至垃圾桶的名片，支援一鍵直接還原
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isRestoring}
            className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 flex items-center justify-center transition-colors cursor-pointer"
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        {/* Action Bar */}
        {!isLoading && archivedCards.length > 0 && (
          <div className="bg-indigo-50/60 px-4 sm:px-6 py-2.5 border-b border-indigo-100 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="select-all-trash"
                checked={selectedIds.size === archivedCards.length && archivedCards.length > 0}
                onChange={handleSelectAll}
                className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer accent-indigo-600"
              />
              <label htmlFor="select-all-trash" className="text-xs font-bold text-slate-700 cursor-pointer select-none">
                全選 (已選 {selectedIds.size} / {archivedCards.length} 筆)
              </label>
            </div>

            <button
              type="button"
              onClick={handleRestoreSelected}
              disabled={isRestoring || selectedIds.size === 0}
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-xs font-black flex items-center gap-1.5 shadow-sm shadow-indigo-200 transition-all cursor-pointer"
            >
              {isRestoring ? (
                <>
                  <i className="fa-solid fa-circle-notch fa-spin"></i>
                  <span>還原中...</span>
                </>
              ) : (
                <>
                  <i className="fa-solid fa-rotate-left"></i>
                  <span>一鍵還原選取名片 ({selectedIds.size})</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar bg-slate-50/40">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-56 text-slate-400 gap-3">
              <i className="fa-solid fa-circle-notch fa-spin text-3xl text-indigo-500"></i>
              <span className="text-xs font-bold text-slate-600">正在自動掃描 Notion 資料庫垃圾桶中...</span>
            </div>
          ) : errorMessage ? (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
              <i className="fa-solid fa-triangle-exclamation text-base"></i>
              <span>{errorMessage}</span>
            </div>
          ) : archivedCards.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 px-4 text-slate-400 gap-3">
              <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-2xl shadow-xs">
                <i className="fa-solid fa-check"></i>
              </div>
              <div className="text-center">
                <h4 className="text-base font-black text-slate-800">Notion 垃圾桶中目前為 0 筆封存</h4>
                <p className="text-xs text-slate-500 mt-1 max-w-md leading-relaxed">
                  這代表您的 Notion 資料庫中<strong>沒有任何名片被刪除或移至垃圾桶</strong>，所有名片都完好儲存於 Notion 中！
                </p>
              </div>

              {onLoadAllFromNotion && (
                <div className="mt-3 p-4 bg-indigo-50/70 border border-indigo-100 rounded-xl flex flex-col items-center gap-2.5 max-w-sm w-full">
                  <span className="text-xs text-indigo-900 font-bold text-center">
                    想要將 Notion 上的所有名片完整載入回本系統嗎？
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onLoadAllFromNotion();
                    }}
                    className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-black flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
                  >
                    <i className="fa-solid fa-cloud-arrow-down text-sm"></i>
                    <span>立即從 Notion 載入全部名片 📥</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {archivedCards.map(c => {
                const displayName = (c.firstName || c.lastName)
                  ? `${c.firstName || ''} ${c.lastName || ''}`.trim()
                  : (c.company || '未知名片');

                const isChecked = selectedIds.has(c.id);

                return (
                  <div
                    key={c.id}
                    onClick={() => handleToggleSelect(c.id)}
                    className={`p-3 rounded-xl border flex items-center gap-3 transition-all cursor-pointer ${
                      isChecked 
                        ? 'bg-white border-indigo-400 shadow-xs ring-1 ring-indigo-300/30' 
                        : 'bg-white/70 border-slate-200 hover:border-slate-300 opacity-85'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => handleToggleSelect(c.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer accent-indigo-600 shrink-0"
                    />

                    <CardThumbnail card={c} size="md" className="rounded-lg shadow-2xs" />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-slate-800 truncate">
                          {displayName}
                        </span>
                        {c.category && (
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-600">
                            {c.category}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 truncate mt-0.5 font-medium">
                        {c.company || '無公司'} {c.title ? `• ${c.title}` : ''}
                      </div>
                      {(c.email || c.phone) && (
                        <div className="text-[11px] text-slate-400 truncate mt-0.5">
                          {c.email} {c.phone ? `• ${c.phone}` : ''}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 border-t border-slate-100 flex justify-between items-center bg-white">
          <button
            type="button"
            onClick={fetchArchivedCards}
            disabled={isLoading || isRestoring}
            className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <i className="fa-solid fa-arrows-rotate text-xs"></i>
            <span>重新整理掃描</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            disabled={isRestoring}
            className="px-4 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          >
            關閉
          </button>
        </div>
      </div>
    </div>
  );
};
