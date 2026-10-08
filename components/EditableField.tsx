
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

const EditableField = React.memo(({ label, value, onChange, onBlur, icon, className, isTextArea, translation, options, placeholder }: EditableFieldProps) => {
  const datalistId = options && options.length > 0 ? `list-${label.replace(/[^a-zA-Z0-9]/g, '_')}` : undefined;

  return (
    <div className={`group flex flex-col h-full ${className || ''}`}>
        <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5 shrink-0">
                {icon && <i className={`fa-solid ${icon} text-indigo-400`}></i>} {label}
            </label>
            {translation && value !== translation && (
                <div className="flex items-center gap-1 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100 max-w-[50%] animate-fadeIn">
                    <span className="text-[9px] text-white font-bold bg-indigo-400 px-1 rounded leading-none">AI</span>
                    <span className="text-xs text-indigo-600 font-medium truncate" title={translation}>{translation}</span>
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
                    className="w-full h-20 p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-none leading-relaxed"
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
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  />
                  {datalistId && options && (
                    <datalist id={datalistId}>
                      {options.map((opt, idx) => {
                        const isObj = typeof opt === 'object';
                        const val = isObj ? opt.value : opt;
                        const label = isObj ? opt.label : opt;
                        return (
                          <option key={`${val}_${idx}`} value={val} label={label}>
                            {label}
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