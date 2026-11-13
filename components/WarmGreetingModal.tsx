import React, { useState, useEffect } from 'react';
import { BusinessCardData } from '../types';
import { useToast } from './ToastProvider';

interface WarmGreetingModalProps {
  card: BusinessCardData | null;
  onClose: () => void;
}

type GreetingTone = 'thank_you' | 'collaboration' | 'encouragement';
type GreetingLang = 'zh-TW' | 'en' | 'bilingual';

function buildFallbackGreeting(
  card: BusinessCardData,
  tone: GreetingTone,
  language: GreetingLang,
  senderNote: string
): { subject: string; body: string } {
  const fullNameZh = `${card.lastName || ''}${card.firstName || ''}`.trim() || card.company || '合作夥伴';
  const fullNameEn = `${card.prefix ? card.prefix + ' ' : ''}${card.firstName || ''} ${card.lastName || ''}`.trim() || card.company || 'Partner';
  const org = card.company || '貴機構';
  const title = card.title ? `（${card.title}）` : '';
  const extraZh = senderNote.trim() ? `\n此外，關於「${senderNote.trim()}」，也期盼後續能進一步與您請益交流。` : '';
  const extraEn = senderNote.trim() ? `\nRegarding "${senderNote.trim()}", I would be delighted to explore this further with you.` : '';

  if (language === 'en') {
    const subject =
      tone === 'collaboration'
        ? `Exploring Sustainable Collaboration with ${org}`
        : tone === 'encouragement'
        ? `Warm Regards & Appreciation — Great Connecting with You`
        : `Wonderful Connecting with You — Warm Greetings`;
    const coreLine =
      tone === 'collaboration'
        ? `Your work at ${org} truly inspires us, and we sincerely hope to explore future academic or sustainability initiatives together for mutual good.`
        : tone === 'encouragement'
        ? `We deeply admire your dedication and professional insights at ${org}, and wanted to send our warmest encouragement and appreciation.`
        : `Thank you very much for taking the time to connect and exchange insights. Meeting dedicated professionals like you at ${org} brings great joy to our team.`;
    return {
      subject,
      body: `Dear ${fullNameEn},\n\nI hope this message finds you well.\n\n${coreLine}${extraEn}\n\nWishing you continued success, peace, and joyful days ahead.\n\nWarm regards,\nOffice of Sustainability & International Exchange`
    };
  }

  const subjectZh =
    tone === 'collaboration'
      ? `【誠摯問候】期盼與 ${org} 共創永續與交流善緣`
      : tone === 'encouragement'
      ? `【誠摯致意】感謝 ${fullNameZh} 分享寶貴見解與溫暖交流`
      : `【交流致謝】很高興與您結緣交流 — 誠摯問候`;

  const bodyZh =
    tone === 'collaboration'
      ? `${fullNameZh}${title} 您好：\n\n感謝日前有機會與您交換名片並認識 ${org} 的卓越成果。對於您在專業領域的投入深感敬佩，期盼未來能在永續發展與教育創新上攜手合作，共同為社會傳遞正向影響力。${extraZh}\n\n敬祝 平安順心、萬事歡喜\n\n永續發展與國際交流團隊 敬上`
      : tone === 'encouragement'
      ? `${fullNameZh}${title} 您好：\n\n每每回想起與您的交流，都對您在 ${org} 所展現的熱忱與專業印象深刻。特此致信表達誠摯的肯定與祝福，願您的各項計畫推進順利、成果豐碩。${extraZh}\n\n敬祝 身心安康、吉祥如意\n\n永續發展與國際交流團隊 敬上`
      : `${fullNameZh}${title} 您好：\n\n非常歡喜日前有機會與您結緣交流，感謝您親切分享 ${org} 的寶貴經驗。已將您的聯絡資訊妥善數位典藏，期盼未來保持聯繫、互助共好。${extraZh}\n\n敬祝 平安喜樂、工作順遂\n\n永續發展與國際交流團隊 敬上`;

  if (language === 'bilingual') {
    const en = buildFallbackGreeting(card, tone, 'en', senderNote);
    return {
      subject: `${subjectZh} | ${en.subject}`,
      body: `${bodyZh}\n\n---\n\n${en.body}`
    };
  }

  return { subject: subjectZh, body: bodyZh };
}

