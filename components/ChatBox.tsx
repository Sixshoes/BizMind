import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Send, Loader2, Globe, Database, ArrowUpRight } from 'lucide-react';
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
}

export default function ChatBox({
  cards,
  onJumpToCard,
  externalSearchQuery,
  onExternalSearchConsumed,
  onIntentDetected,
}: ChatBoxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isSearchEnabled, setIsSearchEnabled] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (externalSearchQuery) {
      setIsOpen(true);
      setIsSearchEnabled(true);
      setInput('');

      const triggerSearch = async () => {
        const userMessage: ChatMessage = {
          id: Date.now().toString(),
          role: 'user',
          content: externalSearchQuery,
        };
        setMessages((prev) => [...prev, userMessage]);
        setIsTyping(true);

        try {
          const intentRes = await fetch('/api/chat/intent', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: userMessage.content }),
          });
          const intentData = await intentRes.json();

          let candidateCards = cards;
          if (intentData.success && intentData.intent.intentType === 'card_search') {
            candidateCards = filterCards(cards, intentData.intent);
            onIntentDetected?.(intentData.intent);
          }

          const res = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prompt: userMessage.content,
              isSearchEnabled: true,
              cards: candidateCards,
            }),
          });
          const data = await res.json();

          const modelMessage: ChatMessage = {
            id: (Date.now() + 1).toString(),
            role: 'model',
            content: data.success ? data.reply : `發生錯誤：\n${data.error}`,
            sources: data.sources,
            linkedCards: data.linkedCards,
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
          setIsTyping(false);
          onExternalSearchConsumed?.();
        }
      };

      triggerSearch();
    }
  }, [externalSearchQuery]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userPrompt = input;
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: userPrompt,
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);

    try {
      const intentRes = await fetch('/api/chat/intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: userPrompt }),
      });
      const intentData = await intentRes.json();

      let candidateCards = cards;
      if (intentData.success && intentData.intent.intentType === 'card_search') {
        candidateCards = filterCards(cards, intentData.intent);
        onIntentDetected?.(intentData.intent);
      }

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: userPrompt,
          isSearchEnabled,
          cards: candidateCards,
        }),
      });
      const data = await res.json();

      const modelMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        content: data.success ? data.reply : `發生錯誤：\n${data.error}`,
        sources: data.sources,
        linkedCards: data.linkedCards,
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
      setIsTyping(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleSend();
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-5 right-5 h-11 px-3.5 rounded-xl bg-slate-900 text-white shadow-lg border border-slate-800 hover:bg-slate-800 transition-all ${
          isOpen ? 'scale-0 opacity-0 pointer-events-none' : 'scale-100 opacity-100'
        } z-30 flex items-center gap-2 cursor-pointer`}
        title="開啟名片語意檢索助理"
      >
        <MessageSquare className="w-4 h-4 text-indigo-400" />
        <span className="text-xs font-semibold hidden sm:inline">智慧檢索</span>
      </button>

      <div
        className={`fixed bottom-5 right-5 w-[360px] max-w-[calc(100vw-2.5rem)] h-[520px] max-h-[80vh] bg-white rounded-2xl shadow-2xl flex flex-col border border-slate-200 overflow-hidden transition-all duration-200 transform origin-bottom-right z-50 ${
          isOpen ? 'scale-100 opacity-100' : 'scale-95 opacity-0 pointer-events-none'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center">
              <MessageSquare className="w-3.5 h-3.5" />
            </div>
            <div>
              <h3 className="text-xs font-semibold font-display text-slate-900">
                名片語意搜尋助理
              </h3>
              <p className="text-[11px] text-slate-500">
                {isSearchEnabled ? '全網背景查證已啟用' : '本地名片資料庫檢索'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
            aria-label="關閉助理"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-slate-50 custom-scrollbar">
          {messages.length === 0 && (
            <div className="text-center text-xs text-slate-500 mt-10 space-y-2 px-4">
              <p className="font-semibold text-slate-700">BizMind AI 智慧人脈檢索</p>
              <p className="leading-relaxed">
                可直接詢問「找出來自新加坡的大學教授」或開啟聯網搜尋查詢機構背景。
              </p>
              <div className="pt-2 flex justify-center">
                {isSearchEnabled ? (
                  <span className="inline-flex items-center gap-1 text-indigo-700 font-medium text-[11px]">
                    <Globe className="w-3.5 h-3.5" />
                    <span>聯網機構查證模式</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-slate-600 font-medium text-[11px]">
                    <Database className="w-3.5 h-3.5" />
                    <span className="tabular-nums">本地資料庫模式 ({cards.length} 筆)</span>
                  </span>
                )}
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[88%] rounded-xl px-3.5 py-2.5 text-xs leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-indigo-600 text-white rounded-br-xs'
                    : 'bg-white border border-slate-200 text-slate-800 rounded-bl-xs'
                }`}
              >
                {msg.role === 'user' ? (
                  msg.content
                ) : (
                  <Markdown
                    components={{
                      a: ({ node, ...props }) => (
                        <a
                          {...props}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-indigo-600 hover:text-indigo-700 underline font-medium"
                        />
                      ),
                    }}
                  >
                    {msg.content}
                  </Markdown>
                )}

                {msg.role === 'model' && msg.sources && msg.sources.length > 0 && (
                  <div className="mt-2.5 pt-2.5 border-t border-slate-100">
                    <div className="flex items-center gap-1 text-[10px] font-semibold text-slate-400 mb-1.5 tabular-nums">
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
                          className="inline-flex items-center gap-1 bg-slate-50 text-indigo-600 px-2 py-0.5 rounded border border-slate-200 text-[10px] font-medium hover:bg-indigo-50 transition-colors"
                        >
                          <span className="truncate max-w-[140px]">{source.title}</span>
                          <ArrowUpRight className="w-2.5 h-2.5 shrink-0" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {msg.role === 'model' &&
                  msg.linkedCards &&
                  msg.linkedCards.length > 0 &&
                  onJumpToCard && (
                    <div className="mt-2.5 space-y-1.5">
                      {msg.linkedCards.map((card, cIdx) => (
                        <div
                          key={card.id || cIdx}
                          className="rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-between p-2 gap-2"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <Database className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                            <span className="text-xs font-semibold text-slate-800 truncate">
                              {card.name || '匹配名片'}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              onJumpToCard(card.id);
                              setIsOpen(false);
                            }}
                            className="px-2.5 py-1 bg-indigo-600 text-white text-[11px] font-semibold rounded-md hover:bg-indigo-700 transition-colors shrink-0 cursor-pointer"
                          >
                            開啟詳情
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
              <div className="bg-white border border-slate-200 px-3.5 py-2.5 rounded-xl rounded-bl-xs">
                <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-3 bg-white border-t border-slate-200 flex flex-col gap-2 shrink-0">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setIsSearchEnabled(!isSearchEnabled)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors border cursor-pointer ${
                isSearchEnabled
                  ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                  : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <Globe className="w-3 h-3" />
              <span>{isSearchEnabled ? '聯網搜尋：開啟' : '聯網搜尋：關閉'}</span>
            </button>
            <span className="text-[11px] text-slate-400">
              {isSearchEnabled ? '結合網頁背景資料' : '僅檢索名片庫'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              className="flex-1 bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 focus:outline-none rounded-lg px-3 py-2 text-xs text-slate-800 transition-colors"
              placeholder={
                isSearchEnabled ? '輸入問題或查詢機構背景...' : '輸入姓名、國家或關鍵字篩選...'
              }
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isTyping}
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={!input.trim() || isTyping}
              className="w-8 h-8 bg-indigo-600 text-white rounded-lg disabled:opacity-50 hover:bg-indigo-700 transition-colors flex items-center justify-center shrink-0 cursor-pointer"
              aria-label="送出查詢"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
