import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Loader2, Globe, Database } from 'lucide-react';
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

export default function ChatBox({ cards, onJumpToCard, externalSearchQuery, onExternalSearchConsumed, onIntentDetected }: ChatBoxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isSearchEnabled, setIsSearchEnabled] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // External Search Trigger
  useEffect(() => {
    if (externalSearchQuery) {
      setIsOpen(true);
      setIsSearchEnabled(true);
      setInput(""); // Clear current input
      
      // We need a slight delay to ensure UI is ready or just call send logic
      const triggerSearch = async () => {
        const userMessage: ChatMessage = { id: Date.now().toString(), role: 'user', content: externalSearchQuery };
        setMessages(prev => [...prev, userMessage]);
        setIsTyping(true);

        try {
          // Stage 1: Intent Extraction
          const intentRes = await fetch('/api/chat/intent', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: userMessage.content })
          });
          const intentData = await intentRes.json();
          
          let candidateCards = cards;
          if (intentData.success && intentData.intent.intentType === 'card_search') {
              candidateCards = filterCards(cards, intentData.intent);
              onIntentDetected?.(intentData.intent);
          }

          // Stage 2: Chat with Filtered Context
          const res = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              prompt: userMessage.content,
              isSearchEnabled: true,
              cards: candidateCards 
            })
          });
          const data = await res.json();
          
          const modelMessage: ChatMessage = { 
            id: (Date.now() + 1).toString(), 
            role: 'model', 
            content: data.success ? data.reply : `❌ 錯誤: \n${data.error}`,
            sources: data.sources,
            linkedCards: data.linkedCards
          };
          setMessages(prev => [...prev, modelMessage]);
        } catch (e: any) {
          setMessages(prev => [...prev, { id: Date.now().toString(), role: 'model', content: `❌ 網路連線錯誤: \n${e.message}` }]);
        } finally {
          setIsTyping(false);
          onExternalSearchConsumed?.();
        }
      };
      
      triggerSearch();
    }
  }, [externalSearchQuery]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleSend = async () => {
    if (!input.trim()) return;
    
    const userPrompt = input;
    const userMessage: ChatMessage = { id: Date.now().toString(), role: 'user', content: userPrompt };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);

    try {
      // Stage 1: Intent Extraction
      const intentRes = await fetch('/api/chat/intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: userPrompt })
      });
      const intentData = await intentRes.json();
      
      let candidateCards = cards;
      if (intentData.success && intentData.intent.intentType === 'card_search') {
          candidateCards = filterCards(cards, intentData.intent);
          onIntentDetected?.(intentData.intent);
      }

      // Stage 2: Chat with Filtered Context
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          prompt: userPrompt,
          isSearchEnabled,
          cards: candidateCards
        })
      });
      const data = await res.json();
      
      const modelMessage: ChatMessage = { 
        id: (Date.now() + 1).toString(), 
        role: 'model', 
        content: data.success ? data.reply : `❌ 錯誤: \n${data.error}`,
        sources: data.sources,
        linkedCards: data.linkedCards
      };
      setMessages(prev => [...prev, modelMessage]);
    } catch (e: any) {
      setMessages(prev => [...prev, { id: Date.now().toString(), role: 'model', content: `❌ 網路連線錯誤: \n${e.message}` }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleSend();
  };

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-6 right-6 p-4 rounded-full bg-emerald-600 text-white shadow-xl hover:bg-emerald-700 transition-transform ${isOpen ? 'scale-0' : 'scale-100'} z-50 flex items-center justify-center`}
      >
        <MessageCircle size={28} />
      </button>

      {/* Chat Window */}
      <div 
        className={`fixed bottom-6 right-6 w-[360px] h-[550px] bg-white rounded-2xl shadow-2xl flex flex-col border border-gray-200 overflow-hidden transition-all duration-300 transform origin-bottom-right z-50 ${isOpen ? 'scale-100 opacity-100' : 'scale-0 opacity-0 pointer-events-none'}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-emerald-600 text-white">
          <div className="flex items-center space-x-2">
            <MessageCircle size={20} />
            <h3 className="font-medium">AI 助理 (即時搜尋)</h3>
          </div>
          <button onClick={() => setIsOpen(false)} className="hover:bg-white/20 p-1 pl-2 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Message List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
          {messages.length === 0 && (
            <div className="text-center text-sm text-gray-400 mt-10">
              <p>哈囉！我是由 Gemini 提供支援的 AI 助理。</p>
              <p className="mt-2 text-xs">
                {isSearchEnabled ? (
                  <span className="flex items-center justify-center gap-1 text-blue-600 font-semibold bg-blue-50 py-1 px-3 rounded-full w-fit mx-auto">
                    <Globe size={12} /> Google Search 已啟動
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-1 text-emerald-600 font-semibold bg-emerald-50 py-1 px-3 rounded-full w-fit mx-auto">
                    <Database size={12} /> 名片數據庫模式
                  </span>
                )}
              </p>
            </div>
          )}
          {messages.map(msg => (
            <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-2 ${msg.role === 'user' ? 'bg-emerald-600 text-white rounded-br-sm' : 'bg-white border border-gray-100 shadow-sm text-gray-800 rounded-bl-sm markdown-body text-sm'}`}>
                {msg.role === 'user' ? (
                   msg.content
                ) : (
                  <Markdown
                    components={{
                       a: ({ node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" className="text-emerald-600 hover:text-emerald-700 underline font-medium" />
                    }}
                  >
                    {msg.content}
                  </Markdown>
                )}
                
                {/* Verified Sources UI */}
                {msg.role === 'model' && msg.sources && msg.sources.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400 mb-2 uppercase tracking-tight">
                      <Globe size={10} /> 驗證來源 ({msg.sources.length})
                    </div>
                    <div className="flex flex-wrap gap-2">
                       {msg.sources.map((source, sIdx) => (
                         <a 
                           key={sIdx} 
                           href={source.url} 
                           target="_blank" 
                           rel="noopener noreferrer"
                           className="flex items-center gap-1 bg-blue-50 text-blue-600 px-2 py-1 rounded text-[9px] font-medium hover:bg-blue-100 transition-colors border border-blue-100/50"
                         >
                           <Globe size={8} />
                           <span className="truncate max-w-[120px]">{source.title}</span>
                         </a>
                       ))}
                    </div>
                  </div>
                )}

                {/* Jump to Card Actions */}
                {msg.role === 'model' && msg.linkedCards && msg.linkedCards.length > 0 && onJumpToCard && (
                  <div className="mt-3 space-y-2">
                    {msg.linkedCards.map((card, cIdx) => (
                      <div key={card.id || cIdx} className="overflow-hidden rounded-xl border border-emerald-100 bg-emerald-50/50 flex items-center justify-between p-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shadow-sm">
                            <Database size={16} />
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-gray-400 uppercase leading-none mb-1">匹配結果</span>
                            <span className="text-xs font-bold text-emerald-900 truncate max-w-[150px]">{card.name || '相關名片'}</span>
                          </div>
                        </div>
                        <button 
                          onClick={() => {
                            onJumpToCard(card.id);
                            setIsOpen(false);
                          }}
                          className="px-3 py-1.5 bg-emerald-600 text-white text-[10px] font-bold rounded-lg hover:bg-emerald-700 transition-colors shadow-sm flex items-center gap-1"
                        >
                          查看詳情 <Send size={10} className="rotate-180" />
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
               <div className="bg-white border border-gray-100 shadow-sm px-4 py-3 rounded-2xl rounded-bl-sm">
                 <Loader2 size={16} className="animate-spin text-emerald-600" />
               </div>
             </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Box */}
        <div className="p-3 bg-white border-t border-gray-100 flex flex-col gap-2">
          {/* Toggles */}
          <div className="flex items-center gap-2 mb-1">
            <button
               onClick={() => setIsSearchEnabled(!isSearchEnabled)}
               className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all border ${
                 isSearchEnabled 
                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm' 
                  : 'bg-white text-gray-400 border-gray-200 hover:border-emerald-500 hover:text-emerald-600'
               }`}
            >
              <Globe size={12} />
              {isSearchEnabled ? '聯網搜尋 ON' : '聯網搜尋 OFF'}
            </button>
            <div className="text-[10px] text-gray-400 font-medium italic">
               {isSearchEnabled ? '正在搜尋全網資訊...' : '優先查詢名片庫資料'}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              className="flex-1 bg-gray-100 border-transparent focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none rounded-full px-4 py-2 text-sm transition-all"
              placeholder={isSearchEnabled ? "問我任何事 (Gemini 聯網模式)..." : "查詢名片聯絡人..."}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isTyping}
            />
            <button 
              onClick={handleSend}
              disabled={!input.trim() || isTyping}
              className="p-2 bg-emerald-600 text-white rounded-full disabled:opacity-50 disabled:cursor-not-allowed hover:bg-emerald-700 transition-colors flex items-center justify-center shrink-0"
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
