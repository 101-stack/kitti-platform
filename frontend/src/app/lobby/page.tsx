'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { useAuthStore, useRoomStore } from '@/store/gameStore';
import { useSocket } from '@/hooks/useSocket';
import { ChatBox } from '@/components/game/ChatBox';
import { leaderboardApi } from '@/lib/api';
import type { LeaderboardEntry } from '@/types/game';

export default function LobbyPage() {
  const router = useRouter();
  const { user, clearAuth } = useAuthStore();
  const { setRoom } = useRoomStore();
  const { 
    createRoom, joinRoom, lobbyMessages, sendLobbyMessage 
  } = useSocket();

  const [tab, setTab] = useState<'play' | 'leaderboard'>('play');
  const [joinCode, setJoinCode] = useState('');
  const [maxPlayers, setMaxPlayers] = useState(2);
  const [enable235, setEnable235] = useState(false);
  const [loading, setLoading] = useState(false);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [lbLoading, setLbLoading] = useState(false);

  // Redirect if not logged in
  useEffect(() => {
    if (!user) router.replace('/login');
  }, [user]);

  // Load leaderboard when tab changes
  useEffect(() => {
    if (tab === 'leaderboard' && leaderboard.length === 0) {
      setLbLoading(true);
      leaderboardApi.get(10)
        .then(r => setLeaderboard(r.data.entries))
        .catch(() => {})
        .finally(() => setLbLoading(false));
    }
  }, [tab]);

  const handleCreate = async () => {
    setLoading(true);
    try {
      const { roomId, roomState } = await createRoom({ maxPlayers, enable235Rule: enable235 });
      setRoom(roomState);
      router.push(`/room/${roomId}`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to create room');
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!joinCode.trim()) return toast.error('Enter a room code');
    setLoading(true);
    try {
      const { roomState } = await joinRoom(joinCode.trim().toUpperCase());
      setRoom(roomState);
      router.push(`/room/${roomState.roomId}`);
    } catch (err: any) {
      toast.error(err.message || 'Room not found or full');
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <div className="h-dvh w-full felt-table flex flex-col overflow-hidden">
      {/* Header */}
      <header className="glass-panel sticky top-0 z-50 border-b border-yellow-900/20 px-4 sm:px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-3xl filter drop-shadow-lg">🎴</span>
          <h1 className="font-display text-2xl font-black tracking-tighter gold-text">KITTI</h1>
        </div>
        
        <div className="flex items-center gap-2 sm:gap-6">
          <div className="glass-panel-light px-3 sm:px-5 py-2 rounded-2xl flex items-center gap-2 sm:gap-3">
            <span className="text-xl sm:text-2xl drop-shadow-md">🪙</span>
            <span className="font-display text-sm sm:text-lg font-black text-yellow-100">{user.coins.toLocaleString()}</span>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-4 pl-2 sm:pl-4 border-l border-white/5">
            <div className="text-right">
              <div className="flex items-center justify-end gap-2">
                {user.is_admin && (
                  <button 
                    onClick={() => router.push('/admin')}
                    className="px-2 py-0.5 rounded bg-yellow-500/20 border border-yellow-500/30 text-[8px] font-black uppercase text-yellow-500 hover:bg-yellow-500/30 transition-all"
                  >
                    Admin
                  </button>
                )}
                <p className="font-display text-[10px] sm:text-sm font-black text-white leading-none mb-1 uppercase tracking-wider">{user.username}</p>
              </div>
              <div className="flex items-center justify-end gap-1.5 text-[8px] sm:text-[10px] uppercase tracking-tighter text-yellow-500/50 font-black">
                <span>{user.totalWins}W</span>
                <span className="opacity-20">/</span>
                <span>{user.totalGames}G</span>
              </div>
            </div>
            <button
              onClick={() => { clearAuth(); router.push('/login'); }}
              className="p-2 sm:p-2.5 rounded-xl bg-white/[0.03] border border-white/5 hover:bg-red-500/10 hover:border-red-500/20 transition-all text-white/30 hover:text-red-500"
              title="Sign Out"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            </button>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <div className="flex justify-center mt-6 mb-2">
        <div className="glass-panel-light p-1.5 rounded-2xl flex gap-1.5">
          {[{ id: 'play', label: 'Play Game' }, { id: 'leaderboard', label: 'Leaderboard' }].map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id as any)}
              className={`tab-btn ${tab === t.id ? 'tab-btn-active' : ''}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 relative overflow-y-auto custom-scrollbar pb-12">
        <div className="absolute inset-0 kitti-pattern opacity-10 pointer-events-none" />

        <div className="relative z-10 max-w-2xl mx-auto w-full p-4 sm:p-6">
          <AnimatePresence mode="wait">
            {tab === 'play' ? (
              <motion.div
                key="play-tab"
                className="grid gap-8"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.3 }}
              >
                {/* Create Section */}
                <div className="glass-panel gold-border p-8 rounded-2xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                    <span className="text-9xl font-display">♠</span>
                  </div>
                  
                  <div className="relative z-10">
                    <h2 className="font-display text-2xl font-black mb-1 gold-text">New Game</h2>
                    <p className="text-white/40 text-sm mb-8">Set up your private table and invite friends</p>

                    <div className="grid sm:grid-cols-2 gap-8">
                      <div className="space-y-4">
                        <label className="text-[10px] uppercase tracking-widest font-bold text-yellow-500/60 block flex justify-between">
                          <span>Total Table Size</span>
                          <span className="text-white/30 lowercase normal-case">Bots fill empty seats</span>
                        </label>
                        <div className="flex gap-2">
                          {[2, 3, 4, 5].map(n => (
                            <button
                              key={n}
                              onClick={() => setMaxPlayers(n)}
                              className={`flex-1 py-3 rounded-xl font-display text-sm transition-all border ${
                                maxPlayers === n 
                                  ? 'bg-yellow-500 text-black border-yellow-400 shadow-lg' 
                                  : 'bg-black/20 text-white/40 border-white/5 hover:border-white/20'
                              }`}
                            >
                              {n}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-4">
                        <label className="text-[10px] uppercase tracking-widest font-bold text-yellow-500/60 block">
                          Game Rules
                        </label>
                        <button
                          onClick={() => setEnable235(!enable235)}
                          className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all ${
                            enable235 ? 'border-yellow-500/50 bg-yellow-500/5' : 'border-white/5 bg-black/20'
                          }`}
                        >
                          <div className="text-left">
                            <p className={`text-sm font-bold ${enable235 ? 'text-yellow-400' : 'text-white/60'}`}>2-3-5 Rule</p>
                            <p className="text-[10px] text-white/40 italic">Highest sequence sequence</p>
                          </div>
                          <div className={`w-10 h-5 rounded-full transition-all relative ${enable235 ? 'bg-yellow-500' : 'bg-white/10'}`}>
                            <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${enable235 ? 'left-6' : 'left-1'}`} />
                          </div>
                        </button>
                      </div>
                    </div>

                    <div className="mt-8 pt-6 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4">
                      <div className="flex items-center gap-3 glass-panel-light px-4 py-2 rounded-xl">
                        <span className="text-xl">💰</span>
                        <div>
                          <p className="text-[10px] uppercase tracking-widest text-white/40 font-bold">Entry Fee</p>
                          <p className="text-sm font-display font-bold text-yellow-100">100 Coins</p>
                        </div>
                      </div>
                      <button className="btn-gold w-full sm:w-auto sm:px-12 py-4 text-base" onClick={handleCreate} disabled={loading}>
                        {loading ? 'Creating...' : 'Launch Table'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Join Section */}
                <div className="glass-panel p-8 rounded-2xl border border-white/5">
                  <h2 className="font-display text-xl font-bold mb-1 text-white/90">Join Existing</h2>
                  <p className="text-white/40 text-sm mb-6">Enter a room code to join an ongoing game</p>
                  
                  <div className="flex gap-4">
                    <input
                      className="kitti-input flex-1 text-center text-2xl tracking-[0.5em] font-display font-black uppercase placeholder:opacity-20"
                      placeholder="CODE"
                      maxLength={8}
                      value={joinCode}
                      onChange={e => setJoinCode(e.target.value.toUpperCase())}
                      onKeyDown={e => e.key === 'Enter' && handleJoin()}
                    />
                    <button className="btn-gold px-10" onClick={handleJoin} disabled={loading}>
                      {loading ? '...' : 'Join'}
                    </button>
                  </div>
                </div>

                {/* Global Lobby Chat */}
                <ChatBox 
                  messages={lobbyMessages} 
                  onSendMessage={sendLobbyMessage} 
                  title="Global Lobby Chat"
                  placeholder="Chat with everyone in the lobby..."
                  className="mt-4"
                />
              </motion.div>
            ) : (
              <motion.div 
                key="lb-tab"
                initial={{ opacity: 0, y: 20 }} 
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                <div className="glass-panel gold-border rounded-2xl overflow-hidden shadow-2xl">
                  <div className="bg-gradient-to-r from-yellow-600/20 to-transparent p-6 border-b border-white/5">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="font-display text-2xl font-black gold-text">Hall of Fame</h2>
                        <p className="text-white/40 text-xs mt-1">Global ranking of top card sharks</p>
                      </div>
                      <div className="text-3xl">🏆</div>
                    </div>
                  </div>
                  
                  {lbLoading ? (
                    <div className="p-20 text-center">
                      <div className="inline-block w-8 h-8 border-4 border-yellow-500/20 border-t-yellow-500 rounded-full animate-spin mb-4" />
                      <p className="font-display text-sm text-white/40 uppercase tracking-widest">Consulting the Elders...</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-white/5">
                      {leaderboard.map((entry, i) => (
                        <div key={entry.userId}
                          className={`flex items-center gap-4 px-6 py-4 transition-colors hover:bg-white/5 ${
                            entry.userId === user.id ? 'bg-yellow-500/10' : ''
                          }`}>
                          <div className="w-10 flex justify-center">
                            {i === 0 ? <span className="text-2xl">🥇</span> : 
                             i === 1 ? <span className="text-2xl">🥈</span> : 
                             i === 2 ? <span className="text-2xl">🥉</span> : 
                             <span className="font-display text-lg text-white/20">#{i + 1}</span>}
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-bold text-white truncate">{entry.username}</p>
                              {entry.userId === user.id && (
                                <span className="px-2 py-0.5 rounded-full bg-yellow-500 text-[10px] font-black text-black uppercase">You</span>
                              )}
                            </div>
                            <p className="text-[10px] text-white/40 uppercase tracking-widest font-bold">
                              {entry.totalGames} Games · {entry.winRate}% Win Rate
                            </p>
                          </div>
                          
                          <div className="text-right">
                            <p className="font-display text-base font-black text-yellow-400">{entry.totalWins} Wins</p>
                            <div className="flex items-center justify-end gap-1 text-[10px] text-white/40 font-bold uppercase">
                              <span>🪙</span>
                              <span>{entry.coins.toLocaleString()}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                      
                      {leaderboard.length === 0 && (
                        <div className="p-20 text-center">
                          <p className="text-white/30 italic">No legends recorded yet...</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>

  );
}
