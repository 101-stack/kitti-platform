'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore, useGameStore, useRoomStore } from '@/store/gameStore';
import { getSocket } from '@/lib/socket';
import { PlayingCard } from '@/components/game/PlayingCard';
import { OpponentPanel } from '@/components/game/OpponentPanel';
import { GameResultModal } from '@/components/game/GameResultModal';
import { SetBuilder } from '@/components/game/SetBuilder';
import toast from 'react-hot-toast';
import clsx from 'clsx';

export default function GamePage() {
  const { gameId } = useParams() as { gameId: string };
  const router = useRouter();
  const { user, token } = useAuthStore() as any;
  const { 
    gameState, myCards, setGameState, setMyCards, 
    cardPlacement, setHasSubmitted, hasSubmitted,
    isSubmitting, setIsSubmitting, gameResult, setGameResult,
    resetGame, placeCard
  } = useGameStore();
  const { setRoom } = useRoomStore();

  const [phase, setPhase] = useState<'dealing' | 'arranging' | 'waiting' | 'result'>('dealing');

  useEffect(() => {
    if (!gameId || !token) return;
    
    const socket = getSocket(token);
    
    const fetchState = () => {
      socket.emit('reconnect_game', { gameId }, (res: any) => {
        if (res?.success) {
          setGameState(res.gameState);
          if (res.myCards) setMyCards(res.myCards);
          if (res.gameState.status === 'complete') {
            setPhase('result');
          } else {
            setPhase(res.gameState.players.find((p: any) => p.userId === user?.id)?.hasSubmitted ? 'waiting' : 'arranging');
          }
        } else {
          toast.error('Game not found');
          router.push('/lobby');
        }
      });
    };

    // Fetch immediately on mount
    if (socket.connected) {
      fetchState();
    }

    // Fetch again if socket reconnects
    socket.on('connect', fetchState);
    return () => {
      socket.off('connect', fetchState);
    };
  }, [gameId, token]);

  useEffect(() => {
    if (!token) return;
    const socket = getSocket(token);

    // Listen for updates
    const onPlayerSubmitted = (data: any) => {
      setGameState({
        ...gameState!,
        players: gameState!.players.map(p => 
          p.userId === data.userId ? { ...p, hasSubmitted: true, submittedAt: data.submittedAt } : p
        )
      });
    };

    const onGameResult = (data: any) => {
      setGameResult(data);
      setPhase('result');
    };

    socket.on('player_submitted', onPlayerSubmitted);
    socket.on('game_result', onGameResult);

    return () => {
      socket.off('player_submitted', onPlayerSubmitted);
      socket.off('game_result', onGameResult);
    };
  }, [gameState, token, setGameState, setGameResult]);

  const handleSubmit = async () => {
    if (Object.keys(cardPlacement).length !== 9) {
      return toast.error('You must use all 9 cards!');
    }

    setIsSubmitting(true);
    
    // Build sets array [ [c1,c2,c3], [c4,c5,c6], [c7,c8,c9] ]
    const sets: any[][] = [[], [], []];
    const cardMap = new Map(myCards.map(c => [c.id, c]));
    
    for (const [cardId, pos] of Object.entries(cardPlacement)) {
      sets[pos.setIndex][pos.slotIndex] = cardMap.get(Number(cardId));
    }

    const socketApi = getSocket(token);
    socketApi.emit('submit_sets', { gameId, sets }, (res: any) => {
      setIsSubmitting(false);
      if (res.success) {
        setHasSubmitted(true);
        setPhase('waiting');
        toast.success('Strategy locked in!');
      } else {
        toast.error(res.error || 'Failed to submit');
      }
    });
  };

  const handleSuggestSets = () => {
    const socketApi = getSocket(token);
    socketApi.emit('request_suggested_sets', { gameId }, (res: any) => {
      if (res.success) {
        // Apply suggested placement
        res.sets.forEach((set: any[], setIndex: number) => {
          set.forEach((card, slotIndex) => {
            placeCard(card.id, setIndex as any, slotIndex as any);
          });
        });
        toast.success('Optimized sets suggested! 💡');
      } else {
        toast.error(res.error || 'Failed to get suggestions');
      }
    });
  };

  if (!gameState) return null;

  const opponents = gameState.players.filter(p => p.userId !== user?.id);
  const players = gameState.players;
  const totalPlayers = players.length;
  const submittedCount = players.filter(p => p.hasSubmitted).length;

  return (
    <div className="min-h-screen felt-table text-white overflow-hidden flex flex-col">
      {/* Header */}
      <div className="glass-panel-light p-4 flex justify-between items-center z-20">
        <div className="flex items-center gap-4">
          <div className="font-display font-black text-xl gold-text tracking-tighter">KITTI ELITE</div>
          <div className="h-4 w-[1px] bg-white/10" />
          <div className="text-[10px] font-black uppercase tracking-widest text-white/40">
            POT: <span className="text-yellow-500">🪙 {gameState.totalPot}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-[10px] font-black uppercase tracking-tighter text-white/30">Entry Fee</p>
            <p className="text-xs font-black">🪙 {gameState.entryFee}</p>
          </div>
        </div>
      </div>

      <div className="flex-1 relative flex flex-col">
        {/* Opponents Section */}
        <div className="flex flex-wrap justify-center gap-2 sm:gap-4 p-2 sm:p-4">
          {opponents.map(p => (
            <OpponentPanel key={p.userId} player={p} />
          ))}
        </div>

        {/* Main Play Area */}
        <div className="flex-1 flex flex-col justify-end pb-8">
          <div className="max-w-4xl mx-auto w-full px-4">
            <AnimatePresence mode="wait">
              {phase === 'arranging' && !hasSubmitted && (
                <motion.div
                  key="arranging"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="space-y-8"
                >
                  <SetBuilder />
                  
                  {/* Action Bar */}
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                    <button
                      onClick={handleSuggestSets}
                      className="glass-panel-light px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] text-white/40 hover:text-yellow-500 hover:border-yellow-500/20 transition-all border border-transparent"
                    >
                      Suggest Best 💡
                    </button>
                    
                    <button
                      onClick={handleSubmit}
                      disabled={isSubmitting || Object.keys(cardPlacement).length !== 9}
                      className="btn-gold px-12 py-5 text-sm shadow-2xl group min-w-[240px]"
                    >
                      {isSubmitting ? 'SUBMITTING...' : 'CONFIRM STRATEGY ✓'}
                    </button>
                  </div>
                </motion.div>
              )}

              {(phase === 'waiting' || hasSubmitted) && (
                <motion.div
                  key="waiting"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-col items-center justify-center py-12 gap-6"
                >
                  <div className="relative">
                    <div className="absolute inset-0 bg-yellow-500/10 blur-3xl animate-pulse" />
                    <div className="w-20 h-20 rounded-full border border-yellow-500/20 bg-yellow-500/5 flex items-center justify-center text-3xl animate-bounce">
                      🔒
                    </div>
                  </div>
                  <div className="text-center">
                    <h3 className="font-display text-2xl font-black gold-text mb-1 uppercase tracking-tighter">Strategy Sealed</h3>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-white/30">
                      Waiting for {totalPlayers - submittedCount} opponents...
                    </p>
                  </div>
                  
                  {/* Progress Bar */}
                  <div className="w-full max-w-xs space-y-2">
                    <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                      <motion.div 
                        className="h-full bg-yellow-500"
                        initial={{ width: 0 }}
                        animate={{ width: `${(submittedCount / totalPlayers) * 100}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[8px] font-black uppercase tracking-widest text-white/20">
                      <span>Analyzing Table</span>
                      <span>{submittedCount}/{totalPlayers} Ready</span>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {gameResult && (
        <GameResultModal 
          result={gameResult} 
          onClose={() => {
            setGameState(null);
            setGameResult(null);
            resetGame();
            router.push('/lobby');
          }} 
        />
      )}
    </div>
  );
}
