import React from 'react';

interface EditableFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  icon?: string;
  className?: string;
  isTextArea?: boolean;
  translation?: string;
  options?: (string | { value: string; label: string })[];
  placeholder?: string;
}

const EditableField = React.memo(({
  label,
  value,
  onChange,
  onBlur,
  icon,
  className,
  isTextArea,
  translation,
  options,
  placeholder
}: EditableFieldProps) => {
  const datalistId = options && options.length > 0 ? `list-${label.replace(/[^a-zA-Z0-9]/g, '_')}` : undefined;

  return (
    <div className={`group flex flex-col h-full ${className || ''}`}>
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5 shrink-0">
          {icon && <i className={`fa-solid ${icon} text-slate-400 group-focus-within:text-indigo-500 transition-colors text-[11px]`}></i>}
          <span>{label}</span>
        </label>
        {translation && value !== translation && (
          <div className="flex items-center gap-1 bg-indigo-50/80 px-1.5 py-0.5 rounded-md border border-indigo-100 max-w-[55%]">
            <span className="text-[9px] text-indigo-700 font-bold bg-indigo-100 px-1 rounded leading-tight">AI 譯</span>
            <span className="text-[11px] text-indigo-700 font-medium truncate" title={translation}>{translation}</span>
          </div>
        )}
      </div>
      <div className="relative flex-1">
        {isTextArea ? (
          <textarea
            value={value || ''}
            onChange={e => onChange(e.target.value)}
            onBlur={onBlur}
            placeholder={placeholder}
            className="w-full min-h-[84px] px-3 py-2 bg-white border border-slate-200/90 hover:border-slate-300 rounded-lg text-sm text-slate-800 placeholder:text-slate-400 shadow-2xs focus:outline-none focus:ring-2 focus:ring-indigo-500/15 focus:border-indigo-500 transition-all resize-y leading-relaxed"
          />
        ) : (
          <>
            <input
              type="text"
              list={datalistId}
              value={value || ''}
              onChange={e => onChange(e.target.value)}
              onBlur={onBlur}
              placeholder={placeholder}
              className="w-full px-3 py-2 bg-white border border-slate-200/90 hover:border-slate-300 rounded-lg text-sm text-slate-800 placeholder:text-slate-400 shadow-2xs focus:outline-none focus:ring-2 focus:ring-indigo-500/15 focus:border-indigo-500 transition-all"
            />
            {datalistId && options && (
              <datalist id={datalistId}>
                {options.map((opt, idx) => {
                  const isObj = typeof opt === 'object';
                  const val = isObj ? opt.value : opt;
                  const optLabel = isObj ? opt.label : opt;
                  return (
                    <option key={`${val}_${idx}`} value={val} label={optLabel}>
                      {optLabel}
                    </option>
                  );
                })}
              </datalist>
            )}
          </>
        )}
      </div>
    </div>
  );
});

export default EditableField;
