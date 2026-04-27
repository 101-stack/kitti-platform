/**
 * Game Handler
 * Manages: start_game, deal_cards, submit_sets, round_result, game_result
 * Anti-cheat: cards are stored in Redis per-player, never broadcasted to all
 */
const { v4: uuidv4 } = require('uuid');
const redis = require('../services/redisService');
const fastapiService = require('../services/fastapiService');
const { dealCards, toClientCard } = require('../game-engine/deck');
const { evaluateAllSets } = require('../game-engine/evaluator');
const { validateSets, validatePlayerInRoom, validateStartGame } = require('../game-engine/validator');
const { solveGreedy } = require('../game-engine/botAI');
const logger = require('../utils/logger');

const SUBMIT_TIMEOUT_MS = parseInt(process.env.SUBMIT_TIMEOUT_MS) || 60000; // 60s to submit

module.exports = (io, socket) => {
  const { userId, username } = socket.user;

  // ── START GAME ──────────────────────────────────────────────────────────────
  socket.on('start_game', async ({ roomId }, callback) => {
    try {
      let roomState = await redis.getRoom(roomId);
      const validation = validateStartGame(roomState, userId);
      if (!validation.valid) {
        return callback?.({ success: false, error: validation.error });
      }

      // ── Fill with bots if needed ───────────────────────────────────────────
      const botsNeeded = roomState.maxPlayers - roomState.players.length;
      const gameBots = [];
      for (let i = 0; i < botsNeeded; i++) {
        gameBots.push({
          userId: `bot_${uuidv4().slice(0, 8)}`,
          username: `Bot ${['Pro', 'Alpha', 'Shadow', 'Ace', 'Ghost'][Math.floor(Math.random() * 5)]} ${i + 1}`,
          isReady: true,
          isConnected: true,
          isBot: true
        });
      }

      const allPlayers = [...roomState.players, ...gameBots];
      const playerIds = allPlayers.map(p => p.userId);
      const gameId = uuidv4();

      // ── Deal cards (server-side only) ──────────────────────────────────────
      const { playerHands } = dealCards(playerIds);

      // Store each player's cards privately in Redis
      for (const [pid, hand] of Object.entries(playerHands)) {
        await redis.savePlayerCards(gameId, pid, hand);
      }

      // Create game state
      const gameState = {
        gameId,
        roomId,
        status: 'dealing',
        players: allPlayers.map(p => ({
          userId: p.userId,
          username: p.username,
          isBot: p.isBot || false,
          hasSubmitted: false,
          submittedAt: null,
        })),
        options: roomState.options,
        entryFee: roomState.entryFee,
        totalPot: allPlayers.length * roomState.entryFee,
        startedAt: Date.now(),
        submitDeadline: Date.now() + SUBMIT_TIMEOUT_MS,
        rounds: [],
      };

      await redis.saveGame(gameId, gameState);

      // Update room status
      roomState.status = 'playing';
      roomState.currentGameId = gameId;
      await redis.saveRoom(roomId, roomState);

      // Notify all players game is starting
      io.to(roomId).emit('game_started', {
        gameId,
        players: gameState.players,
        submitDeadline: gameState.submitDeadline,
      });

      // Send cards to real players
      for (const player of roomState.players) {
        const hand = playerHands[player.userId];
        const targetSocket = _findSocket(io, roomId, player.userId);
        if (targetSocket) {
          targetSocket.emit('deal_cards', {
            gameId,
            cards: hand.map(toClientCard),
            submitDeadline: gameState.submitDeadline,
          });
        }
      }

      // ── Bot Turn ───────────────────────────────────────────────────────────
      if (gameBots.length > 0) {
        _handleBotTurns(io, gameId, gameBots, playerHands);
      }

      // Set auto-submit timeout
      setTimeout(() => _handleSubmitTimeout(io, gameId, roomId), SUBMIT_TIMEOUT_MS + 5000);

      logger.info(`Game ${gameId} started in room ${roomId} with ${allPlayers.length} players (${gameBots.length} bots)`);
      callback?.({ success: true, gameId });
    } catch (err) {
      logger.error(`start_game error: ${err.message}`, { stack: err.stack });
      callback?.({ success: false, error: err.message });
    }
  });

  // ── SUBMIT SETS ─────────────────────────────────────────────────────────────
  socket.on('submit_sets', async ({ gameId, sets }, callback) => {
    try {
      const gameState = await redis.getGame(gameId);
      if (!gameState) return callback?.({ success: false, error: 'Game not found.' });
      if (gameState.status !== 'dealing' && gameState.status !== 'submitting') {
        return callback?.({ success: false, error: 'Not accepting submissions.' });
      }

      // Check player is in game
      const player = gameState.players.find(p => p.userId === userId);
      if (!player) return callback?.({ success: false, error: 'Not in this game.' });
      if (player.hasSubmitted) return callback?.({ success: false, error: 'Already submitted.' });

      // Check deadline
      if (Date.now() > gameState.submitDeadline) {
        return callback?.({ success: false, error: 'Submission deadline passed.' });
      }

      // ── Anti-Cheat: Validate submitted sets against dealt cards ──────────────
      const dealtCards = await redis.getPlayerCards(gameId, userId);
      if (!dealtCards) return callback?.({ success: false, error: 'Card data not found.' });

      const validation = validateSets(sets, dealtCards);
      if (!validation.valid) {
        logger.warn(`Anti-cheat: ${username} failed validation: ${validation.error}`);
        return callback?.({ success: false, error: validation.error });
      }

      // Store submission
      player.hasSubmitted = true;
      player.submittedAt = Date.now();
      player.sets = sets; // Store for evaluation

      gameState.status = 'submitting';
      await redis.saveGame(gameId, gameState);

      // Notify room that this player has submitted (don't reveal sets)
      io.to(gameState.roomId).emit('player_submitted', {
        userId,
        username,
        submittedAt: player.submittedAt,
        playersSubmitted: gameState.players.filter(p => p.hasSubmitted).length,
        totalPlayers: gameState.players.length,
      });

      logger.info(`${username} submitted sets for game ${gameId}`);
      callback?.({ success: true });

      // Check if all players have submitted
      const allSubmitted = gameState.players.every(p => p.hasSubmitted);
      if (allSubmitted) {
        await _evaluateAndFinish(io, gameId, gameState);
      }
    } catch (err) {
      logger.error(`submit_sets error: ${err.message}`);
      callback?.({ success: false, error: err.message });
    }
  });

  // ── REQUEST RECONNECT DATA ──────────────────────────────────────────────────
  socket.on('reconnect_game', async ({ gameId }, callback) => {
    try {
      const gameState = await redis.getGame(gameId);
      if (!gameState) return callback?.({ success: false, error: 'Game not found.' });

      const player = gameState.players.find(p => p.userId === userId);
      if (!player) return callback?.({ success: false, error: 'Not in this game.' });

      // Re-send their private cards if game is still active
      const dealtCards = await redis.getPlayerCards(gameId, userId);

      callback?.({
        success: true,
        gameState: _sanitizeGameState(gameState, userId),
        myCards: dealtCards?.map(toClientCard) || null,
      });
    } catch (err) {
      logger.error(`reconnect_game error: ${err.message}`);
      callback?.({ success: false, error: err.message });
    }
  });

  // ── REQUEST SUGGESTED SETS (Helper) ────────────────────────────────────────
  socket.on('request_suggested_sets', async ({ gameId }, callback) => {
    try {
      const dealtCards = await redis.getPlayerCards(gameId, userId);
      if (!dealtCards) return callback?.({ success: false, error: 'Cards not found.' });

      const suggestedSets = solveGreedy(dealtCards);
      callback?.({ success: true, sets: suggestedSets.map(set => set.map(toClientCard)) });
    } catch (err) {
      callback?.({ success: false, error: err.message });
    }
  });
};

