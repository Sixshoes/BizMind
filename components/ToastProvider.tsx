
import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, CheckCircle, AlertCircle, Info, RotateCcw } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
  onUndo?: () => void;
}

interface ToastContextType {
  addToast: (toast: Omit<Toast, 'id'>) => string;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within a ToastProvider');
  return context;
};

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback(({ message, type, duration = 4000, onUndo }: Omit<Toast, 'id'>) => {
    const id = crypto.randomUUID();
    setToasts(prev => [...prev, { id, message, type, duration, onUndo }]);

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
    return id;
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 max-w-sm w-full">
        <AnimatePresence>
          {toasts.map(toast => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
              className={`
                flex items-center gap-3 p-4 rounded-xl shadow-lg border backdrop-blur-md
                ${toast.type === 'success' ? 'bg-emerald-50/90 border-emerald-200 text-emerald-800' : ''}
                ${toast.type === 'error' ? 'bg-rose-50/90 border-rose-200 text-rose-800' : ''}
                ${toast.type === 'info' ? 'bg-blue-50/90 border-blue-200 text-blue-800' : ''}
                ${toast.type === 'warning' ? 'bg-amber-50/90 border-amber-200 text-amber-800' : ''}
              `}
            >
              <div className="shrink-0">
                {toast.type === 'success' && <CheckCircle className="w-5 h-5 text-emerald-500" />}
                {toast.type === 'error' && <AlertCircle className="w-5 h-5 text-rose-500" />}
                {toast.type === 'info' && <Info className="w-5 h-5 text-blue-500" />}
                {toast.type === 'warning' && <AlertCircle className="w-5 h-5 text-amber-500" />}
              </div>
              
              <div className="flex-1 text-sm font-medium leading-relaxed">
                {toast.message}
              </div>

              {toast.onUndo && (
                <button
                  onClick={() => {
                    toast.onUndo?.();
                    removeToast(toast.id);
                  }}
                  className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-md bg-white/50 hover:bg-white text-xs font-bold transition-colors"
                >
                  <RotateCcw className="w-3 h-3" />
                  復原
                </button>
              )}

              <button
                onClick={() => removeToast(toast.id)}
                className="shrink-0 p-1 rounded-full hover:bg-black/5 transition-colors"
              >
                <X className="w-4 h-4 opacity-50" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
};
