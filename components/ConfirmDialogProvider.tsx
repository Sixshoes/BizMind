import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { AlertTriangle, Trash2, Info, X } from 'lucide-react';

export interface ConfirmDialogOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'primary';
}

interface ActiveConfirmState extends ConfirmDialogOptions {
  resolve: (confirmed: boolean) => void;
}

interface ConfirmDialogContextValue {
  confirm: (options: ConfirmDialogOptions) => Promise<boolean>;
}

const ConfirmDialogContext = createContext<ConfirmDialogContextValue | undefined>(undefined);

export const useConfirm = () => {
  const ctx = useContext(ConfirmDialogContext);
  if (!ctx) {
    throw new Error('useConfirm must be used within ConfirmDialogProvider');
  }
  return ctx.confirm;
};

export const ConfirmDialogProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [dialog, setDialog] = useState<ActiveConfirmState | null>(null);

  const confirm = useCallback((options: ConfirmDialogOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setDialog({
        confirmLabel: '確認執行',
        cancelLabel: '取消',
        variant: 'primary',
        ...options,
        resolve,
      });
    });
  }, []);

  const handleClose = useCallback((result: boolean) => {
    setDialog((prev) => {
      if (prev) prev.resolve(result);
      return null;
    });
  }, []);

  useEffect(() => {
    if (!dialog) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleClose(false);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleClose(true);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [dialog, handleClose]);

  const variantConfig = {
    danger: {
      iconBg: 'bg-rose-50 text-rose-600 border-rose-200',
      btn: 'bg-rose-600 hover:bg-rose-700 text-white focus-visible:ring-rose-500',
      Icon: Trash2,
    },
    warning: {
      iconBg: 'bg-amber-50 text-amber-600 border-amber-200',
      btn: 'bg-amber-600 hover:bg-amber-700 text-white focus-visible:ring-amber-500',
      Icon: AlertTriangle,
    },
    primary: {
      iconBg: 'bg-indigo-50 text-indigo-600 border-indigo-200',
      btn: 'bg-indigo-600 hover:bg-indigo-700 text-white focus-visible:ring-indigo-500',
      Icon: Info,
    },
  }[dialog?.variant || 'primary'];

  const IconComp = variantConfig.Icon;

  return (
    <ConfirmDialogContext.Provider value={{ confirm }}>
      {children}
      {dialog && (
        <div
          className="fixed inset-0 z-[10000] bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn"
          onClick={() => handleClose(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-dialog-title"
        >
          <div
            className="bg-white w-full max-w-md rounded-xl border border-slate-200 shadow-xl overflow-hidden animate-scaleUp"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 flex items-start gap-4">
              <div className={`w-10 h-10 rounded-lg border flex items-center justify-center shrink-0 ${variantConfig.iconBg}`}>
                <IconComp className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h3 id="confirm-dialog-title" className="text-base font-semibold font-display text-slate-900">
                    {dialog.title}
                  </h3>
                  <button
                    type="button"
                    onClick={() => handleClose(false)}
                    className="w-7 h-7 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
                    aria-label="關閉"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <p className="mt-2 text-sm text-slate-600 whitespace-pre-line leading-relaxed">
                  {dialog.message}
                </p>
              </div>
            </div>
            <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => handleClose(false)}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 transition-colors cursor-pointer whitespace-nowrap"
              >
                {dialog.cancelLabel}
              </button>
              <button
                type="button"
                autoFocus
                onClick={() => handleClose(true)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 ${variantConfig.btn}`}
              >
                {dialog.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmDialogContext.Provider>
  );
};