// ─── Bot Helpers ──────────────────────────────────────────────────────────────

/**
 * Handle bot submissions automatically
 */
async function _handleBotTurns(io, gameId, bots, playerHands) {
  for (const bot of bots) {
    // Randomized delay for "thinking"
    const delay = Math.floor(Math.random() * 10000) + 5000; // 5-15s
    
    setTimeout(async () => {
      try {
        const gameState = await redis.getGame(gameId);
        if (!gameState || gameState.status === 'complete') return;

        const botHand = playerHands[bot.userId];
        if (!botHand) return;

        const sets = solveGreedy(botHand);
        
        // Update bot in game state
        const botPlayer = gameState.players.find(p => p.userId === bot.userId);
        if (botPlayer && !botPlayer.hasSubmitted) {
          botPlayer.hasSubmitted = true;
          botPlayer.submittedAt = Date.now();
          botPlayer.sets = sets;
          
          await redis.saveGame(gameId, gameState);
          
          // Notify room
          io.to(gameState.roomId).emit('player_submitted', {
            userId: bot.userId,
            username: bot.username,
            submittedAt: botPlayer.submittedAt,
            playersSubmitted: gameState.players.filter(p => p.hasSubmitted).length,
            totalPlayers: gameState.players.length,
            isBot: true
          });

          // Check if all finished
          const allSubmitted = gameState.players.every(p => p.hasSubmitted);
          if (allSubmitted) {
            await _evaluateAndFinish(io, gameId, gameState);
          }
        }
      } catch (err) {
        logger.error(`Bot turn error for ${bot.username}: ${err.message}`);
      }
    }, delay);
  }
}

