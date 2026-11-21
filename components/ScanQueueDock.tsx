import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Loader2,
  Check,
  RefreshCw,
  Pause,
  Play,
  ChevronUp,
  ChevronDown,
  X,
  ScanLine,
} from 'lucide-react';
import { ProcessingTask } from '../types';

interface ScanQueueDockProps {
  tasks: ProcessingTask[];
  isPaused: boolean;
  onTogglePause: () => void;
  onRetryTask: (taskId: string) => void;
  onClearFinished: () => void;
  onSelectCompletedCard?: (taskId: string) => void;
  isMobile?: boolean;
}

export const ScanQueueDock: React.FC<ScanQueueDockProps> = ({
  tasks,
  isPaused,
  onTogglePause,
  onRetryTask,
  onClearFinished,
  onSelectCompletedCard,
  isMobile = false,
}) => {
  const [expanded, setExpanded] = useState(false);

  const completedCount = tasks.filter((t) => t.status === 'completed').length;
  const errorCount = tasks.filter((t) => t.status === 'error').length;
  const activeCount = tasks.filter((t) => t.status === 'processing' || t.status === 'pending').length;
  const allDone = tasks.length > 0 && activeCount === 0;
  const pct = tasks.length > 0 ? Math.round(((completedCount + errorCount) / tasks.length) * 100) : 0;

  return (
    <AnimatePresence>
      {tasks.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.96 }}
          transition={{ type: 'spring', stiffness: 420, damping: 32 }}
          className={`fixed z-40 w-[300px] sm:w-[320px] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden ${
            isMobile ? 'left-3 bottom-20' : 'left-5 bottom-5'
          }`}
        >
          {/* Header Bar */}
          <div className="px-3.5 py-2.5 flex items-center justify-between gap-2 bg-slate-900 dark:bg-slate-800 text-white">
            <button
              type="button"
              onClick={() => setExpanded((e) => !e)}
              className="flex items-center gap-2 min-w-0 flex-1 text-left cursor-pointer"
            >
              {activeCount > 0 && !isPaused ? (
                <Loader2 className="w-4 h-4 text-indigo-400 animate-spin shrink-0" />
              ) : (
                <ScanLine className="w-4 h-4 text-emerald-400 shrink-0" />
              )}
              <div className="min-w-0">
                <div className="text-xs font-bold truncate tabular-nums">
                  {isPaused && activeCount > 0
                    ? `辨識已暫停 (${completedCount}/${tasks.length})`
                    : activeCount > 0
                    ? `AI 正在辨識名片 (${completedCount}/${tasks.length})`
                    : errorCount > 0
                    ? `辨識完成 · ${errorCount} 筆失敗`
                    : `已完成 ${completedCount} 張名片辨識`}
                </div>
              </div>
            </button>

            <div className="flex items-center gap-1 shrink-0">
              {activeCount > 0 && (
                <button
                  type="button"
                  onClick={onTogglePause}
                  className="w-7 h-7 rounded-lg hover:bg-white/15 flex items-center justify-center transition-colors cursor-pointer"
                  title={isPaused ? '繼續背景辨識' : '暫停背景辨識'}
                  aria-label={isPaused ? '繼續背景辨識' : '暫停背景辨識'}
                >
                  {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                </button>
              )}
              <button
                type="button"
                onClick={() => setExpanded((e) => !e)}
                className="w-7 h-7 rounded-lg hover:bg-white/15 flex items-center justify-center transition-colors cursor-pointer"
                aria-label={expanded ? '收合佇列明細' : '展開佇列明細'}
              >
                {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
              </button>
              {allDone && (
                <button
                  type="button"
                  onClick={onClearFinished}
                  className="w-7 h-7 rounded-lg hover:bg-white/15 flex items-center justify-center transition-colors cursor-pointer"
                  title="清除佇列紀錄"
                  aria-label="清除佇列紀錄"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Progress Bar */}
          <div className="h-1 w-full bg-slate-200 dark:bg-slate-800">
            <div
              className={`h-full transition-all duration-300 ${
                errorCount > 0 && allDone
                  ? 'bg-amber-500'
                  : allDone
                  ? 'bg-emerald-500'
                  : 'bg-indigo-600'
              }`}
              style={{ width: `${Math.max(8, pct)}%` }}
            />
          </div>

          {/* Expandable Task List */}
          <AnimatePresence>
            {expanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.16 }}
                className="max-h-56 overflow-y-auto custom-scrollbar divide-y divide-slate-100 dark:divide-slate-800"
              >
                {tasks.map((task) => (
                  <div
                    key={task.id}
                    onClick={() => {
                      if (task.status === 'error') onRetryTask(task.id);
                      else if (task.status === 'completed') onSelectCompletedCard?.(task.id);
                    }}
                    className={`px-3 py-2 flex items-center gap-2.5 text-xs ${
                      task.status === 'error' || task.status === 'completed'
                        ? 'hover:bg-slate-50 dark:hover:bg-slate-800/70 cursor-pointer'
                        : ''
                    }`}
                  >
                    <div className="w-10 h-7 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 overflow-hidden shrink-0 flex items-center justify-center">
                      {task.previewUrl ? (
                        <img
                          src={task.previewUrl}
                          alt=""
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <ScanLine className="w-3.5 h-3.5 text-slate-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-slate-800 dark:text-slate-100 truncate">
                        {task.fileName}
                      </div>
                      <div
                        className={`text-[11px] truncate ${
                          task.status === 'error'
                            ? 'text-rose-600 dark:text-rose-400 font-medium'
                            : task.status === 'completed'
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        {task.status === 'processing'
                          ? 'AI 擷取與方向校正中...'
                          : task.status === 'pending'
                          ? '排隊等待處理'
                          : task.status === 'completed'
                          ? '辨識完成 · 點擊檢視'
                          : `${task.error || '辨識失敗'} · 點擊重試`}
                      </div>
                    </div>
                    <div className="shrink-0">
                      {task.status === 'processing' && (
                        <Loader2 className="w-4 h-4 text-indigo-600 animate-spin" />
                      )}
                      {task.status === 'completed' && (
                        <Check className="w-4 h-4 text-emerald-500" />
                      )}
                      {task.status === 'error' && (
                        <RefreshCw className="w-4 h-4 text-rose-500" />
                      )}
                    </div>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
