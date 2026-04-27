import axios from 'axios';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_FASTAPI_URL || 'http://localhost:8000',
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

// Inject auth token
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem('kitti-auth');
      const auth = raw ? JSON.parse(raw) : null;
      const token = auth?.state?.token;
      if (token) config.headers.Authorization = `Bearer ${token}`;
    } catch {}
  }
  return config;
});

// Handle 401 — clear session and redirect
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('kitti-auth');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;

// ─── API Methods ───────────────────────────────────────────────────────────────

export const authApi = {
  requestOtp: (target: string, type: 'phone' | 'email') =>
    api.post('/api/auth/request-otp', { target, type }),

  verifyOtp: (target: string, code: string, username?: string) =>
    api.post('/api/auth/verify-otp', { target, code, username }),

  quickLogin: (username: string) =>
    api.post('/api/auth/quick-login', { username }),

  getMe: () => api.get('/api/auth/me'),

  // ── Admin ──────────────────────────────────────────────────────────────────
  getAdminStats: () => api.get('/api/admin/stats'),
  listUsers: () => api.get('/api/admin/users'),
  updateUserCoins: (userId: string, amount: number, reason: string) => 
    api.post(`/api/admin/users/${userId}/coins`, { amount, reason }),
  toggleUserActive: (userId: string) => 
    api.post(`/api/admin/users/${userId}/toggle-active`),
  listTransactions: () => api.get('/api/admin/transactions'),
};

export const walletApi = {
  getBalance: () => api.get('/api/wallet/balance'),
  getHistory: (limit = 20, offset = 0) =>
    api.get(`/api/wallet/history?limit=${limit}&offset=${offset}`),
};

export const matchApi = {
  getHistory: (limit = 20, offset = 0) =>
    api.get(`/api/matches/history?limit=${limit}&offset=${offset}`),
  getMatch: (id: string) => api.get(`/api/matches/${id}`),
};

export const leaderboardApi = {
  get: (limit = 10, sortBy: 'wins' | 'earnings' | 'games' = 'wins') =>
    api.get(`/api/leaderboard?limit=${limit}&sort_by=${sortBy}`),
};