export const WarmGreetingModal: React.FC<WarmGreetingModalProps> = ({ card, onClose }) => {
  const { addToast } = useToast();
  const [tone, setTone] = useState<GreetingTone>('thank_you');
  const [language, setLanguage] = useState<GreetingLang>('zh-TW');
  const [senderNote, setSenderNote] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const generateLetter = async (selectedTone = tone, selectedLang = language, note = senderNote) => {
    if (!card) return;
    setIsGenerating(true);
    try {
      const res = await fetch('/api/analyze-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'warmGreeting',
          card,
          tone: selectedTone,
          language: selectedLang,
          senderNote: note
        })
      });
      const data = await res.json();
      if (res.ok && data.success && data.body) {
        setSubject(data.subject || '');
        setBody(data.body || '');
      } else {
        const fallback = buildFallbackGreeting(card, selectedTone, selectedLang, note);
        setSubject(fallback.subject);
        setBody(fallback.body);
      }
    } catch {
      const fallback = buildFallbackGreeting(card, selectedTone, selectedLang, note);
      setSubject(fallback.subject);
      setBody(fallback.body);
    } finally {
      setIsGenerating(false);
    }
  };

  useEffect(() => {
    if (card) {
      const defaultLang: GreetingLang =
        card.country && card.country !== 'Taiwan SAR' && card.country !== 'China Mainland' && card.country !== 'Hong Kong SAR'
          ? 'en'
          : 'zh-TW';
      setLanguage(defaultLang);
      generateLetter('thank_you', defaultLang, '');
    }
  }, [card?.id]);

  if (!card) return null;

  const displayName = (card.firstName || card.lastName)
    ? `${card.prefix ? card.prefix + ' ' : ''}${card.lastName || ''} ${card.firstName || ''}`.trim()
    : (card.company || '聯絡人');

  const primaryEmail = card.email ? String(card.email).split('/')[0].trim() : '';

  const handleCopy = () => {
    const fullText = subject ? `主旨：${subject}\n\n${body}` : body;
    navigator.clipboard.writeText(fullText);
    addToast({ type: 'success', message: '已複製溫暖問候信草稿至剪貼簿' });
  };

  const handleOpenMail = () => {
    const mailtoUrl = `mailto:${encodeURIComponent(primaryEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(mailtoUrl, '_blank');
  };

  return (
    <div className="fixed inset-0 z-[9990] bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200/80 flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-emerald-50/70 via-white to-indigo-50/50">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-sm shrink-0">
              <i className="fa-solid fa-heart-circle-check text-base"></i>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">AI 說好話・溫暖問候信助手</h3>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                  三好四給實踐
                </span>
              </div>
              <p className="text-xs text-slate-500 truncate mt-0.5">
                收件對象：<span className="font-semibold text-slate-700">{displayName}</span>
                {card.company ? ` · ${card.company}` : ''}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto custom-scrollbar space-y-4 flex-1">
          {/* Tone & Language Controls */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            <div className="md:col-span-8">
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">問候心意與情境</label>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { id: 'thank_you' as const, label: '交流致謝', sub: '給人歡喜' },
                  { id: 'collaboration' as const, label: '共好合作', sub: '給人希望' },
                  { id: 'encouragement' as const, label: '肯定祝福', sub: '給人信心' }
                ].map(item => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setTone(item.id);
                      generateLetter(item.id, language, senderNote);
                    }}
                    className={`px-3 py-2 rounded-xl border text-left transition-all cursor-pointer ${
                      tone === item.id
                        ? 'bg-emerald-50 border-emerald-400 text-emerald-900 ring-1 ring-emerald-400/30'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <div className="text-xs font-bold">{item.label}</div>
                    <div className="text-[10px] text-emerald-700/80 font-medium">{item.sub}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="md:col-span-4">
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">撰寫語系</label>
              <div className="flex bg-slate-100 p-1 rounded-xl">
                {[
                  { id: 'zh-TW' as const, label: '中文' },
                  { id: 'en' as const, label: 'English' },
                  { id: 'bilingual' as const, label: '雙語' }
                ].map(l => (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => {
                      setLanguage(l.id);
                      generateLetter(tone, l.id, senderNote);
                    }}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      language === l.id
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Optional Custom Context */}
          <div className="flex gap-2">
            <input
              type="text"
              value={senderNote}
              onChange={(e) => setSenderNote(e.target.value)}
              placeholder="選填補充背景（例如：感謝今日於永續論壇分享淨零經驗、邀請下月參訪佛光大學...）"
              className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
            <button
              type="button"
              disabled={isGenerating}
              onClick={() => generateLetter(tone, language, senderNote)}
              className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer"
            >
              <i className={`fa-solid ${isGenerating ? 'fa-circle-notch fa-spin' : 'fa-wand-magic-sparkles'} text-[11px]`}></i>
              <span>重新生成</span>
            </button>
          </div>

          {/* Generated Subject & Content */}
          <div className="space-y-3 bg-slate-50/70 p-4 rounded-xl border border-slate-200/80 relative">
            {isGenerating && (
              <div className="absolute inset-0 bg-white/75 backdrop-blur-[1px] z-10 flex items-center justify-center rounded-xl">
                <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 bg-emerald-50 px-3.5 py-2 rounded-full border border-emerald-200 shadow-xs">
                  <i className="fa-solid fa-circle-notch fa-spin"></i>
                  <span>Gemini AI 正在根據名片背景撰寫溫暖問候...</span>
                </div>
              </div>
            )}

            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">信件主旨 (可微調)</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-semibold text-slate-800 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">問候內文 (人工審閱後寄出)</label>
              <textarea
                rows={8}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 leading-relaxed focus:outline-none focus:border-emerald-500 resize-y"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50/60 flex items-center justify-between gap-3 flex-wrap">
          <span className="text-[11px] text-slate-400 flex items-center gap-1.5">
            <i className="fa-solid fa-shield-heart text-emerald-500"></i>
            AI 輔助草擬，建議確認內容符合禮節後再行發送
          </span>
          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={handleCopy}
              className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
            >
              <i className="fa-regular fa-copy"></i>
              <span>複製信件</span>
            </button>
            {primaryEmail && (
              <button
                type="button"
                onClick={handleOpenMail}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
              >
                <i className="fa-regular fa-paper-plane"></i>
                <span>開啟信箱寄送 ({primaryEmail})</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default WarmGreetingModal;
