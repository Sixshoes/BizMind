import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  MessageSquare,
  X,
  Send,
  Loader2,
  Globe,
  Database,
  ArrowUpRight,
  Trash2,
  Copy,
  Check,
  Maximize2,
  Minimize2,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-react';
import Markdown from 'react-markdown';
import { BusinessCardData } from '../types';
import { filterCards, FilterIntent } from '../utils/cardFilters';
import { apiFetch } from '../utils/apiClient';
import { useToast } from './ToastProvider';

interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  content: string;
  sources?: { title: string; url: string }[];
  linkedCards?: { id: string; name: string }[];
  detectedIntent?: FilterIntent;
}

interface ChatBoxProps {
  cards: BusinessCardData[];
  onJumpToCard?: (cardId: string) => void;
  externalSearchQuery?: string | null;
  onExternalSearchConsumed?: () => void;
  onIntentDetected?: (intent: FilterIntent) => void;
  hasBatchBar?: boolean;
  isMobile?: boolean;
  externalOpen?: boolean;
  onExternalOpenChange?: (open: boolean) => void;
}

const SUGGESTION_CHIPS = [
  '找出來自台灣或日本的企業夥伴',
  '列出目前缺少 Email 的聯絡人',
  '找出所有學研專家並摘要背景',
  '最近掃描的名片有哪些重點人脈？',
];

