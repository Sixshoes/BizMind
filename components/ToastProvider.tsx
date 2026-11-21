import React, { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, CheckCircle2, AlertCircle, Info, AlertTriangle, RotateCcw } from 'lucide-react';

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

interface ToastItemProps {
  toast: Toast;
  onRemove: (id: string) => void;
}

const ToastItem: React.FC<ToastItemProps> = ({ toast, onRemove }) => {
  const duration = toast.duration ?? 4000;
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(100);
  const remainingRef = useRef(duration);
  const lastTickRef = useRef<number>(Date.now());

  useEffect(() => {
    if (duration <= 0) return;
    if (paused) return;

    lastTickRef.current = Date.now();
    const interval = setInterval(() => {
      const now = Date.now();
      const delta = now - lastTickRef.current;
      lastTickRef.current = now;
      remainingRef.current = Math.max(0, remainingRef.current - delta);
      setProgress((remainingRef.current / duration) * 100);
      if (remainingRef.current <= 0) {
        clearInterval(interval);
        onRemove(toast.id);
      }
    }, 50);

    return () => clearInterval(interval);
  }, [duration, paused, toast.id, onRemove]);

  const styleMap: Record<
    ToastType,
    { container: string; bar: string; icon: React.ReactNode }
  > = {
    success: {
      container:
        'bg-white/95 dark:bg-slate-900/95 border-emerald-200 dark:border-emerald-800/80 text-slate-800 dark:text-slate-100',
      bar: 'bg-emerald-500',
      icon: <CheckCircle2 className="w-4.5 h-4.5 text-emerald-500 shrink-0" />,
    },
    error: {
      container:
        'bg-white/95 dark:bg-slate-900/95 border-rose-200 dark:border-rose-800/80 text-slate-800 dark:text-slate-100',
      bar: 'bg-rose-500',
      icon: <AlertCircle className="w-4.5 h-4.5 text-rose-500 shrink-0" />,
    },
    warning: {
      container:
        'bg-white/95 dark:bg-slate-900/95 border-amber-200 dark:border-amber-800/80 text-slate-800 dark:text-slate-100',
      bar: 'bg-amber-500',
      icon: <AlertTriangle className="w-4.5 h-4.5 text-amber-500 shrink-0" />,
    },
    info: {
      container:
        'bg-white/95 dark:bg-slate-900/95 border-indigo-200 dark:border-indigo-800/80 text-slate-800 dark:text-slate-100',
      bar: 'bg-indigo-500',
      icon: <Info className="w-4.5 h-4.5 text-indigo-500 shrink-0" />,
    },
  };

  const styles = styleMap[toast.type];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -12, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: 24, scale: 0.96, transition: { duration: 0.16 } }}
      transition={{ type: 'spring', stiffness: 460, damping: 32 }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      role="status"
      aria-live="polite"
      className={`pointer-events-auto relative overflow-hidden flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border backdrop-blur-md ${styles.container}`}
    >
      {styles.icon}

      <div className="flex-1 text-[13.5px] font-medium leading-snug">{toast.message}</div>

      {toast.onUndo && (
        <button
          type="button"
          onClick={() => {
            toast.onUndo?.();
            onRemove(toast.id);
          }}
          className="shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/70 hover:bg-indigo-100 dark:hover:bg-indigo-900/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800 text-xs font-bold transition-colors cursor-pointer"
        >
          <RotateCcw className="w-3 h-3" />
          復原
        </button>
      )}

      <button
        type="button"
        onClick={() => onRemove(toast.id)}
        className="shrink-0 w-6 h-6 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 flex items-center justify-center transition-colors cursor-pointer"
        aria-label="關閉通知"
      >
        <X className="w-3.5 h-3.5" />
      </button>

      {duration > 0 && (
        <div className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-slate-100 dark:bg-slate-800">
          <div
            className={`h-full transition-[width] duration-75 ease-linear ${styles.bar}`}
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </motion.div>
  );
};

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(({ message, type, duration = 4000, onUndo }: Omit<Toast, 'id'>) => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev.slice(-3), { id, message, type, duration, onUndo }]);
    return id;
  }, []);

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      {/* Positioned top-right (desktop) / top-center (mobile) to eliminate overlap with ChatBox & BatchEditBar */}
      <div className="pointer-events-none fixed top-3 inset-x-3 sm:inset-x-auto sm:top-[68px] sm:right-5 z-[9999] flex flex-col gap-2.5 sm:max-w-sm sm:w-full">
        <AnimatePresence mode="popLayout">
          {toasts.map((toast) => (
            <ToastItem key={toast.id} toast={toast} onRemove={removeToast} />
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
};
