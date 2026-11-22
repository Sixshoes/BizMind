import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { FileText, Sparkles, Loader2, X, Check, ClipboardPaste, Zap } from 'lucide-react';
import { BusinessCardData, ContactCategory } from '../types';
import { parseTextSignatureCard } from '../services/geminiService';
import { isVCardOrMeCard, parseContactQrPayload } from '../utils/vcardParser';
import { DEFAULT_CARD_SOURCE, inferCountryFromCard } from '../utils/qsValidation';
import { useToast } from './ToastProvider';

interface TextImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveNewCard: (card: BusinessCardData) => Promise<void>;
}

const SAMPLE_SIGNATURE = `林佳穎 Claire Lin
資深永續策略總監 | Senior ESG Strategy Director
星辰綠能科技股份有限公司 (StarGreen Tech Co., Ltd.)
Email: claire.lin@stargreen.tw
Tel: +886-2-2758-9012 / Mobile: 0912-345-678
Web: https://www.stargreen.tw
台北市信義區松仁路 100 號 18 樓`;

export const TextImportModal: React.FC<TextImportModalProps> = ({
  isOpen,
  onClose,
  onSaveNewCard,
}) => {
  const { addToast } = useToast();
  const [rawText, setRawText] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [draft, setDraft] = useState<Partial<BusinessCardData> | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setRawText('');
      setDraft(null);
      setIsParsing(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  const handleParse = async () => {
    const trimmed = rawText.trim();
    if (!trimmed) return;

    // Instant zero-AI local parse for vCard / MeCard text
    if (isVCardOrMeCard(trimmed)) {
      const localParsed = parseContactQrPayload(trimmed);
      if (localParsed) {
        setDraft({
          category: 'employer',
          summary: '',
          reasoning: '透過 vCard / MeCard 標準格式離線解析建立',
          ...localParsed,
        });
        addToast({ type: 'success', message: '已透過 vCard 標準格式免 AI 即時解析！' });
        return;
      }
    }

    setIsParsing(true);
    try {
      const parsed = await parseTextSignatureCard(trimmed);
      setDraft(parsed);
      addToast({ type: 'success', message: '已完成 AI 簽名檔結構化解析，請確認後建檔' });
    } catch (err: any) {
      addToast({ type: 'error', message: `解析失敗：${err.message || '請稍後再試'}` });
    } finally {
      setIsParsing(false);
    }
  };

  const handleConfirmSave = async () => {
    if (!draft) return;
    setIsSaving(true);
    try {
      const now = Date.now();
      const newCard: BusinessCardData = {
        id: crypto.randomUUID(),
        prefix: draft.prefix || '',
        firstName: draft.firstName || '',
        lastName: draft.lastName || '',
        title: draft.title || '',
        company: draft.company || '',
        department: draft.department || '',
        industry: draft.industry || '',
        country: draft.country || '',
        email: draft.email || '',
        phone: draft.phone || '',
        fax: draft.fax || '',
        subject: draft.subject || '',
        source: draft.source || DEFAULT_CARD_SOURCE,
        website: draft.website || '',
        address: draft.address || '',
        notes: draft.notes || '',
        category: (draft.category as ContactCategory) || 'employer',
        reasoning: draft.reasoning || '由文字/Email 簽名檔智慧解析建立',
        summary: draft.summary || '',
        translations: draft.translations,
        scannedAt: now,
        updatedAt: now,
        syncStatus: 'local',
        followUpStatus: 'new',
        activityLog: [
          {
            id: crypto.randomUUID(),
            at: now,
            type: 'created',
            text: '透過文字 / Email 簽名檔解析建立聯絡人',
          },
        ],
      };

      const inferred = inferCountryFromCard(newCard);
      if (inferred && !newCard.country) newCard.country = inferred;

      await onSaveNewCard(newCard);
      onClose();
    } catch (err: any) {
      addToast({ type: 'error', message: `儲存失敗：${err.message || '未知錯誤'}` });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          className="fixed inset-0 z-[9600] bg-slate-950/55 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label="文字與 Email 簽名檔智慧建檔"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
            className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden flex flex-col max-h-[88vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-100 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <FileText className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h3 className="text-base font-bold font-display text-slate-900 dark:text-white">
                    文字 / Email 簽名檔智慧建檔
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    貼上信件簽名檔、LINE 自我介紹或 vCard 文字，自動轉換成結構化聯絡人
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center cursor-pointer"
                aria-label="關閉"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-200">
                    貼上聯絡人文字內容
                  </label>
                  <button
                    type="button"
                    onClick={() => setRawText(SAMPLE_SIGNATURE)}
                    className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <ClipboardPaste className="w-3 h-3" />
                    <span>帶入範例簽名檔</span>
                  </button>
                </div>
                <textarea
                  rows={6}
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  placeholder="直接貼上對方的 Email 簽名檔、LINE 訊息自我介紹、或 BEGIN:VCARD 文字..."
                  className="w-full p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 focus:bg-white dark:focus:bg-slate-900 focus:border-indigo-500 focus:outline-none text-sm text-slate-900 dark:text-slate-100 leading-relaxed resize-y"
                />
              </div>

              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                  {isVCardOrMeCard(rawText) ? (
                    <>
                      <Zap className="w-3.5 h-3.5 text-emerald-500" />
                      <span>偵測到標準 vCard / MeCard，可免 AI 即時解析</span>
                    </>
                  ) : (
                    <span>Gemini AI 將自動辨識雙語職稱、機構、國家與簡介</span>
                  )}
                </span>
                <button
                  type="button"
                  disabled={!rawText.trim() || isParsing}
                  onClick={handleParse}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 shadow-xs"
                >
                  {isParsing ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>智慧解析中...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>立即解析欄位</span>
                    </>
                  )}
                </button>
              </div>

              {/* Editable Preview */}
              {draft && (
                <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3 animate-fadeIn">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
                      解析預覽（可直接微調）
                    </h4>
                    <select
                      value={draft.category || 'employer'}
                      onChange={(e) =>
                        setDraft((prev) =>
                          prev ? { ...prev, category: e.target.value as ContactCategory } : prev
                        )
                      }
                      className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                    >
                      <option value="employer">企業夥伴</option>
                      <option value="academic">學研專家</option>
                      <option value="staff">機關社團</option>
                      <option value="other">一般聯絡人</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                      { key: 'lastName', label: '姓氏' },
                      { key: 'firstName', label: '名字' },
                      { key: 'company', label: '公司 / 機構' },
                      { key: 'title', label: '職稱' },
                      { key: 'email', label: 'Email' },
                      { key: 'phone', label: '聯絡電話' },
                      { key: 'country', label: '國家 / 地區' },
                      { key: 'website', label: '官方網站' },
                    ].map(({ key, label }) => (
                      <div key={key}>
                        <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                          {label}
                        </label>
                        <input
                          type="text"
                          value={(draft as any)[key] || ''}
                          onChange={(e) =>
                            setDraft((prev) => (prev ? { ...prev, [key]: e.target.value } : prev))
                          }
                          className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 focus:border-indigo-500 focus:outline-none"
                        />
                      </div>
                    ))}
                  </div>

                  {draft.summary && (
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                        AI 生成簡介
                      </label>
                      <textarea
                        rows={2}
                        value={draft.summary}
                        onChange={(e) =>
                          setDraft((prev) => (prev ? { ...prev, summary: e.target.value } : prev))
                        }
                        className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-200 focus:outline-none resize-none"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-3.5 bg-slate-50 dark:bg-slate-900/95 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800 cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                disabled={!draft || isSaving}
                onClick={handleConfirmSave}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 disabled:opacity-45 text-white flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                {isSaving ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5" />
                )}
                <span>建立名片並開啟審閱</span>
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
