/**
 * FastAPI Service Client
 * Handles all HTTP calls to the Python FastAPI game logic service
 */
const axios = require('axios');
const logger = require('../utils/logger');

const fastapiClient = axios.create({
  baseURL: process.env.FASTAPI_URL || 'http://localhost:8000',
  timeout: 5000,
  headers: {
    'Content-Type': 'application/json',
    'X-Internal-Key': process.env.INTERNAL_API_KEY || 'dev-internal-key',
  },
});

// ─── Interceptors ──────────────────────────────────────────────────────────────

fastapiClient.interceptors.request.use((config) => {
  logger.debug(`FastAPI request: ${config.method?.toUpperCase()} ${config.url}`);
  return config;
});

fastapiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const msg = error.response?.data?.detail || error.message;
    logger.error(`FastAPI error: ${msg}`);
    throw new Error(`FastAPI error: ${msg}`);
  }
);

// ─── API Methods ───────────────────────────────────────────────────────────────

/**
 * Evaluate a round — compare player sets and determine winner
 * @param {Object[]} playerSets - Array of { userId, sets: [[card, card, card], ...] }
 * @param {Object} options - { enable235Rule: boolean }
 */
const evaluateRound = async (playerSets, options = {}) => {
  const response = await fastapiClient.post('/api/evaluate-round', {
    player_sets: playerSets,
    options,
  });
  return response.data;
};

/**
 * Validate submitted sets before accepting them
 * @param {string} userId
 * @param {number[][]} sets - 3 sets of 3 cards each (card indices)
 * @param {number[]} dealtCards - The 9 cards dealt to this player
 */
const validateSets = async (userId, sets, dealtCards) => {
  const response = await fastapiClient.post('/api/validate-sets', {
    user_id: userId,
    sets,
    dealt_cards: dealtCards,
  });
  return response.data;
};

/**
 * Fetch leaderboard data
 */
const getLeaderboard = async (limit = 10) => {
  const response = await fastapiClient.get(`/api/leaderboard?limit=${limit}`);
  return response.data;
};

/**
 * Process wallet transaction (entry fee / winnings)
 */
const processTransaction = async (userId, amount, type, matchId) => {
  const response = await fastapiClient.post('/api/wallet/transaction', {
    user_id: userId,
    amount,
    type,        // 'debit' | 'credit'
    match_id: matchId,
    description: type === 'debit' ? 'Game entry fee' : 'Game winnings',
  });
  return response.data;
};

/**
 * Save match result to PostgreSQL via FastAPI
 */
const saveMatchResult = async (matchId, roomId, winnerId, playerResults, totalPot) => {
  const response = await fastapiClient.post('/api/matches/complete', {
    match_id: matchId,
    room_id: roomId,
    winner_id: winnerId,
    player_results: playerResults,
    total_pot: totalPot,
  });
  return response.data;
};

module.exports = {
  evaluateRound,
  validateSets,
  getLeaderboard,
  processTransaction,
  saveMatchResult,
};
