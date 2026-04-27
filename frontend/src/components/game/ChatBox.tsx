'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '@/store/gameStore';

interface Message {
  id: string;
  userId: string;
  username: string;
  message: string;
  timestamp: number;
}

interface ChatBoxProps {
  messages: Message[];
  onSendMessage: (msg: string) => void;
  title?: string;
  placeholder?: string;
  className?: string;
}

export function ChatBox({ messages, onSendMessage, title = "Table Chat", placeholder = "Type a message...", className = "" }: ChatBoxProps) {
  const { user } = useAuthStore();
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = () => {
    if (!input.trim()) return;
    onSendMessage(input.trim());
    setInput('');
  };

  return (
    <div className={`glass-panel rounded-2xl flex flex-col overflow-hidden ${className}`}>
      {/* Chat Header */}
      <div className="px-4 py-3 border-b border-white/5 bg-white/5 flex items-center justify-between">
         <h3 className="font-display text-[10px] uppercase tracking-widest font-black text-white/40">
           {title}
         </h3>
         <div className="flex gap-1">
           <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
           <span className="text-[8px] text-white/20 uppercase font-bold tracking-tighter">Live</span>
         </div>
      </div>

      {/* Message List */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar min-h-[150px] max-h-[300px]"
      >
        <AnimatePresence initial={false}>
          {messages.map((m) => {
            const isMe = m.userId === user?.id;
            return (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, x: isMe ? 10 : -10 }}
                animate={{ opacity: 1, x: 0 }}
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
              >
                {!isMe && (
                  <span className="text-[9px] font-bold text-yellow-500/60 ml-1 mb-0.5">
                    {m.username}
                  </span>
                )}
                <div className={`px-3 py-1.5 rounded-xl text-sm max-w-[85%] break-words ${
                  isMe 
                    ? 'bg-yellow-500/20 text-yellow-100 border border-yellow-500/20 rounded-tr-none' 
                    : 'bg-white/5 text-white/80 border border-white/5 rounded-tl-none'
                }`}>
                  {m.message}
                </div>
                <span className="text-[8px] text-white/10 mt-0.5">
                  {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </motion.div>
            );
          })}
        </AnimatePresence>
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full opacity-10 py-10">
            <span className="text-3xl mb-2">💬</span>
            <p className="text-[10px] uppercase tracking-widest font-bold">No messages yet</p>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-3 border-t border-white/5 bg-black/20">
        <div className="relative flex gap-2">
          <input
            type="text"
            className="kitti-input flex-1 !text-xs !h-10 pr-12"
            placeholder={placeholder}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          />
          <button 
            onClick={handleSend}
            className="absolute right-1 top-1 bottom-1 px-3 rounded-lg bg-yellow-500 text-black text-xs font-bold transition-all active:scale-95 disabled:opacity-30"
            disabled={!input.trim()}
          >
            SEND
          </button>
        </div>
      </div>
    </div>
  );
}