export default function ChatBox({
  cards,
  onJumpToCard,
  externalSearchQuery,
  onExternalSearchConsumed,
  onIntentDetected,
  hasBatchBar = false,
  isMobile = false,
  externalOpen,
  onExternalOpenChange,
}: ChatBoxProps) {
  const { addToast } = useToast();
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = externalOpen !== undefined ? externalOpen : internalOpen;
  const setIsOpen = (val: boolean) => {
    setInternalOpen(val);
    onExternalOpenChange?.(val);
  };

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [thinkingStage, setThinkingStage] = useState<string | null>(null);
  const [isSearchEnabled, setIsSearchEnabled] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const runPrompt = async (promptText: string, forceWebSearch?: boolean) => {
    const cleanPrompt = promptText.trim();
    if (!cleanPrompt || thinkingStage) return;

    const useWeb = forceWebSearch !== undefined ? forceWebSearch : isSearchEnabled;
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: cleanPrompt,
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setThinkingStage('正在解析語意搜尋條件...');

    const recentHistory = messages.slice(-6).map((m) => ({
      role: m.role,
      content: m.content,
    }));

    try {
      const intentRes = await apiFetch('/api/chat/intent', {
        method: 'POST',
        body: JSON.stringify({ prompt: cleanPrompt }),
      });
      const intentData = await intentRes.json();

      let candidateCards = cards;
      let detectedIntent: FilterIntent | undefined;
      if (intentData.success && intentData.intent?.intentType === 'card_search') {
        detectedIntent = intentData.intent;
        candidateCards = filterCards(cards, intentData.intent);
        setThinkingStage(`已鎖定 ${candidateCards.length} 筆相關名片，正在整理回答...`);
      } else {
        setThinkingStage(
          useWeb ? '正在聯網查證背景與整理回覆...' : `正在檢索 ${cards.length} 筆名片資料...`
        );
      }

      const res = await apiFetch('/api/chat', {
        method: 'POST',
        body: JSON.stringify({
          prompt: cleanPrompt,
          isSearchEnabled: useWeb,
          cards: candidateCards,
          history: recentHistory,
        }),
      });
      const data = await res.json();

      const modelMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        content: data.success ? data.reply : `發生錯誤：\n${data.error}`,
        sources: data.sources,
        linkedCards: data.linkedCards,
        detectedIntent,
      };
      setMessages((prev) => [...prev, modelMessage]);
    } catch (e: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: 'model',
          content: `網路連線異常：\n${e.message}`,
        },
      ]);
    } finally {
      setThinkingStage(null);
    }
  };

  useEffect(() => {
    if (externalSearchQuery) {
      setIsOpen(true);
      setIsSearchEnabled(true);
      runPrompt(externalSearchQuery, true).finally(() => {
        onExternalSearchConsumed?.();
      });
    }
  }, [externalSearchQuery]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, thinkingStage]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen]);

  const handleCopyReply = async (msg: ChatMessage) => {
    try {
      await navigator.clipboard.writeText(msg.content);
      setCopiedId(msg.id);
      addToast({ type: 'success', message: '已複製助理回覆', duration: 2000 });
      setTimeout(() => setCopiedId((cur) => (cur === msg.id ? null : cur)), 1800);
    } catch {
      addToast({ type: 'error', message: '複製失敗' });
    }
  };

  return (
    <>
      {/* Desktop Floating Action Button (auto-lifts when BatchEditBar is active; mobile uses Bottom Nav) */}
      {!isMobile && (
        <motion.button
          type="button"
          onClick={() => setIsOpen(true)}
          initial={false}
          animate={{
            scale: isOpen ? 0.85 : 1,
            opacity: isOpen ? 0 : 1,
            y: hasBatchBar ? -66 : 0,
          }}
          transition={{ type: 'spring', stiffness: 420, damping: 30 }}
          className={`fixed bottom-5 right-5 h-11 px-4 rounded-2xl bg-slate-900 dark:bg-indigo-600 text-white shadow-xl border border-slate-700/80 dark:border-indigo-500 hover:bg-slate-800 dark:hover:bg-indigo-500 transition-colors z-30 flex items-center gap-2 cursor-pointer ${
            isOpen ? 'pointer-events-none' : ''
          }`}
          title="開啟 AI 名片語意檢索助理"
        >
          <Sparkles className="w-4 h-4 text-indigo-300 dark:text-indigo-100" />
          <span className="text-xs font-bold">AI 智慧檢索</span>
        </motion.button>
      )}

      {/* Slide/Scale Chat Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 14, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
            className={`fixed z-50 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl flex flex-col border border-slate-200 dark:border-slate-700 overflow-hidden origin-bottom-right ${
              isMobile
                ? 'inset-x-3 bottom-20 top-16'
                : isExpanded
                ? 'bottom-5 right-5 w-[520px] max-w-[calc(100vw-2.5rem)] h-[640px] max-h-[84vh]'
                : 'bottom-5 right-5 w-[390px] max-w-[calc(100vw-2.5rem)] h-[540px] max-h-[80vh]'
            }`}
            role="dialog"
            aria-label="名片語意搜尋助理"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800 flex items-center justify-center">
                  <MessageSquare className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold font-display text-slate-900 dark:text-slate-100 leading-tight">
                    AI 名片語意搜尋助理
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {isSearchEnabled
                      ? '全網機構查證已啟用'
                      : `本地資料庫即時檢索 (${cards.length} 筆)`}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                {messages.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setMessages([])}
                    className="w-7 h-7 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center justify-center transition-colors cursor-pointer"
                    title="清空對話紀錄"
                    aria-label="清空對話紀錄"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
                {!isMobile && (
                  <button
                    type="button"
                    onClick={() => setIsExpanded((e) => !e)}
                    className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition-colors cursor-pointer"
                    title={isExpanded ? '縮小視窗' : '展開閱讀視窗'}
                    aria-label={isExpanded ? '縮小視窗' : '展開閱讀視窗'}
                  >
                    {isExpanded ? (
                      <Minimize2 className="w-3.5 h-3.5" />
                    ) : (
                      <Maximize2 className="w-3.5 h-3.5" />
                    )}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition-colors cursor-pointer"
                  aria-label="關閉助理"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-slate-50/80 dark:bg-slate-950/60 custom-scrollbar">
              {messages.length === 0 && (
                <div className="mt-4 space-y-4 px-1">
                  <div className="text-center space-y-1.5">
                    <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800 flex items-center justify-center mx-auto">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
                      用自然語言找人脈或查機構背景
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                      點擊下方範例快速開始，或直接輸入任何篩選條件
                    </p>
                  </div>

                  {/* Clickable Suggestion Chips */}
                  <div className="grid grid-cols-1 gap-2">
                    {SUGGESTION_CHIPS.map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        onClick={() => runPrompt(prompt)}
                        className="text-left px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/40 text-xs font-medium text-slate-700 dark:text-slate-200 transition-colors flex items-center justify-between gap-2 cursor-pointer"
                      >
                        <span>{prompt}</span>
                        <ArrowUpRight className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[90%] rounded-2xl px-3.5 py-2.5 text-[13.5px] leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-indigo-600 text-white rounded-br-sm'
                        : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 rounded-bl-sm shadow-2xs'
                    }`}
                  >
                    {msg.role === 'user' ? (
                      msg.content
                    ) : (
                      <div className="prose prose-sm dark:prose-invert max-w-none [&_p]:my-1 [&_ul]:my-1 [&_li]:my-0.5">
                        <Markdown
                          components={{
                            a: ({ node, ...props }) => (
                              <a
                                {...props}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
                              />
                            ),
                          }}
                        >
                          {msg.content}
                        </Markdown>
                      </div>
                    )}

                    {/* Sync detected search filter back to main SearchPage */}
                    {msg.role === 'model' && msg.detectedIntent && onIntentDetected && (
                      <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            onIntentDetected(msg.detectedIntent!);
                            setIsOpen(false);
                          }}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/70 hover:bg-indigo-100 dark:hover:bg-indigo-900/70 text-indigo-700 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800 text-xs font-semibold transition-colors cursor-pointer"
                        >
                          <SlidersHorizontal className="w-3 h-3" />
                          <span>套用此條件至名片清單</span>
                        </button>
                      </div>
                    )}

                    {/* Sources */}
                    {msg.role === 'model' && msg.sources && msg.sources.length > 0 && (
                      <div className="mt-2.5 pt-2.5 border-t border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-400 mb-1.5 tabular-nums">
                          <Globe className="w-3 h-3" />
                          <span>外部參考來源 ({msg.sources.length})</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {msg.sources.map((source, sIdx) => (
                            <a
                              key={sIdx}
                              href={source.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 bg-slate-50 dark:bg-slate-800 text-indigo-600 dark:text-indigo-300 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700 text-[11px] font-medium hover:bg-indigo-50 dark:hover:bg-indigo-950/50 transition-colors"
                            >
                              <span className="truncate max-w-[150px]">{source.title}</span>
                              <ArrowUpRight className="w-2.5 h-2.5 shrink-0" />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Linked Cards */}
                    {msg.role === 'model' &&
                      msg.linkedCards &&
                      msg.linkedCards.length > 0 &&
                      onJumpToCard && (
                        <div className="mt-2.5 space-y-1.5">
                          {msg.linkedCards.map((card, cIdx) => (
                            <div
                              key={card.id || cIdx}
                              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 flex items-center justify-between p-2 gap-2"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <Database className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                                <span className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">
                                  {card.name || '匹配名片'}
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  onJumpToCard(card.id);
                                  setIsOpen(false);
                                }}
                                className="px-2.5 py-1 bg-indigo-600 text-white text-[11px] font-semibold rounded-lg hover:bg-indigo-700 transition-colors shrink-0 cursor-pointer"
                              >
                                開啟詳情
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                    {/* Copy Reply Action */}
                    {msg.role === 'model' && (
                      <div className="mt-2 flex justify-end">
                        <button
                          type="button"
                          onClick={() => handleCopyReply(msg)}
                          className="text-[11px] text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center gap-1 cursor-pointer"
                        >
                          {copiedId === msg.id ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-500" />
                              <span>已複製</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>複製</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* Staged Thinking Status Indicator */}
              {thinkingStage && (
                <div className="flex items-start">
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3.5 py-2.5 rounded-2xl rounded-bl-sm flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 shadow-2xs">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600 dark:text-indigo-400 shrink-0" />
                    <span>{thinkingStage}</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Footer */}
            <div className="p-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex flex-col gap-2 shrink-0">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setIsSearchEnabled(!isSearchEnabled)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors border cursor-pointer ${
                    isSearchEnabled
                      ? 'bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  <Globe className="w-3 h-3" />
                  <span>{isSearchEnabled ? '聯網查證：開' : '聯網查證：關'}</span>
                </button>
                <span className="text-[11px] text-slate-400">
                  {isSearchEnabled ? '結合 Google 網頁背景查證' : '僅檢索您的名片資料庫'}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:bg-white dark:focus:bg-slate-900 focus:border-indigo-500 focus:outline-none rounded-xl px-3.5 py-2 text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 transition-colors"
                  placeholder={
                    isSearchEnabled ? '輸入問題或查詢機構背景...' : '輸入姓名、國家或條件篩選...'
                  }
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      runPrompt(input);
                    }
                  }}
                  disabled={Boolean(thinkingStage)}
                />
                <button
                  type="button"
                  onClick={() => runPrompt(input)}
                  disabled={!input.trim() || Boolean(thinkingStage)}
                  className="w-9 h-9 bg-indigo-600 text-white rounded-xl disabled:opacity-50 hover:bg-indigo-700 transition-colors flex items-center justify-center shrink-0 cursor-pointer"
                  aria-label="送出查詢"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
