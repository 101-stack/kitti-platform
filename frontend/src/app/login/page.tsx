'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { authApi } from '@/lib/api';
import { useAuthStore } from '@/store/gameStore';

export default function LoginPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();

  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'name' | 'loading'>('name');

  const handleGuestLogin = async () => {
    if (!username.trim()) return toast.error('Please enter a player name');
    
    setLoading(true);
    setStep('loading');
    
    try {
      const res = await authApi.quickLogin(username.trim());
      setAuth(res.data.access_token, res.data.user);
      toast.success(`Welcome to the table, ${res.data.user.username}! 🎴`, {
        icon: '🎲',
        style: {
          borderRadius: '10px',
          background: '#1a3a1f',
          color: '#c9993a',
          border: '1px solid #c9993a',
        },
      });
      router.push('/lobby');
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to join. Please try again.');
      setStep('name');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full felt-table flex items-center justify-center p-4 relative overflow-hidden bg-[#0a1a0d]">
      {/* Subtle Pattern */}
      <div className="absolute inset-0 kitti-pattern opacity-10 pointer-events-none" />
      
      {/* Decorative Blur */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-yellow-500/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-5%] right-[-5%] w-[40%] h-[40%] rounded-full bg-green-500/5 blur-[100px] pointer-events-none" />

      <motion.div
        className="glass-panel border border-yellow-600/20 w-full max-w-md p-10 sm:p-14 rounded-[2.5rem] relative z-10 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.7)]"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="text-center mb-12">
          <motion.span 
            className="text-6xl mb-4 block"
            animate={{ rotateY: [0, 360] }}
            transition={{ duration: 2, repeat: Infinity, repeatDelay: 5 }}
          >
            🎴
          </motion.span>
          <h1 className="font-display text-5xl sm:text-6xl font-black gold-text mb-2 tracking-tight">KITTI</h1>
          <div className="flex items-center justify-center gap-3">
            <div className="h-[1px] w-8 bg-gradient-to-r from-transparent to-yellow-600/30" />
            <p className="text-[10px] uppercase tracking-[0.4em] text-white/30 font-black">Elite 9-Card Series</p>
            <div className="h-[1px] w-8 bg-gradient-to-l from-transparent to-yellow-600/30" />
          </div>
        </div>

        <AnimatePresence mode="wait">
          {step === 'name' ? (
            <motion.div 
              key="name" 
              initial={{ opacity: 0, scale: 0.95 }} 
              animate={{ opacity: 1, scale: 1 }} 
              exit={{ opacity: 0, scale: 0.95 }}
              className="space-y-8"
            >
              <div className="space-y-3">
                <div className="flex justify-between items-end px-1">
                  <label className="text-[10px] uppercase tracking-[0.2em] font-black text-yellow-500/50">Player Alias</label>
                  <span className="text-[9px] text-white/20 font-bold uppercase tracking-widest">{username.length}/20</span>
                </div>
                <div className="relative group">
                  <div className="absolute inset-0 bg-yellow-500/5 blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity duration-700" />
                  <input
                    className="kitti-input text-center text-xl font-bold h-16 border-white/5 focus:border-yellow-500/40 relative z-10"
                    placeholder="Enter table name..."
                    maxLength={20}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleGuestLogin()}
                    autoFocus
                  />
                </div>
              </div>

              <div className="space-y-4">
                <button 
                  className="btn-gold w-full py-5 text-base shadow-2xl group overflow-hidden" 
                  onClick={handleGuestLogin} 
                  disabled={loading || !username.trim()}
                >
                  <span className="relative z-10 flex items-center justify-center gap-2">
                    TAKE A SEAT <span className="opacity-40 group-hover:translate-x-1 transition-transform">→</span>
                  </span>
                </button>
                
                <div className="flex flex-col items-center gap-2">
                   <p className="text-[9px] text-white/20 font-black uppercase tracking-[0.3em]">
                     Public Beta Access
                   </p>
                   <div className="flex gap-1">
                      {[1,2,3].map(i => <div key={i} className="w-1 h-1 rounded-full bg-yellow-500/10" />)}
                   </div>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="loading"
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }}
              className="flex flex-col items-center py-12 gap-6"
            >
              <div className="relative">
                <div className="absolute inset-0 bg-yellow-500/20 blur-3xl animate-pulse" />
                <div className="w-16 h-16 border-4 border-yellow-500/10 border-t-yellow-500 rounded-full animate-spin relative z-10 shadow-2xl" />
              </div>
              <div className="text-center">
                <p className="text-[10px] font-black uppercase tracking-[0.4em] text-yellow-500 mb-1 animate-pulse">Authenticating</p>
                <p className="text-[9px] font-bold uppercase tracking-widest text-white/20">Joining the grand table...</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mt-12 pt-8 border-t border-white/[0.03] text-center">
           <p className="text-[8px] text-white/10 uppercase tracking-[0.5em] font-black">
             Authenticated Secure Session
           </p>
        </div>
      </motion.div>
    </div>
  );
}
