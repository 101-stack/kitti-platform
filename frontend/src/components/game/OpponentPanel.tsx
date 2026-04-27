'use client';

import React from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import type { GamePlayer } from '@/types/game';

interface OpponentPanelProps {
  player: GamePlayer;
}

export function OpponentPanel({ player }: OpponentPanelProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className={clsx(
        'glass-panel p-3 sm:p-4 rounded-[2rem] flex flex-col items-center gap-3 min-w-[100px] border transition-all duration-500',
        player.hasSubmitted ? 'border-yellow-500/40 shadow-[0_0_20px_rgba(201,153,58,0.1)]' : 'border-white/5'
      )}
    >
      <div className="relative">
        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-br from-yellow-600/10 to-transparent border border-white/10 flex items-center justify-center font-display font-black text-sm gold-text">
          {player.username[0].toUpperCase()}
        </div>
        <div className={clsx(
          'absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-[#0a1a0d]',
          player.isConnected !== false ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-red-500'
        )} />
      </div>

      <div className="text-center">
        <p className="text-[11px] font-bold text-white/80 leading-tight truncate max-w-[80px]">
          {player.username}
        </p>
        <div className="h-4 flex items-center justify-center mt-1">
          {player.hasSubmitted ? (
            <span className="text-[9px] font-black uppercase tracking-widest text-yellow-500 animate-pulse">Ready</span>
          ) : (
            <span className="text-[9px] font-bold uppercase tracking-widest text-white/20">Thinking...</span>
          )}
        </div>
      </div>

      {/* Opponent's Cards - Stylized stack */}
      <div className="flex -space-x-4 opacity-60">
        {[0, 1, 2].map((i) => (
          <div key={i} className="w-6 h-9 sm:w-8 sm:h-12 rounded-md bg-[#1a0f05] border border-yellow-900/30 relative overflow-hidden" 
            style={{ 
              transform: `rotate(${(i - 1) * 10}deg)`,
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='20' height='20' viewBox='0 0 20 20' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23c9993a' fill-opacity='0.05'%3E%3Cpath d='M0 20L20 0H10L0 10M20 20V10L10 20'/%3E%3C/g%3E%3C/svg%3E")`
            }}>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
