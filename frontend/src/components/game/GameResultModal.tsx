'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '@/store/gameStore';
import { PlayingCard } from './PlayingCard';

interface GameResultModalProps {
  result: any;
  onClose: () => void;
}

export function GameResultModal({ result, onClose }: GameResultModalProps) {
  const { user } = useAuthStore();
  const isWinner = result.overallWinner === user?.id;
  const isKitti = result.isTie || !result.overallWinner;
  const isSalami = result.isSalami;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-[#0a1a0d]/90 backdrop-blur-xl"
        onClick={onClose}
      />
      
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative w-full max-w-2xl glass-panel p-8 sm:p-12 rounded-[3rem] border-white/5 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.8)] overflow-hidden"
      >
        {/* Background Glow */}
        <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-[80%] h-32 blur-[100px] opacity-20 ${isWinner ? 'bg-yellow-500' : isKitti ? 'bg-blue-500' : 'bg-red-500'}`} />

        <div className="relative z-10 text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring' }}
            className="text-6xl mb-6"
          >
            {isSalami ? '👑' : isWinner ? '🏆' : isKitti ? '🤝' : '💀'}
          </motion.div>

          <h2 className="font-display text-4xl sm:text-5xl font-black mb-2 tracking-tighter">
            {isSalami ? (
              <span className="gold-text">SALAMI!</span>
            ) : isWinner ? (
              <span className="gold-text">VICTORY</span>
            ) : isKitti ? (
              <span className="text-blue-400">KITTI (DRAW)</span>
            ) : (
              <span className="text-white/40">DEFEAT</span>
            )}
          </h2>
          
          <p className="text-[10px] uppercase tracking-[0.4em] text-white/20 font-black mb-8">
            {isKitti ? 'No consecutive winner found' : 'The table has been settled'}
          </p>

          <div className="grid grid-cols-1 gap-4 mb-10">
            {isWinner && !isKitti && (
              <div className="glass-panel-light p-6 rounded-2xl border-yellow-500/10">
                <p className="text-[10px] uppercase tracking-widest text-yellow-500/50 font-black mb-1">Total Winnings</p>
                <p className="text-4xl font-display font-black gold-text">🪙 {result.totalPot}</p>
              </div>
            )}
            
            {isKitti && (
              <div className="glass-panel-light p-6 rounded-2xl border-blue-500/10">
                <p className="text-[10px] uppercase tracking-widest text-blue-400/50 font-black mb-1">Pot Action</p>
                <p className="text-xl font-display font-black text-white/60 uppercase">Carry Over / Refunded</p>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3">
            <button
              onClick={onClose}
              className="btn-gold w-full py-5 text-sm"
            >
              RETURN TO LOBBY
            </button>
            <p className="text-[9px] text-white/10 font-bold uppercase tracking-widest">
              Match ID: {result.gameId.slice(0, 8)}
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
