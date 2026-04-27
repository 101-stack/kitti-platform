/**
 * Kitti Platform - Node.js Real-Time Server
 * Handles Socket.IO connections and orchestrates game flow
 */
require('dotenv').config();

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const logger = require('./utils/logger');
const { authMiddleware } = require('./middlewares/authMiddleware');
const { rateLimitMiddleware } = require('./middlewares/rateLimitMiddleware');
const roomHandler = require('./sockets/roomHandler');
const gameHandler = require('./sockets/gameHandler');
const chatHandler = require('./sockets/chatHandler');
const redis = require('./services/redisService');

const app = express();
const server = http.createServer(app);

// ─── Express Middleware ────────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'kitti-node-server', timestamp: new Date().toISOString() });
});

// ─── Socket.IO Setup ───────────────────────────────────────────────────────────
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true,
  },
  pingTimeout: 60000,
  pingInterval: 25000,
  transports: ['websocket', 'polling'],
});

// ─── Socket.IO Authentication Middleware ──────────────────────────────────────
io.use(authMiddleware);
io.use(rateLimitMiddleware);

// ─── Socket.IO Connection Handler ─────────────────────────────────────────────
io.on('connection', (socket) => {
  const { userId, username } = socket.user;
  logger.info(`Player connected: ${username} (${userId}) | Socket: ${socket.id}`);

  // Register room, game and chat event handlers
  roomHandler(io, socket);
  gameHandler(io, socket);
  chatHandler(io, socket);

  // ── Disconnect Handler ───────────────────────────────────────────────────────
  socket.on('disconnecting', async (reason) => {
    logger.info(`Player disconnecting: ${username} | Reason: ${reason}`);
    // Notify all rooms this player was in
    const rooms = Array.from(socket.rooms).filter(r => r !== socket.id);
    for (const roomId of rooms) {
      io.to(roomId).emit('player_disconnect', {
        userId,
        username,
        reason,
        timestamp: Date.now(),
      });
      // Mark player as disconnected in room state
      const roomState = await redis.getRoom(roomId);
      if (roomState) {
        const p = roomState.players.find(p => p.userId === userId);
        if (p) {
          p.isConnected = false;
          await redis.saveRoom(roomId, roomState);
          io.to(roomId).emit('room_updated', roomState);
        }
      }
      // Grace period in Redis for cleanups
      await redis.setEx(`disconnect:${roomId}:${userId}`, 300, socket.id);
    }
  });

  socket.on('disconnect', (reason) => {
    logger.info(`Player disconnected: ${username} | Reason: ${reason}`);
  });

  // ── Error Handler ────────────────────────────────────────────────────────────
  socket.on('error', (err) => {
    logger.error(`Socket error for ${username}: ${err.message}`);
    socket.emit('error', { message: 'An internal error occurred.' });
  });
});

// ─── Graceful Shutdown ─────────────────────────────────────────────────────────
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received. Shutting down gracefully...');
  io.close();
  await redis.quit();
  server.close(() => {
    logger.info('Server closed.');
    process.exit(0);
  });
});

// ─── Start Server ──────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  logger.info(`🎴 Kitti Node Server running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = { app, server, io };
