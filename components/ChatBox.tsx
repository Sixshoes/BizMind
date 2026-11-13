import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Loader2, Globe, Database, Sparkles } from 'lucide-react';
import Markdown from 'react-markdown';
import { BusinessCardData } from '../types';
import { filterCards, FilterIntent } from '../utils/cardFilters';

interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  content: string;
  sources?: { title: string; url: string }[];
  linkedCards?: { id: string; name: string }[];
}

interface ChatBoxProps {
  cards: BusinessCardData[];
  onJumpToCard?: (cardId: string) => void;
  externalSearchQuery?: string | null;
  onExternalSearchConsumed?: () => void;
  onIntentDetected?: (intent: FilterIntent) => void;
  forceOpenCounter?: number;
  hasBottomBar?: boolean;
}

const QUICK_PROMPTS = [
  '幫我列出所有與永續或環境相關的聯絡人',
  '統計目前資料庫中各國家的聯絡人分佈',
  '推薦適合邀請參與產學合作或實習的雇主名單'
];

export default function ChatBox({
  cards,
  onJumpToCard,
  externalSearchQuery,
  onExternalSearchConsumed,
  onIntentDetected,
  forceOpenCounter = 0,
  hasBottomBar = false
}: ChatBoxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isSearchEnabled, setIsSearchEnabled] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (forceOpenCounter > 0) {
      setIsOpen(true);
    }
  }, [forceOpenCounter]);

  const sendPrompt = async (promptText: string, forceWebSearch?: boolean) => {
    if (!promptText.trim() || isTyping) return;
    const useWeb = forceWebSearch !== undefined ? forceWebSearch : isSearchEnabled;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: promptText
    };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);

    try {
      const intentRes = await fetch('/api/chat/intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: promptText })
      });
      const intentData = await intentRes.json();

      let candidateCards = cards;
      if (intentData.success && intentData.intent?.intentType === 'card_search') {
        candidateCards = filterCards(cards, intentData.intent);
        onIntentDetected?.(intentData.intent);
      }

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: promptText,
          isSearchEnabled: useWeb,
          cards: candidateCards
        })
      });
      const data = await res.json();

      const modelMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        content: data.success ? data.reply : `目前無法連線至 AI 服務：${data.error || '請確認後端 GEMINI_API_KEY 設定'}`,
        sources: data.sources,
        linkedCards: data.linkedCards
      };
      setMessages(prev => [...prev, modelMessage]);
    } catch (e: any) {
      setMessages(prev => [
        ...prev,
        {
          id: Date.now().toString(),
          role: 'model',
          content: `網路或伺服器連線異常：${e.message}`
        }
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  useEffect(() => {
    if (externalSearchQuery) {
      setIsOpen(true);
      setIsSearchEnabled(true);
      sendPrompt(externalSearchQuery, true).finally(() => {
        onExternalSearchConsumed?.();
      });
    }
  }, [externalSearchQuery]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const bottomOffsetClass = hasBottomBar ? 'bottom-20' : 'bottom-5';

  return (
    <>
      {/* Floating Launcher Pill */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={`fixed ${bottomOffsetClass} right-5 px-3.5 py-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white shadow-xl border border-slate-700/80 transition-all duration-200 ${
          isOpen ? 'scale-0 opacity-0 pointer-events-none' : 'scale-100 opacity-100'
        } z-40 flex items-center gap-2 cursor-pointer`}
        title="開啟三好 AI 智慧人脈助理"
      >
        <span className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
          <Sparkles size={14} />
        </span>
        <span className="text-xs font-semibold hidden sm:inline">AI 人脈助理</span>
      </button>

      {/* Chat Drawer / Window */}
      <div
        className={`fixed ${bottomOffsetClass} right-5 w-[calc(100vw-2.5rem)] sm:w-[380px] h-[540px] max-h-[80vh] bg-white rounded-2xl shadow-2xl flex flex-col border border-slate-200/90 overflow-hidden transition-all duration-200 transform origin-bottom-right z-50 ${
          isOpen ? 'scale-100 opacity-100' : 'scale-95 opacity-0 pointer-events-none'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-slate-900 text-white shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <MessageCircle size={16} />
            </div>
            <div>
              <h3 className="text-xs font-bold leading-tight">三好 AI 智慧人脈助理</h3>
              <p className="text-[10px] text-slate-400">支援自然語言找人脈・Google 聯網背景查證</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="hover:bg-white/10 p-1.5 rounded-lg transition-colors cursor-pointer text-slate-300 hover:text-white"
          >
            <X size={16} />
          </button>
        </div>

        {/* Message List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-slate-50/70 custom-scrollbar">
          {messages.length === 0 && (
            <div className="space-y-4 pt-3">
              <div className="bg-white border border-slate-200/80 rounded-xl p-3.5 shadow-2xs">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-800 mb-1">
                  <Sparkles size={14} className="text-emerald-600" />
                  <span>給人方便・智慧檢索您的善緣人脈庫</span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  目前共有 <span className="font-semibold text-slate-800">{cards.length}</span> 筆名片資料。您可以直接用自然語言詢問人選、分析機構背景，或點擊下方快速提問：
                </p>
              </div>

              <div className="space-y-1.5">
                <div className="text-[11px] font-semibold text-slate-400 px-1">快速提問範例</div>
                {QUICK_PROMPTS.map((q, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => sendPrompt(q)}
                    className="w-full text-left px-3 py-2 bg-white hover:bg-emerald-50/60 border border-slate-200/80 hover:border-emerald-300 rounded-xl text-xs text-slate-700 hover:text-emerald-900 transition-all shadow-2xs cursor-pointer"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map(msg => (
            <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
              <div
                className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-indigo-600 text-white rounded-br-xs shadow-xs'
                    : 'bg-white border border-slate-200/80 shadow-2xs text-slate-800 rounded-bl-xs'
                }`}
              >
                {msg.role === 'user' ? (
                  msg.content
                ) : (
                  <Markdown
                    components={{
                      a: ({ ...props }) => (
                        <a
                          {...props}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-indigo-600 hover:text-indigo-700 underline font-medium"
                        />
                      )
                    }}
                  >
                    {msg.content}
                  </Markdown>
                )}

                {msg.role === 'model' && msg.sources && msg.sources.length > 0 && (
                  <div className="mt-2.5 pt-2.5 border-t border-slate-100">
                    <div className="flex items-center gap-1 text-[10px] font-semibold text-slate-400 mb-1.5">
                      <Globe size={10} /> 查證來源 ({msg.sources.length})
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {msg.sources.map((source, sIdx) => (
                        <a
                          key={sIdx}
                          href={source.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 bg-slate-50 text-indigo-600 px-2 py-0.5 rounded-md text-[10px] font-medium hover:bg-indigo-50 transition-colors border border-slate-200/80"
                        >
                          <Globe size={9} />
                          <span className="truncate max-w-[130px]">{source.title}</span>
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {msg.role === 'model' && msg.linkedCards && msg.linkedCards.length > 0 && onJumpToCard && (
                  <div className="mt-2.5 space-y-1.5">
                    {msg.linkedCards.map((card, cIdx) => (
                      <div
                        key={card.id || cIdx}
                        className="rounded-xl border border-emerald-200/70 bg-emerald-50/50 flex items-center justify-between p-2"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-6 h-6 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0">
                            <Database size={12} />
                          </div>
                          <span className="text-xs font-semibold text-emerald-950 truncate">{card.name || '相關聯絡人'}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            onJumpToCard(card.id);
                            setIsOpen(false);
                          }}
                          className="px-2.5 py-1 bg-emerald-600 text-white text-[10px] font-semibold rounded-lg hover:bg-emerald-700 transition-colors shrink-0 cursor-pointer"
                        >
                          開啟名片
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          {isTyping && (
            <div className="flex items-start">
              <div className="bg-white border border-slate-200/80 shadow-2xs px-3.5 py-2.5 rounded-2xl rounded-bl-xs flex items-center gap-2 text-xs text-slate-500">
                <Loader2 size={14} className="animate-spin text-indigo-600" />
                <span>AI 正在檢索與分析...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Box */}
        <div className="p-3 bg-white border-t border-slate-100 flex flex-col gap-2 shrink-0">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setIsSearchEnabled(!isSearchEnabled)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all border cursor-pointer ${
                isSearchEnabled
                  ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                  : 'bg-slate-50 text-slate-500 border-slate-200 hover:text-slate-700'
              }`}
            >
              <Globe size={11} />
              {isSearchEnabled ? 'Google 聯網查證：開啟' : '本地名片庫檢索'}
            </button>
            {messages.length > 0 && (
              <button
                type="button"
                onClick={() => setMessages([])}
                className="text-[11px] text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                清除對話
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              className="flex-1 bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15 outline-none rounded-xl px-3 py-2 text-xs text-slate-800 transition-all"
              placeholder={isSearchEnabled ? '詢問聯絡人或聯網查詢機構背景...' : '自然語言搜尋名片聯絡人...'}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') sendPrompt(input);
              }}
              disabled={isTyping}
            />
            <button
              type="button"
              onClick={() => sendPrompt(input)}
              disabled={!input.trim() || isTyping}
              className="w-8 h-8 bg-indigo-600 text-white rounded-xl disabled:opacity-40 disabled:cursor-not-allowed hover:bg-indigo-700 transition-colors flex items-center justify-center shrink-0 cursor-pointer"
            >
              <Send size={14} />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
