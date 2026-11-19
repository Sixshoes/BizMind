import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Lightbulb,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  BookOpen,
  X,
} from 'lucide-react';

export interface TourStep {
  targetId: string;
  title: string;
  content: string;
  position: 'right' | 'bottom' | 'bottom-left' | 'bottom-right' | 'top' | 'left';
  requiredView?: 'search' | 'workspace';
}

interface TourOverlayProps {
  stepIndex: number;
  steps: TourStep[];
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
  onOpenFullGuide?: () => void;
}

export const TourOverlay: React.FC<TourOverlayProps> = ({
  stepIndex,
  steps,
  onNext,
  onPrev,
  onSkip,
  onOpenFullGuide,
}) => {
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const currentStep = steps[stepIndex];

  useEffect(() => {
    if (!currentStep) return;

    const updateRect = () => {
      const el = document.getElementById(currentStep.targetId);
      if (el) {
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          setTargetRect(rect);
          el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          return;
        }
      }
      setTargetRect(null);
    };

    // Allow view transition to settle before measuring target element
    const timer1 = setTimeout(updateRect, 80);
    const timer2 = setTimeout(updateRect, 240);
    window.addEventListener('resize', updateRect);
    return () => {
      window.removeEventListener('resize', updateRect);
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [stepIndex, currentStep]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onSkip();
      } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
        e.preventDefault();
        onNext();
      } else if (e.key === 'ArrowLeft' && stepIndex > 0) {
        e.preventDefault();
        onPrev();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [stepIndex, onNext, onPrev, onSkip]);

  if (!currentStep) return null;

  const cardWidth = Math.min(380, window.innerWidth - 24);
  const estimatedHeight = 250;
  const gap = 16;

  let top = Math.max(16, (window.innerHeight - estimatedHeight) / 2);
  let left = Math.max(12, (window.innerWidth - cardWidth) / 2);

  if (targetRect) {
    switch (currentStep.position) {
      case 'right':
        top = targetRect.top;
        left = targetRect.right + gap;
        break;
      case 'left':
        top = targetRect.top;
        left = targetRect.left - cardWidth - gap;
        break;
      case 'bottom':
        top = targetRect.bottom + gap;
        left = targetRect.left + targetRect.width / 2 - cardWidth / 2;
        break;
      case 'bottom-left':
        top = targetRect.bottom + gap;
        left = targetRect.left;
        break;
      case 'bottom-right':
        top = targetRect.bottom + gap;
        left = targetRect.right - cardWidth;
        break;
      case 'top':
        top = targetRect.top - estimatedHeight - gap;
        left = targetRect.left + targetRect.width / 2 - cardWidth / 2;
        break;
    }

    if (left < 12) left = 12;
    if (left + cardWidth > window.innerWidth - 12) {
      left = window.innerWidth - cardWidth - 12;
    }
    if (top < 12) top = 12;
    if (top + estimatedHeight > window.innerHeight - 12) {
      top = Math.max(12, window.innerHeight - estimatedHeight - 16);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[9999] overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-label="互動式步驟導覽"
    >
      <svg className="absolute inset-0 w-full h-full pointer-events-none">
        <defs>
          <mask id="tour-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {targetRect && (
              <rect
                x={targetRect.left - 6}
                y={targetRect.top - 6}
                width={targetRect.width + 12}
                height={targetRect.height + 12}
                rx="10"
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(15, 23, 42, 0.6)"
          mask="url(#tour-mask)"
        />
      </svg>

      {targetRect && (
        <div
          className="absolute rounded-xl pointer-events-none border-2 border-indigo-400 ring-4 ring-indigo-500/25 transition-all duration-200"
          style={{
            top: targetRect.top - 6,
            left: targetRect.left - 6,
            width: targetRect.width + 12,
            height: targetRect.height + 12,
          }}
        />
      )}

      <div
        className="absolute bg-white p-5 rounded-2xl shadow-2xl border border-slate-200 flex flex-col gap-4 transition-all duration-200"
        style={{ top, left, width: cardWidth }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0 text-indigo-600 mt-0.5">
              {stepIndex === 0 ? (
                <Sparkles className="w-4 h-4" />
              ) : stepIndex === steps.length - 1 ? (
                <CheckCircle2 className="w-4 h-4" />
              ) : (
                <Lightbulb className="w-4 h-4" />
              )}
            </div>
            <div className="min-w-0">
              <div className="text-xs font-semibold text-indigo-600 tabular-nums mb-0.5">
                互動操作導覽 · 步驟 {stepIndex + 1} / {steps.length}
              </div>
              <h3 className="text-base font-bold font-display text-slate-900 leading-snug">
                {currentStep.title}
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={onSkip}
            className="w-7 h-7 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 flex items-center justify-center shrink-0 transition-colors cursor-pointer"
            title="結束導覽 (Esc)"
            aria-label="結束導覽"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-sm text-slate-700 leading-relaxed">{currentStep.content}</p>

        {/* Progress Bar */}
        <div className="flex items-center gap-1.5">
          {steps.map((_, idx) => (
            <div
              key={idx}
              className={`h-1.5 rounded-full flex-1 transition-colors ${
                idx <= stepIndex ? 'bg-indigo-600' : 'bg-slate-200'
              }`}
            />
          ))}
        </div>

        <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200">
          {onOpenFullGuide ? (
            <button
              type="button"
              onClick={() => {
                onSkip();
                onOpenFullGuide();
              }}
              className="text-xs font-semibold text-indigo-700 hover:text-indigo-800 hover:underline flex items-center gap-1.5 py-1.5 cursor-pointer whitespace-nowrap"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>開啟完整教學手冊</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onSkip}
              className="text-xs font-semibold text-slate-600 hover:text-slate-900 px-2 py-1.5 cursor-pointer whitespace-nowrap"
            >
              結束導覽
            </button>
          )}

          <div className="flex items-center gap-2 shrink-0">
            {stepIndex > 0 && (
              <button
                type="button"
                onClick={onPrev}
                className="px-3 py-2 rounded-lg text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors flex items-center gap-1 cursor-pointer whitespace-nowrap"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>上一步</span>
              </button>
            )}
            <button
              type="button"
              onClick={onNext}
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <span>{stepIndex === steps.length - 1 ? '完成導覽' : '下一步'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
