const redis = require('../services/redisService');
const logger = require('../utils/logger');

/**
 * Rate limiting middleware for Socket.IO
 * Prevents event spam and brute-force attacks
 */
const rateLimitMiddleware = async (socket, next) => {
  try {
    const userId = socket.user?.userId;
    if (!userId) return next();

    const key = `ratelimit:connect:${userId}`;
    const count = await redis.incr(key);

    if (count === 1) {
      // First request — set 60s window
      await redis.expire(key, 60);
    }

    if (count > 10) {
      logger.warn(`Rate limit exceeded for userId: ${userId}`);
      return next(new Error('RATE_LIMIT: Too many connections. Please wait.'));
    }

    next();
  } catch (err) {
    // Don't block connection on Redis error — log and proceed
    logger.error(`Rate limit middleware error: ${err.message}`);
    next();
  }
};

module.exports = { rateLimitMiddleware };
