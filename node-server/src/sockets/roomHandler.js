/**
 * Room Handler
 * Manages: create_room, join_room, leave_room, get_room_state
 */
const { v4: uuidv4 } = require('uuid');
const redis = require('../services/redisService');
const fastapiService = require('../services/fastapiService');
const { validateJoinRoom, validatePlayerInRoom } = require('../game-engine/validator');
const logger = require('../utils/logger');

const ENTRY_FEE = parseInt(process.env.GAME_ENTRY_FEE) || 100;
const MAX_PLAYERS = 5;

module.exports = (io, socket) => {
  const { userId, username } = socket.user;

  // ── CREATE ROOM ─────────────────────────────────────────────────────────────
  socket.on('create_room', async (data, callback) => {
    try {
      const { maxPlayers = 2, enable235Rule = false, entryFee = ENTRY_FEE } = data || {};

      if (maxPlayers < 2 || maxPlayers > MAX_PLAYERS) {
        return callback?.({ success: false, error: 'Max players must be 2–5.' });
      }

      const roomId = uuidv4().slice(0, 8).toUpperCase(); // Short room code e.g. "A3F9B2C1"

      const roomState = {
        roomId,
        hostId: userId,
        status: 'waiting', // waiting | playing | finished
        maxPlayers,
        entryFee,
        options: { enable235Rule },
        players: [{ userId, username, isReady: false, isConnected: true }],
        createdAt: Date.now(),
      };

      await redis.saveRoom(roomId, roomState);
      socket.join(roomId);

      logger.info(`Room created: ${roomId} by ${username}`);

      callback?.({ success: true, roomId, roomState });
      io.to(roomId).emit('room_updated', roomState);
    } catch (err) {
      logger.error(`create_room error: ${err.message}`);
      callback?.({ success: false, error: err.message });
    }
  });

  // ── JOIN ROOM ───────────────────────────────────────────────────────────────
  socket.on('join_room', async ({ roomId }, callback) => {
    try {
      const roomState = await redis.getRoom(roomId);
      
      // Check if player is already in the room (reconnecting)
      const existingPlayer = roomState?.players?.find(p => p.userId === userId);
      
      const validation = validateJoinRoom(roomState, userId, !!existingPlayer);

      if (!validation.valid) {
        return callback?.({ success: false, error: validation.error });
      }

      if (existingPlayer) {
        // Reconnecting: just update status, no entry fee charged
        existingPlayer.isConnected = true;
      } else {
        roomState.players.push({ userId, username, isReady: false, isConnected: true });
      }
      
      await redis.saveRoom(roomId, roomState);
      socket.join(roomId);

      logger.info(`${username} joined room ${roomId}`);

      callback?.({ success: true, roomState });
      io.to(roomId).emit('player_joined', { userId, username, roomState });
    } catch (err) {
      logger.error(`join_room error: ${err.message}`);
      callback?.({ success: false, error: err.message });
    }
  });

  // ── LEAVE ROOM ──────────────────────────────────────────────────────────────
  socket.on('leave_room', async ({ roomId }, callback) => {
    try {
      const roomState = await redis.getRoom(roomId);
      const { valid } = validatePlayerInRoom(roomState, userId);
      if (!valid) return callback?.({ success: false, error: 'Not in this room.' });

      // Remove player
      roomState.players = roomState.players.filter(p => p.userId !== userId);
      socket.leave(roomId);

      if (roomState.players.length === 0) {
        // Last player left — delete room
        await redis.deleteRoom(roomId);
        logger.info(`Room ${roomId} deleted (empty)`);
      } else {
        // Transfer host if host left
        if (roomState.hostId === userId) {
          roomState.hostId = roomState.players[0].userId;
          logger.info(`Room ${roomId} host transferred to ${roomState.players[0].username}`);
        }
        await redis.saveRoom(roomId, roomState);
        io.to(roomId).emit('player_left', { userId, username, newHostId: roomState.hostId, roomState });
      }

      callback?.({ success: true });
    } catch (err) {
      logger.error(`leave_room error: ${err.message}`);
      callback?.({ success: false, error: err.message });
    }
  });

  // ── GET ROOM STATE ──────────────────────────────────────────────────────────
  socket.on('get_room_state', async ({ roomId }, callback) => {
    try {
      const roomState = await redis.getRoom(roomId);
      if (!roomState) return callback?.({ success: false, error: 'Room not found.' });
      callback?.({ success: true, roomState });
    } catch (err) {
      logger.error(`get_room_state error: ${err.message}`);
      callback?.({ success: false, error: err.message });
    }
  });

  // ── PLAYER READY ────────────────────────────────────────────────────────────
  socket.on('player_ready', async ({ roomId }, callback) => {
    try {
      const roomState = await redis.getRoom(roomId);
      const { valid, player } = validatePlayerInRoom(roomState, userId);
      if (!valid) return callback?.({ success: false, error: 'Not in this room.' });

      player.isReady = !player.isReady; // Toggle
      await redis.saveRoom(roomId, roomState);

      io.to(roomId).emit('room_updated', roomState);
      callback?.({ success: true, isReady: player.isReady });
    } catch (err) {
      logger.error(`player_ready error: ${err.message}`);
      callback?.({ success: false, error: err.message });
    }
  });
};
