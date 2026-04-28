/**
 * Redis Service
 * Centralized Redis client with helper methods for game state management
 * Uses ioredis for cluster/sentinel support
 * Supports both individual config vars and REDIS_URL (Railway format)
 */
const Redis = require('ioredis');
const logger = require('../utils/logger');

// Parse Redis connection from REDIS_URL (Railway) or individual env vars
let redisConfig;
if (process.env.REDIS_URL) {
  // Railway format: redis://:password@host:port/db
  redisConfig = process.env.REDIS_URL;
  logger.info('Redis: Using REDIS_URL from environment (Railway)');
} else {
  // Local development format
  redisConfig = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB) || 0,
  };
  logger.info('Redis: Using individual host/port/password configuration');
}

const redisClient = new Redis(redisConfig, {
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    if (times > 3) return null; // Stop retrying after 3 attempts to use fallback
    logger.warn(`Redis reconnecting... attempt ${times}, delay: ${delay}ms`);
    return delay;
  },
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
});

// ─── In-Memory Fallback ────────────────────────────────────────────────────────
const memoryStore = new Map();
let useFallback = false;

const redis = {
  get: async (key) => useFallback ? memoryStore.get(key) : redisClient.get(key),
  setEx: async (key, ttl, value) => {
    if (useFallback) {
      memoryStore.set(key, value);
      setTimeout(() => memoryStore.delete(key), ttl * 1000);
      return 'OK';
    }
    return redisClient.setex(key, ttl, value);
  },
  del: async (...keys) => {
    if (useFallback) {
      keys.forEach(k => memoryStore.delete(k));
      return keys.length;
    }
    return redisClient.del(...keys);
  },
  incr: async (key) => {
    if (useFallback) {
      const val = (memoryStore.get(key) || 0) + 1;
      memoryStore.set(key, val);
      return val;
    }
    return redisClient.incr(key);
  },
  expire: async (key, ttl) => {
    if (useFallback) {
      setTimeout(() => memoryStore.delete(key), ttl * 1000);
      return 1;
    }
    return redisClient.expire(key, ttl);
  },
  on: (event, cb) => redisClient.on(event, cb),
  quit: () => redisClient.quit(),
};

redisClient.on('connect', () => {
  logger.info('Redis connected');
  useFallback = false;
});
redisClient.on('error', (err) => {
  logger.error(`Redis error: ${err.message}. Using in-memory fallback.`);
  useFallback = true;
});
redisClient.on('ready', () => logger.info('Redis ready'));

// ─── Room State Helpers ────────────────────────────────────────────────────────

/**
 * Get full room state from Redis
 */
redis.getRoom = async (roomId) => {
  const data = await redis.get(`room:${roomId}`);
  return data ? JSON.parse(data) : null;
};

/**
 * Save full room state to Redis with TTL
 */
redis.saveRoom = async (roomId, roomState) => {
  // Rooms expire after 2 hours of inactivity
  await redis.setEx(`room:${roomId}`, 7200, JSON.stringify(roomState));
};

/**
 * Delete room from Redis
 */
redis.deleteRoom = async (roomId) => {
  await redis.del(`room:${roomId}`);
};

// ─── Game State Helpers ────────────────────────────────────────────────────────

/**
 * Get full game state (excludes private card data)
 */
redis.getGame = async (gameId) => {
  const data = await redis.get(`game:${gameId}`);
  return data ? JSON.parse(data) : null;
};

/**
 * Save full game state to Redis
 */
redis.saveGame = async (gameId, gameState) => {
  await redis.setEx(`game:${gameId}`, 7200, JSON.stringify(gameState));
};

/**
 * Get a specific player's private cards (never sent to other clients)
 */
redis.getPlayerCards = async (gameId, userId) => {
  const data = await redis.get(`game:${gameId}:cards:${userId}`);
  return data ? JSON.parse(data) : null;
};

/**
 * Save a player's private card data
 */
redis.savePlayerCards = async (gameId, userId, cards) => {
  await redis.setEx(`game:${gameId}:cards:${userId}`, 7200, JSON.stringify(cards));
};

/**
 * Delete all game card data (cleanup after game ends)
 */
redis.cleanupGame = async (gameId, playerIds) => {
  const keys = [`game:${gameId}`, ...playerIds.map(id => `game:${gameId}:cards:${id}`)];
  if (keys.length > 0) await redis.del(...keys);
};

module.exports = redis;
