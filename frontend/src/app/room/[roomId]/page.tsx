'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { useAuthStore, useRoomStore, useGameStore } from '@/store/gameStore';
import { useSocket } from '@/hooks/useSocket';
import { ChatBox } from '@/components/game/ChatBox';
import type { Room } from '@/types/game';

export default function RoomPage() {
  const params = useParams();
  const roomId = params?.roomId as string;
  const router = useRouter();
  const { user } = useAuthStore();
  const { room, setRoom } = useRoomStore();
  const { gameId } = useGameStore();
  const { 
    startGame, leaveRoom, setPlayerReady, joinRoom,
    roomMessages, sendRoomMessage 
  } = useSocket();
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!user) { router.replace('/login'); return; }
    // If we don't have room state, try to join (handles refresh/direct link)
    if (!room && roomId) {
      joinRoom(roomId).then(({ roomState }) => setRoom(roomState)).catch(() => {
        toast.error('Room not found');
        router.push('/lobby');
      });
    }
  }, [user, room, roomId, joinRoom, router, setRoom]);

  // When game starts, navigate to game table
  useEffect(() => {
    const activeGameId = room?.currentGameId || gameId;
    if (room?.status === 'playing' && activeGameId) {
      router.push(`/game/${activeGameId}`);
    }
  }, [gameId, room, router]);

  const isHost = room?.hostId === user?.id;
  const myPlayer = room?.players.find(p => p.userId === user?.id);

  const handleStart = async () => {
    setLoading(true);
    try {
      await startGame(roomId);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLeave = async () => {
    try {
      await leaveRoom(roomId);
      setRoom(null);
      router.push('/lobby');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const copyCode = () => {
    navigator.clipboard.writeText(roomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Room code copied!');
  };

  if (!room) {
    return (
      <div className="min-h-dvh felt-table flex items-center justify-center">
        <p style={{ color: 'var(--text-muted)' }}>Loading room...</p>
      </div>
    );
  }

  const canStart = isHost && room.players.length >= 1 && room.status === 'waiting';
  const filledSlots = room.players;
  const emptySlots = Array(room.maxPlayers - room.players.length).fill(null);

  return (
    <div className="min-h-dvh felt-table flex flex-col">
      {/* Header */}
      <header className="glass-panel sticky top-0 z-50 border-b border-yellow-900/20 px-6 py-4 flex items-center justify-between">
        <button onClick={handleLeave}
          className="group flex items-center gap-2 text-[10px] uppercase tracking-widest font-bold text-white/40 hover:text-red-400 transition-colors">
          <span className="text-lg transition-transform group-hover:-translate-x-1">←</span> 
          Exit Lobby
        </button>
        <div className="flex flex-col items-center">
          <h1 className="font-display text-xl font-black gold-text leading-none">
            ROOM LOBBY
          </h1>
          <p className="text-[8px] uppercase tracking-[0.3em] text-yellow-500/50 font-black mt-1">Waiting for players</p>
        </div>
        <div className="w-24" />
      </header>

      <div className="flex-1 max-w-xl mx-auto w-full p-4 sm:p-8 flex flex-col gap-8 custom-scrollbar">
        {/* Room Code - VIP Style */}
        <motion.div
          className="glass-panel gold-border p-10 rounded-3xl text-center relative overflow-hidden"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-yellow-500 to-transparent opacity-30" />
          
          <p className="text-[10px] uppercase tracking-[0.4em] mb-4 text-yellow-500/60 font-black">
            Invitation Code
          </p>
          <div className="flex items-center justify-center gap-4">
            <span className="font-display text-5xl sm:text-6xl font-black tracking-[0.2em] gold-text drop-shadow-2xl">
              {roomId}
            </span>
            <button
              onClick={copyCode}
              className={`p-3 rounded-xl transition-all border ${
                copied ? 'bg-green-500/20 border-green-500/40 text-green-400' : 'bg-white/5 border-white/10 text-white/40 hover:text-white/80'
              }`}
              title="Copy Code"
            >
              {copied ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              )}
            </button>
          </div>
          <p className="text-xs mt-6 text-white/30 italic">
            Tap the code to share with your friends
          </p>

          {room.options.enable235Rule && (
            <div className="inline-flex items-center gap-2 mt-6 px-4 py-1.5 rounded-full bg-yellow-500/10 border border-yellow-500/20">
              <span className="text-xs">⚡</span>
              <span className="text-[10px] font-black uppercase tracking-widest text-yellow-500">2-3-5 Rule Active</span>
            </div>
          )}
        </motion.div>

        {/* Player Table */}
        <div className="glass-panel rounded-3xl overflow-hidden">
          <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between bg-white/5">
            <h2 className="font-display text-xs uppercase tracking-[0.2em] font-black text-white/60">
              The Table ({room.players.length}/{room.maxPlayers})
            </h2>
            <div className="flex items-center gap-3 glass-panel-light px-3 py-1 rounded-full border border-yellow-500/20">
              <span className="text-sm">💰</span>
              <span className="text-[10px] font-black uppercase tracking-widest text-yellow-100">
                Pot: {room.entryFee * room.maxPlayers}
              </span>
            </div>
          </div>

          <div className="p-4 space-y-3">
            <AnimatePresence>
              {filledSlots.map((player, i) => (
                <motion.div
                  key={player.userId}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ delay: i * 0.1 }}
                  className={`flex items-center gap-4 p-4 rounded-2xl border transition-all ${
                    player.userId === user?.id
                      ? 'bg-yellow-500/10 border-yellow-500/30 shadow-[inset_0_0_20px_rgba(201,153,58,0.1)]'
                      : 'bg-black/20 border-white/5'
                  }`}
                >
                  <div className="relative">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-yellow-600/20 to-transparent border border-yellow-500/20 flex items-center justify-center font-display font-black text-xl gold-text">
                      {player.username[0].toUpperCase()}
                    </div>
                    <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-[#0a1a0d] ${player.isConnected ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]' : 'bg-red-500'}`} />
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-white text-base">
                        {player.username}
                      </p>
                      {player.userId === user?.id && (
                        <span className="px-2 py-0.5 rounded-full bg-white/10 text-[8px] font-black uppercase text-white/40 tracking-tighter">You</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      {room.hostId === player.userId && (
                        <p className="text-[10px] font-black uppercase tracking-widest text-yellow-500 flex items-center gap-1">
                          <span>👑</span> Room Host
                        </p>
                      )}
                      {!player.isConnected && (
                        <p className="text-[10px] font-bold text-red-400 uppercase tracking-widest">Disconnected</p>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {/* Empty Reserved Seats */}
            {emptySlots.map((_, i) => (
              <div key={`empty-${i}`}
                className="flex items-center gap-4 p-4 rounded-2xl border border-white/5 border-dashed opacity-30">
                <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10" />
                <div>
                  <p className="text-xs font-bold text-white/40 uppercase tracking-widest italic">Reserved Seat</p>
                  <p className="text-[10px] text-white/20 uppercase mt-0.5">Waiting for Player...</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Chat Section */}
        <ChatBox 
          messages={roomMessages} 
          onSendMessage={(msg) => sendRoomMessage(roomId, msg)} 
        />

        {/* Action Controls */}
        <div className="mt-auto">
          {isHost ? (
            <div className="space-y-4">
              <button
                className="btn-gold w-full text-lg py-5 rounded-2xl shadow-[0_20px_40px_-10px_rgba(201,153,58,0.3)]"
                onClick={handleStart}
                disabled={!canStart || loading}
              >
                {loading ? 'Inaugurating Game...' : canStart
                  ? (room.players.length < room.maxPlayers 
                      ? `Launch Match (+${room.maxPlayers - room.players.length} Bots)` 
                      : `Launch Match (${room.players.length} Players)`)
                  : `Waiting for ${room.maxPlayers - room.players.length} more`}
              </button>
              <p className="text-center text-[10px] uppercase tracking-widest text-white/20 font-bold">
                {room.players.length < room.maxPlayers ? 'Empty seats will be filled by AI bots' : 'Only the host can start the game'}
              </p>
            </div>
          ) : (
            <div className="glass-panel p-8 rounded-3xl text-center border border-white/5">
              <p className="text-white/60 font-bold italic mb-6">
                The host is preparing the deck...
              </p>
              <div className="flex justify-center gap-3">
                {[0, 1, 2].map(i => (
                  <motion.div
                    key={i}
                    className="w-3 h-3 rounded-full bg-yellow-500/50"
                    animate={{ 
                      scale: [1, 1.5, 1],
                      opacity: [0.3, 1, 0.3],
                      boxShadow: ["0 0 0px var(--gold-glow)", "0 0 20px var(--gold-glow)", "0 0 0px var(--gold-glow)"]
                    }}
                    transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.3 }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>

  );
}
