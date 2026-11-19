import React, { useState, useEffect } from 'react';
import { Mail, Sparkles, Copy, Check, ExternalLink, X, Loader2 } from 'lucide-react';
import { BusinessCardData } from '../types';
import { generateFollowUpEmailDraft } from '../services/geminiService';
import { useToast } from './ToastProvider';

interface FollowUpEmailDrawerProps {
  card: BusinessCardData | null;
  onClose: () => void;
}

const SENDER_STORAGE_KEY = 'bizmind_sender_profile_v1';

export const FollowUpEmailDrawer: React.FC<FollowUpEmailDrawerProps> = ({ card, onClose }) => {
  const { addToast } = useToast();
  const [tone, setTone] = useState<'business' | 'academic' | 'event_followup'>('business');
  const [language, setLanguage] = useState<'zh-TW' | 'en'>('zh-TW');
  const [senderName, setSenderName] = useState('');
  const [senderOrg, setSenderOrg] = useState('');
  const [customContext, setCustomContext] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedField, setCopiedField] = useState<'subject' | 'body' | 'all' | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SENDER_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.senderName) setSenderName(parsed.senderName);
        if (parsed.senderOrg) setSenderOrg(parsed.senderOrg);
      }
    } catch {
      // ignore storage errors
    }
  }, []);

  useEffect(() => {
    if (!card) return;
    if (card.category === 'academic') {
      setTone('academic');
    } else if (card.source && card.source !== 'BizMind') {
      setTone('event_followup');
    } else {
      setTone('business');
    }
    if (card.country && card.country !== 'Taiwan SAR' && card.country !== 'China Mainland') {
      setLanguage('en');
    } else {
      setLanguage('zh-TW');
    }
    setSubject('');
    setBody('');
  }, [card?.id]);

  useEffect(() => {
    if (!card) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [card, onClose]);

  if (!card) return null;

  const recipientEmail = card.email ? card.email.split(/[\/,;]+/)[0].trim() : '';
  const recipientName =
    [card.prefix, card.firstName, card.lastName].filter(Boolean).join(' ') ||
    card.company ||
    '聯絡人';

  const handleGenerate = async () => {
    try {
      localStorage.setItem(SENDER_STORAGE_KEY, JSON.stringify({ senderName, senderOrg }));
    } catch {
      // ignore
    }

    setIsGenerating(true);
    try {
      const draft = await generateFollowUpEmailDraft(card, {
        tone,
        language,
        senderName: senderName.trim() || undefined,
        senderOrg: senderOrg.trim() || undefined,
        customContext: customContext.trim() || undefined,
      });
      setSubject(draft.subject || '');
      setBody(draft.body || '');
      addToast({ type: 'success', message: '已生成個人化跟進信件草稿' });
    } catch (e: any) {
      addToast({ type: 'error', message: `草稿生成失敗：${e.message || '請稍後再試'}` });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = async (target: 'subject' | 'body' | 'all') => {
    const text =
      target === 'subject'
        ? subject
        : target === 'body'
        ? body
        : `主旨：${subject}\n\n${body}`;
    if (!text.trim()) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(target);
      addToast({ type: 'success', message: '已複製至剪貼簿' });
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      addToast({ type: 'error', message: '複製失敗' });
    }
  };

  const mailtoHref = `mailto:${encodeURIComponent(recipientEmail)}?subject=${encodeURIComponent(
    subject
  )}&body=${encodeURIComponent(body)}`;

  return (
    <div
      className="fixed inset-0 z-[9500] bg-slate-900/45 backdrop-blur-xs flex justify-end animate-fadeIn"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-white w-full max-w-xl h-full border-l border-slate-200 shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center shrink-0">
              <Mail className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-bold font-display text-slate-900 truncate">
                跟進開發信草稿生成
              </h3>
              <p className="text-xs text-slate-600 truncate">
                收件人：{recipientName}
                {recipientEmail ? ` · ${recipientEmail}` : ' · 尚未填寫 Email'}
              </p>
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

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar">
          {/* Tone & Language */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-sm font-semibold text-slate-800 mb-1.5">
                信件情境與語氣
              </label>
              <select
                value={tone}
                onChange={(e) => setTone(e.target.value as any)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-900 focus:border-indigo-600 focus:outline-none"
              >
                <option value="business">正式商務合作問候</option>
                <option value="academic">高教學術交流致意</option>
                <option value="event_followup">展會 / 活動會後跟進</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-800 mb-1.5">撰寫語言</label>
              <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-lg border border-slate-200">
                <button
                  type="button"
                  onClick={() => setLanguage('zh-TW')}
                  className={`py-1.5 rounded-md text-sm font-semibold transition-colors cursor-pointer ${
                    language === 'zh-TW'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-700 hover:text-slate-950'
                  }`}
                >
                  繁體中文
                </button>
                <button
                  type="button"
                  onClick={() => setLanguage('en')}
                  className={`py-1.5 rounded-md text-sm font-semibold transition-colors cursor-pointer ${
                    language === 'en'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-700 hover:text-slate-950'
                  }`}
                >
                  English
                </button>
              </div>
            </div>
          </div>

          {/* Sender Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-sm font-semibold text-slate-800 mb-1.5">
                您的署名 (選填)
              </label>
              <input
                type="text"
                value={senderName}
                onChange={(e) => setSenderName(e.target.value)}
                placeholder="例如：王小明 Ming Wang"
                className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:border-indigo-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-800 mb-1.5">
                您的單位 / 職稱 (選填)
              </label>
              <input
                type="text"
                value={senderOrg}
                onChange={(e) => setSenderOrg(e.target.value)}
                placeholder="例如：國際事務處"
                className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:border-indigo-600 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-800 mb-1.5">
              補充認識場合或洽談重點 (選填)
            </label>
            <input
              type="text"
              value={customContext}
              onChange={(e) => setCustomContext(e.target.value)}
              placeholder="例如：感謝今日於永續與產業創新論壇分享寶貴合作經驗"
              className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:border-indigo-600 focus:outline-none"
            />
          </div>

          <button
            type="button"
            onClick={handleGenerate}
            disabled={isGenerating}
            className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>正在依據名片背景撰寫信件...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>{subject || body ? '重新生成信件草稿' : '產生個人化跟進信草稿'}</span>
              </>
            )}
          </button>

          {/* Draft Editor */}
          <div className="pt-3 border-t border-slate-200 space-y-3.5">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-semibold text-slate-800">信件主旨 (Subject)</label>
                {subject && (
                  <button
                    type="button"
                    onClick={() => handleCopy('subject')}
                    className="text-xs text-indigo-700 hover:text-indigo-800 font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    {copiedField === 'subject' ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>複製主旨</span>
                  </button>
                )}
              </div>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="產生後可在此直接微調主旨..."
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-[15px] font-medium text-slate-900 focus:border-indigo-600 focus:outline-none"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-semibold text-slate-800">信件內文 (Body)</label>
                {body && (
                  <button
                    type="button"
                    onClick={() => handleCopy('body')}
                    className="text-xs text-indigo-700 hover:text-indigo-800 font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    {copiedField === 'body' ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>複製內文</span>
                  </button>
                )}
              </div>
              <textarea
                rows={10}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="點擊上方按鈕生成信件草稿，或直接在此撰寫..."
                className="w-full p-3.5 bg-white border border-slate-300 rounded-lg text-[15px] text-slate-900 leading-relaxed focus:border-indigo-600 focus:outline-none resize-y"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2 shrink-0">
          <button
            type="button"
            onClick={() => handleCopy('all')}
            disabled={!subject && !body}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 disabled:opacity-50 flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
          >
            {copiedField === 'all' ? (
              <Check className="w-4 h-4 text-emerald-600" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
            <span>複製完整信件</span>
          </button>

          <a
            href={mailtoHref}
            className={`px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap ${
              subject || body
                ? 'bg-slate-900 hover:bg-slate-800 text-white'
                : 'bg-slate-200 text-slate-500 pointer-events-none'
            }`}
          >
            <ExternalLink className="w-4 h-4" />
            <span>以郵件軟體開啟</span>
          </a>
        </div>
      </div>
    </div>
  );
};
