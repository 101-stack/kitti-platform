const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

/**
 * Socket.IO authentication middleware
 * Validates JWT token from handshake auth or query params
 */
const authMiddleware = (socket, next) => {
  try {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.replace('Bearer ', '') ||
      socket.handshake.query?.token;

    if (!token) {
      return next(new Error('AUTH_REQUIRED: No token provided'));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Attach user data to socket for use in handlers
    socket.user = {
      userId: decoded.sub || decoded.userId,
      username: decoded.username,
      email: decoded.email,
      coins: decoded.coins || 0,
    };

    logger.debug(`Socket auth OK for user: ${socket.user.username}`);
    next();
  } catch (err) {
    logger.warn(`Socket auth failed: ${err.message}`);
    if (err.name === 'TokenExpiredError') {
      return next(new Error('AUTH_EXPIRED: Token has expired'));
    }
    return next(new Error('AUTH_INVALID: Invalid token'));
  }
};

module.exports = { authMiddleware };