// ─── Private Helpers ───────────────────────────────────────────────────────────

/**
 * Evaluate all player sets and distribute winnings
 */
async function _evaluateAndFinish(io, gameId, gameState) {
  try {
    gameState.status = 'evaluating';
    await redis.saveGame(gameId, gameState);

    // Build player sets for evaluation
    const playerSets = gameState.players
      .filter(p => p.hasSubmitted && p.sets)
      .map(p => ({ userId: p.userId, username: p.username, sets: p.sets }));

    const result = evaluateAllSets(playerSets, gameState.options);

    // Determine winnings
    const { overallWinner, setResults, pointsMap, isTie } = result;
    const totalPot = gameState.totalPot;

    // Award winnings
    if (overallWinner && !isTie) {
      await fastapiService.processTransaction(overallWinner, totalPot, 'credit', gameId);
    }

    // Save match to PostgreSQL
    const playerResults = gameState.players.map(p => ({
      userId: p.userId,
      setsWon: pointsMap[p.userId] || 0,
      isWinner: p.userId === overallWinner && !isTie,
    }));

    await fastapiService.saveMatchResult(
      gameState.roomId,
      isTie ? null : overallWinner,
      playerResults,
      totalPot
    );

    // Update game state
    gameState.status = 'complete';
    gameState.result = { overallWinner, setResults, pointsMap, isTie, totalPot };
    gameState.completedAt = Date.now();
    await redis.saveGame(gameId, gameState);

    // Emit results to room
    io.to(gameState.roomId).emit('game_result', {
      gameId,
      overallWinner,
      isTie,
      setResults,
      pointsMap,
      totalPot,
      playerSets: playerSets.map(p => ({
        userId: p.userId,
        username: p.username,
        sets: p.sets, // Now safe to reveal all cards
      })),
    });

    // Update room status back to waiting
    const roomState = await redis.getRoom(gameState.roomId);
    if (roomState) {
      roomState.status = 'waiting';
      roomState.currentGameId = null;
      roomState.players.forEach(p => { p.isReady = false; });
      await redis.saveRoom(gameState.roomId, roomState);
      io.to(gameState.roomId).emit('room_updated', roomState);
    }

    // Schedule cleanup
    setTimeout(() => redis.cleanupGame(gameId, playerSets.map(p => p.userId)), 30000);
    logger.info(`Game ${gameId} complete. Winner: ${overallWinner || 'TIE'}`);
  } catch (err) {
    logger.error(`_evaluateAndFinish error: ${err.message}`);
    io.to(gameState.roomId).emit('error', { message: 'Error evaluating game. Please contact support.' });
  }
}

/**
 * Handle players who didn't submit in time
 */
async function _handleSubmitTimeout(io, gameId, roomId) {
  try {
    const gameState = await redis.getGame(gameId);
    if (!gameState || gameState.status === 'complete') return;

    const nonSubmitters = gameState.players.filter(p => !p.hasSubmitted);
    if (nonSubmitters.length === 0) return; // Everyone submitted already

    logger.info(`Submit timeout for game ${gameId}. Auto-folding ${nonSubmitters.length} players.`);

    // Remove non-submitters from evaluation
    gameState.players = gameState.players.filter(p => p.hasSubmitted);

    if (gameState.players.length < 1) {
      // Not enough players — refund everyone and cancel
      io.to(roomId).emit('game_cancelled', { reason: 'No players submitted.' });
      gameState.status = 'cancelled';
      await redis.saveGame(gameId, gameState);
      return;
    }

    io.to(roomId).emit('players_timed_out', {
      timedOut: nonSubmitters.map(p => ({ userId: p.userId, username: p.username })),
    });

    await _evaluateAndFinish(io, gameId, gameState);
  } catch (err) {
    logger.error(`_handleSubmitTimeout error: ${err.message}`);
  }
}

/**
 * Find a socket by userId in a room
 */
function _findSocket(io, roomId, targetUserId) {
  const room = io.sockets.adapter.rooms.get(roomId);
  if (!room) return null;
  for (const socketId of room) {
    const s = io.sockets.sockets.get(socketId);
    if (s?.user?.userId === targetUserId) return s;
  }
  return null;
}

/**
 * Return game state safe for a specific player (no other players' cards)
 */
function _sanitizeGameState(gameState, requestingUserId) {
  return {
    ...gameState,
    players: gameState.players.map(p => ({
      userId: p.userId,
      username: p.username,
      hasSubmitted: p.hasSubmitted,
      submittedAt: p.submittedAt,
      // Never expose other players' sets
      sets: p.userId === requestingUserId ? p.sets : undefined,
    })),
  };
}
