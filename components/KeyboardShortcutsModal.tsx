import React, { useEffect } from 'react';
import { Keyboard, X, BookOpen } from 'lucide-react';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenUserGuide?: () => void;
}

const SHORTCUT_ITEMS = [
  { keys: ['⌘ / Ctrl', 'K'], desc: '快速切換「名片資料庫」與「審閱工作台」視圖' },
  { keys: ['J', '或', '↓'], desc: '在審閱工作台切換至下一張名片' },
  { keys: ['K', '或', '↑'], desc: '在審閱工作台切換至上一張名片' },
  { keys: ['1'], desc: '將目前名片歸類為 企業夥伴 (Business)' },
  { keys: ['2'], desc: '將目前名片歸類為 學研專家 (Academic)' },
  { keys: ['3'], desc: '將目前名片歸類為 機關社團 (Organization)' },
  { keys: ['4'], desc: '將目前名片歸類為 一般聯絡人 (General)' },
  { keys: ['Q'], desc: '開啟目前名片的 vCard QR Code 預覽' },
  { keys: ['E'], desc: '開啟目前名片的跟進開發信草稿抽屜' },
  { keys: ['?'], desc: '開啟或關閉此鍵盤快捷鍵說明' },
  { keys: ['Esc'], desc: '關閉目前開啟的對話視窗或抽屜' },
];

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({
  isOpen,
  onClose,
  onOpenUserGuide,
}) => {
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
        className="bg-white w-full max-w-lg rounded-2xl border border-slate-200 shadow-xl overflow-hidden animate-scaleUp"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-slate-100 text-slate-700 border border-slate-200 flex items-center justify-center shrink-0">
              <Keyboard className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold font-display text-slate-900">鍵盤快捷鍵導覽</h3>
              <p className="text-xs text-slate-600">未聚焦於輸入框時可直接觸發，加速大量名片審閱</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
            aria-label="關閉"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 divide-y divide-slate-100 max-h-[65vh] overflow-y-auto custom-scrollbar">
          {SHORTCUT_ITEMS.map((item, i) => (
            <div
              key={i}
              className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-4"
            >
              <span className="text-sm text-slate-800 leading-snug">{item.desc}</span>
              <div className="flex items-center gap-1 shrink-0">
                {item.keys.map((k, kIdx) =>
                  k === '或' ? (
                    <span key={kIdx} className="text-xs text-slate-500 px-0.5">
                      /
                    </span>
                  ) : (
                    <kbd
                      key={kIdx}
                      className="px-2.5 py-1 text-xs font-mono font-semibold text-slate-800 bg-slate-100 border border-slate-300 rounded-md shadow-2xs"
                    >
                      {k}
                    </kbd>
                  )
                )}
              </div>
            </div>
          ))}
        </div>

        {onOpenUserGuide && (
          <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
            <span className="text-xs text-slate-600">需要了解完整工作流程與分類規範？</span>
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenUserGuide();
              }}
              className="text-sm font-semibold text-indigo-700 hover:text-indigo-800 hover:underline flex items-center gap-1.5 cursor-pointer"
            >
              <BookOpen className="w-4 h-4" />
              <span>開啟完整使用教學</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
