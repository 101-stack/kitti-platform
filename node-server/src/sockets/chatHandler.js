/**
 * Chat Handler
 * Handles real-time messaging within rooms and globally in the lobby
 */
const logger = require('../utils/logger');

module.exports = (io, socket) => {
  const { userId, username } = socket.user;

  // ── ROOM CHAT ───────────────────────────────────────────────────────────────
  socket.on('send_room_message', ({ roomId, message }, callback) => {
    if (!message || message.trim().length === 0) return;
    
    // Limit message length
    const cleanMessage = message.trim().slice(0, 200);

    const payload = {
      id: Date.now().toString(),
      userId,
      username,
      message: cleanMessage,
      timestamp: Date.now(),
      type: 'user'
    };

    // Broadcast to everyone in the room
    io.to(roomId).emit('new_room_message', payload);
    
    logger.debug(`Chat [${roomId}]: ${username}: ${cleanMessage}`);
    callback?.({ success: true });
  });

  // ── LOBBY CHAT (Global) ─────────────────────────────────────────────────────
  socket.on('send_lobby_message', ({ message }, callback) => {
    if (!message || message.trim().length === 0) return;
    
    const cleanMessage = message.trim().slice(0, 200);

    const payload = {
      id: Date.now().toString(),
      userId,
      username,
      message: cleanMessage,
      timestamp: Date.now()
    };

    // Broadcast to the 'lobby' room
    io.to('lobby').emit('new_lobby_message', payload);
    
    callback?.({ success: true });
  });

  // Join global lobby room on connection
  socket.join('lobby');
};
