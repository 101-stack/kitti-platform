'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { authApi } from '@/lib/api';
import { useAuthStore } from '@/store/gameStore';
import toast from 'react-hot-toast';

type Tab = 'overview' | 'users' | 'transactions';

export default function AdminPanel() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [stats, setStats] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    if (user && !user.is_admin) {
      toast.error('Access Denied');
      router.push('/lobby');
      return;
    }
    fetchData();
  }, [user, isAuthenticated]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [sRes, uRes, tRes] = await Promise.all([
        authApi.getAdminStats(),
        authApi.listUsers(),
        authApi.listTransactions()
      ]);
      setStats(sRes.data);
      setUsers(uRes.data);
      setTransactions(tRes.data);
    } catch (err: any) {
      toast.error('Failed to load admin data');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateCoins = async (userId: string, currentCoins: number) => {
    const amountStr = window.prompt('Enter amount to add (positive) or remove (negative):');
    if (!amountStr) return;
    const amount = parseInt(amountStr);
    if (isNaN(amount)) return;

    const reason = window.prompt('Enter reason for adjustment:');
    if (!reason) return;

    try {
      await authApi.updateUserCoins(userId, amount, reason);
      toast.success('Coins updated');
      fetchData();
    } catch (err) {
      toast.error('Failed to update coins');
    }
  };

  const handleToggleActive = async (userId: string) => {
    try {
      await authApi.toggleUserActive(userId);
      toast.success('User status updated');
      fetchData();
    } catch (err) {
      toast.error('Action failed');
    }
  };

  if (loading && !stats) {
    return (
      <div className="min-h-screen felt-table flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-yellow-500/20 border-t-yellow-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen felt-table text-white p-4 sm:p-8">
      {/* Header */}
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-12">
        <div>
          <h1 className="font-display text-4xl font-black gold-text tracking-tighter">ADMIN PANEL</h1>
          <p className="text-white/40 text-sm uppercase tracking-[0.3em] font-black mt-1">Platform Command Center</p>
        </div>
        <button 
          onClick={() => router.push('/lobby')}
          className="glass-panel-light px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-white/10 transition-all"
        >
          Back to Lobby
        </button>
      </div>

      {/* Tabs */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="glass-panel-light p-1.5 rounded-2xl flex gap-1.5 inline-flex">
          {(['overview', 'users', 'transactions'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className={`tab-btn ${activeTab === t ? 'tab-btn-active' : ''}`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto">
        <AnimatePresence mode="wait">
          {activeTab === 'overview' && (
            <motion.div 
              key="overview"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
            >
              {[
                { label: 'Total Users', value: stats.total_users, icon: '👥' },
                { label: 'Coins in Circulation', value: stats.total_coins_in_circ.toLocaleString(), icon: '🪙' },
                { label: 'Matches Completed', value: stats.total_matches, icon: '🎴' },
                { label: 'Active Waiting Rooms', value: stats.active_rooms, icon: '🎮' }
              ].map((s, i) => (
                <div key={i} className="glass-panel p-8 rounded-[2rem] border-white/5 flex flex-col items-center text-center">
                  <span className="text-4xl mb-4 grayscale-[0.5]">{s.icon}</span>
                  <p className="text-white/40 text-[10px] uppercase tracking-widest font-black mb-1">{s.label}</p>
                  <p className="text-3xl font-display font-black gold-text">{s.value}</p>
                </div>
              ))}
            </motion.div>
          )}

          {activeTab === 'users' && (
            <motion.div 
              key="users"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-panel rounded-[2.5rem] overflow-hidden border-white/5"
            >
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-white/5 bg-white/[0.02]">
                      <th className="px-6 py-4 text-[10px] uppercase tracking-widest text-white/30 font-black">User</th>
                      <th className="px-6 py-4 text-[10px] uppercase tracking-widest text-white/30 font-black">Coins</th>
                      <th className="px-6 py-4 text-[10px] uppercase tracking-widest text-white/30 font-black">Stats (W/G)</th>
                      <th className="px-6 py-4 text-[10px] uppercase tracking-widest text-white/30 font-black">Status</th>
                      <th className="px-6 py-4 text-[10px] uppercase tracking-widest text-white/30 font-black text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {users.map(u => (
                      <tr key={u.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="px-6 py-6">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-600/20 to-transparent border border-yellow-500/10 flex items-center justify-center font-display font-black text-sm text-yellow-500/80">
                              {u.username[0].toUpperCase()}
                            </div>
                            <div>
                              <p className="font-display text-sm font-black text-white">{u.username}</p>
                              <p className="text-[10px] text-white/30 font-bold uppercase tracking-tight">{u.id.slice(0, 8)}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="font-display text-sm font-black text-yellow-500/90">🪙 {u.coins.toLocaleString()}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-xs font-black text-white/50">{u.total_wins} / {u.total_games}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${u.is_active ? 'bg-green-500/10 text-green-500 border border-green-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'}`}>
                            {u.is_active ? 'Active' : 'Blocked'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-2">
                            <button 
                              onClick={() => handleUpdateCoins(u.id, u.coins)}
                              className="px-4 py-2 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 text-[10px] font-black uppercase tracking-widest hover:bg-yellow-500/20 transition-all"
                            >
                              Adj Coins
                            </button>
                            <button 
                              onClick={() => handleToggleActive(u.id)}
                              className={`px-4 py-2 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all ${u.is_active ? 'bg-red-500/10 border-red-500/20 text-red-500 hover:bg-red-500/20' : 'bg-green-500/10 border-green-500/20 text-green-500 hover:bg-green-500/20'}`}
                            >
                              {u.is_active ? 'Block' : 'Unblock'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

          {activeTab === 'transactions' && (
            <motion.div 
              key="transactions"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-panel rounded-[2.5rem] p-4 sm:p-8 border-white/5"
            >
              <div className="space-y-4">
                {transactions.map((tx, i) => (
                  <div key={tx.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-all gap-4">
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${tx.amount > 0 ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                        {tx.amount > 0 ? '↓' : '↑'}
                      </div>
                      <div>
                        <p className="text-sm font-black text-white/90">{tx.description || 'Game Transaction'}</p>
                        <p className="text-[10px] text-white/30 font-bold uppercase tracking-tight">
                          {new Date(tx.created_at).toLocaleString()} · User ID: {tx.user_id.slice(0, 8)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-black font-display ${tx.amount > 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {tx.amount > 0 ? '+' : ''}{tx.amount} 🪙
                      </p>
                      <p className="text-[10px] text-white/20 font-bold uppercase">Balance: {tx.balance_after} 🪙</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
