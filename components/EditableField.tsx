import React from 'react';

interface EditableFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  icon?: React.ReactNode;
  className?: string;
  isTextArea?: boolean;
  translation?: string;
  options?: (string | { value: string; label: string })[];
  placeholder?: string;
}

const EditableField = React.memo(
  ({
    label,
    value,
    onChange,
    onBlur,
    icon,
    className,
    isTextArea,
    translation,
    options,
    placeholder,
  }: EditableFieldProps) => {
    const datalistId =
      options && options.length > 0
        ? `list-${label.replace(/[^a-zA-Z0-9]/g, '_')}`
        : undefined;

    return (
      <div className={`group flex flex-col h-full ${className || ''}`}>
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <label className="text-sm font-semibold text-slate-800 flex items-center gap-1.5 shrink-0">
            {icon && <span className="text-slate-500 flex items-center">{icon}</span>}
            <span>{label}</span>
          </label>
          {translation && value !== translation && (
            <span
              className="text-xs text-indigo-700 bg-indigo-50/80 border border-indigo-200/70 px-2 py-0.5 rounded font-medium truncate max-w-[55%]"
              title={`英譯參考：${translation}`}
            >
              英譯：{translation}
            </span>
          )}
        </div>
        <div className="relative flex-1">
          {isTextArea ? (
            <textarea
              value={value || ''}
              onChange={(e) => onChange(e.target.value)}
              onBlur={onBlur}
              placeholder={placeholder}
              className="w-full h-24 px-3.5 py-2.5 bg-white border border-slate-300 hover:border-slate-400 rounded-lg text-[15px] text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-colors resize-none leading-relaxed"
            />
          ) : (
            <>
              <input
                type="text"
                list={datalistId}
                value={value || ''}
                onChange={(e) => onChange(e.target.value)}
                onBlur={onBlur}
                placeholder={placeholder}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 hover:border-slate-400 rounded-lg text-[15px] text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-colors"
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
  }
);

EditableField.displayName = 'EditableField';

export default EditableField;