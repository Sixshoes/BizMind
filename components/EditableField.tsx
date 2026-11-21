import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Copy,
  Check,
  ExternalLink,
  PhoneCall,
  MapPin,
  Mail,
  ArrowLeftRight,
  ChevronDown,
  AlertCircle,
} from 'lucide-react';
import { useToast } from './ToastProvider';

export type FieldActionType = 'email' | 'phone' | 'website' | 'address';

interface EditableFieldProps {
  id?: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  icon?: React.ReactNode;
  className?: string;
  isTextArea?: boolean;
  translation?: string;
  onSwapTranslation?: () => void;
  options?: (string | { value: string; label: string })[];
  placeholder?: string;
  actionType?: FieldActionType;
  onEmailAction?: () => void;
  isMissing?: boolean;
  missingHint?: string;
}

const EditableField = React.memo(
  ({
    id,
    label,
    value,
    onChange,
    onBlur,
    icon,
    className,
    isTextArea,
    translation,
    onSwapTranslation,
    options,
    placeholder,
    actionType,
    onEmailAction,
    isMissing = false,
    missingHint,
  }: EditableFieldProps) => {
    const { addToast } = useToast();
    const [copied, setCopied] = useState(false);
    const [comboOpen, setComboOpen] = useState(false);
    const [highlightIdx, setHighlightIdx] = useState(0);
    const comboRef = useRef<HTMLDivElement>(null);

    const normalizedOptions = useMemo(() => {
      if (!options || options.length === 0) return [];
      return options.map((opt) =>
        typeof opt === 'object' ? opt : { value: opt, label: opt }
      );
    }, [options]);

    const filteredOptions = useMemo(() => {
      if (!comboOpen || normalizedOptions.length === 0) return [];
      const q = (value || '').trim().toLowerCase();
      if (!q) return normalizedOptions.slice(0, 60);
      return normalizedOptions
        .filter(
          (o) => o.value.toLowerCase().includes(q) || o.label.toLowerCase().includes(q)
        )
        .slice(0, 40);
    }, [comboOpen, normalizedOptions, value]);

    useEffect(() => {
      if (!comboOpen) return;
      const onClickOutside = (e: MouseEvent) => {
        if (comboRef.current && !comboRef.current.contains(e.target as Node)) {
          setComboOpen(false);
        }
      };
      document.addEventListener('mousedown', onClickOutside);
      return () => document.removeEventListener('mousedown', onClickOutside);
    }, [comboOpen]);

    useEffect(() => {
      setHighlightIdx(0);
    }, [value, comboOpen]);

    const primaryValue = (value || '').split(/[\/,;]+/)[0]?.trim() || '';

    const handleCopy = async () => {
      if (!value?.trim()) return;
      try {
        await navigator.clipboard.writeText(value.trim());
        setCopied(true);
        addToast({ type: 'success', message: `已複製「${label.split(' (')[0]}」`, duration: 2200 });
        setTimeout(() => setCopied(false), 1800);
      } catch {
        addToast({ type: 'error', message: '複製失敗' });
      }
    };

    const getExternalHref = (): string | null => {
      if (!primaryValue) return null;
      if (actionType === 'phone') {
        return `tel:${primaryValue.replace(/[^\d+#*]/g, '')}`;
      }
      if (actionType === 'website') {
        return /^https?:\/\//i.test(primaryValue) ? primaryValue : `https://${primaryValue}`;
      }
      if (actionType === 'address') {
        return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(value.trim())}`;
      }
      return null;
    };

    const externalHref = getExternalHref();
    const hasQuickActions = Boolean(actionType && value?.trim());
    const hasCombobox = normalizedOptions.length > 0 && !isTextArea;

    const inputBorderCls = isMissing
      ? 'border-amber-400 dark:border-amber-500/80 bg-amber-50/40 dark:bg-amber-950/20 focus:border-indigo-600 dark:focus:border-indigo-400'
      : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-slate-400 dark:hover:border-slate-600 focus:border-indigo-600 dark:focus:border-indigo-400';

    return (
      <div className={`group flex flex-col h-full ${className || ''}`} ref={comboRef}>
        <div className="flex items-center justify-between gap-2 mb-1.5 min-h-[22px]">
          <label
            htmlFor={id}
            className="text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 shrink-0"
          >
            {icon && <span className="text-slate-500 dark:text-slate-400 flex items-center">{icon}</span>}
            <span>{label}</span>
            {isMissing && (
              <span
                className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-400"
                title={missingHint || '建議補齊此欄位以利報表匯出'}
              >
                <AlertCircle className="w-3.5 h-3.5" />
              </span>
            )}
          </label>

          {translation && value !== translation && (
            <button
              type="button"
              onClick={onSwapTranslation}
              disabled={!onSwapTranslation}
              className={`text-xs text-indigo-700 dark:text-indigo-300 bg-indigo-50/90 dark:bg-indigo-950/60 border border-indigo-200/80 dark:border-indigo-800/80 px-2 py-0.5 rounded-md font-medium truncate max-w-[55%] flex items-center gap-1 transition-colors ${
                onSwapTranslation
                  ? 'hover:bg-indigo-100 dark:hover:bg-indigo-900/70 cursor-pointer'
                  : 'cursor-default'
              }`}
              title={
                onSwapTranslation
                  ? `點擊將「${translation}」與主欄位內容互換`
                  : `雙語對照：${translation}`
              }
            >
              <span className="truncate">對照：{translation}</span>
              {onSwapTranslation && <ArrowLeftRight className="w-3 h-3 shrink-0 opacity-75" />}
            </button>
          )}
        </div>

        <div className="relative flex-1">
          {isTextArea ? (
            <textarea
              id={id}
              value={value || ''}
              onChange={(e) => onChange(e.target.value)}
              onBlur={onBlur}
              placeholder={placeholder}
              className={`w-full h-24 px-3.5 py-2.5 border rounded-lg text-[15px] text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-colors resize-none leading-relaxed ${inputBorderCls}`}
            />
          ) : (
            <>
              <input
                id={id}
                type="text"
                autoComplete="off"
                value={value || ''}
                onFocus={() => hasCombobox && setComboOpen(true)}
                onChange={(e) => {
                  onChange(e.target.value);
                  if (hasCombobox) setComboOpen(true);
                }}
                onKeyDown={(e) => {
                  if (!comboOpen || filteredOptions.length === 0) return;
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setHighlightIdx((i) => Math.min(filteredOptions.length - 1, i + 1));
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setHighlightIdx((i) => Math.max(0, i - 1));
                  } else if (e.key === 'Enter') {
                    const chosen = filteredOptions[highlightIdx];
                    if (chosen) {
                      e.preventDefault();
                      onChange(chosen.value);
                      setComboOpen(false);
                    }
                  } else if (e.key === 'Escape') {
                    setComboOpen(false);
                  }
                }}
                onBlur={() => {
                  // Delay slightly so clicking a dropdown option succeeds before blur fires
                  setTimeout(() => onBlur?.(), 120);
                }}
                placeholder={placeholder}
                className={`w-full px-3.5 py-2.5 border rounded-lg text-[15px] text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-colors ${inputBorderCls} ${
                  hasQuickActions ? 'pr-20' : hasCombobox ? 'pr-9' : ''
                }`}
              />

              {/* Combobox chevron toggle */}
              {hasCombobox && !hasQuickActions && (
                <button
                  type="button"
                  tabIndex={-1}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setComboOpen((prev) => !prev);
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 flex items-center justify-center cursor-pointer"
                  aria-label="展開建議選項"
                >
                  <ChevronDown
                    className={`w-4 h-4 transition-transform ${comboOpen ? 'rotate-180' : ''}`}
                  />
                </button>
              )}

              {/* One-click Field Actions (Copy + Call/Email/Website/Map) */}
              {hasQuickActions && (
                <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xs pl-1 rounded-md">
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="w-7 h-7 rounded-md text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 flex items-center justify-center transition-colors cursor-pointer"
                    title="複製內容"
                    aria-label="複製內容"
                  >
                    {copied ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>

                  {actionType === 'email' && onEmailAction && (
                    <button
                      type="button"
                      onClick={onEmailAction}
                      className="w-7 h-7 rounded-md text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 flex items-center justify-center transition-colors cursor-pointer"
                      title="撰寫問候跟進信"
                      aria-label="撰寫問候跟進信"
                    >
                      <Mail className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {externalHref && (
                    <a
                      href={externalHref}
                      target={actionType === 'phone' ? undefined : '_blank'}
                      rel={actionType === 'phone' ? undefined : 'noopener noreferrer'}
                      className="w-7 h-7 rounded-md text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 flex items-center justify-center transition-colors"
                      title={
                        actionType === 'phone'
                          ? '撥打電話'
                          : actionType === 'website'
                          ? '開啟官方網站'
                          : '在 Google Maps 檢視地址'
                      }
                      aria-label={
                        actionType === 'phone'
                          ? '撥打電話'
                          : actionType === 'website'
                          ? '開啟官方網站'
                          : '在 Google Maps 檢視地址'
                      }
                    >
                      {actionType === 'phone' ? (
                        <PhoneCall className="w-3.5 h-3.5" />
                      ) : actionType === 'address' ? (
                        <MapPin className="w-3.5 h-3.5" />
                      ) : (
                        <ExternalLink className="w-3.5 h-3.5" />
                      )}
                    </a>
                  )}
                </div>
              )}

              {/* Custom Searchable Combobox Dropdown */}
              {hasCombobox && comboOpen && filteredOptions.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 max-h-56 overflow-y-auto custom-scrollbar bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl py-1 z-50 animate-fadeIn">
                  {filteredOptions.map((opt, idx) => (
                    <button
                      key={`${opt.value}_${idx}`}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        onChange(opt.value);
                        setComboOpen(false);
                      }}
                      onMouseEnter={() => setHighlightIdx(idx)}
                      className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                        idx === highlightIdx
                          ? 'bg-indigo-50 dark:bg-indigo-950/70 text-indigo-800 dark:text-indigo-200 font-semibold'
                          : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      <span className="truncate">{opt.label}</span>
                      {opt.label !== opt.value && (
                        <span className="text-xs text-slate-400 font-mono shrink-0">{opt.value}</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
  }
);

EditableField.displayName = 'EditableField';

export default EditableField;
