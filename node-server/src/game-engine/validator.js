/**
 * Kitti Move Validator
 * Server-side validation to prevent cheating.
 * All validation happens here before any state mutation.
 */

/**
 * Validate that submitted sets are legal:
 * - Exactly 3 sets
 * - Each set has exactly 3 cards
 * - All 9 cards match the dealt hand (no substitutions)
 * - No duplicate cards
 *
 * @param {Object[]} sets - Array of 3 sets, each an array of 3 card objects
 * @param {Object[]} dealtCards - The 9 cards dealt to this player
 * @returns {{ valid: boolean, error?: string }}
 */
const validateSets = (sets, dealtCards) => {
  // 1. Must have exactly 3 sets
  if (!Array.isArray(sets) || sets.length !== 3) {
    return { valid: false, error: 'Must submit exactly 3 sets.' };
  }

  // 2. Each set must have exactly 3 cards
  for (let i = 0; i < sets.length; i++) {
    if (!Array.isArray(sets[i]) || sets[i].length !== 3) {
      return { valid: false, error: `Set ${i + 1} must contain exactly 3 cards.` };
    }
  }

  // 3. Extract all submitted card IDs
  const submittedIds = sets.flat().map(c => c.id);

  // 4. Check for no duplicate cards in submitted sets
  const uniqueIds = new Set(submittedIds);
  if (uniqueIds.size !== 9) {
    return { valid: false, error: 'Duplicate cards detected in submitted sets.' };
  }

  // 5. All submitted cards must come from dealt cards
  const dealtIdSet = new Set(dealtCards.map(c => c.id));
  for (const id of submittedIds) {
    if (!dealtIdSet.has(id)) {
      return {
        valid: false,
        error: `Card ID ${id} was not in the dealt hand. Possible cheating detected.`,
      };
    }
  }

  // 6. Every dealt card must be used (no missing cards)
  if (submittedIds.length !== 9) {
    return { valid: false, error: 'All 9 dealt cards must be distributed across sets.' };
  }

  return { valid: true };
};

/**
 * Validate that a player is allowed to perform an action in a room
 */
const validatePlayerInRoom = (roomState, userId) => {
  if (!roomState) return { valid: false, error: 'Room not found.' };
  const player = roomState.players?.find(p => p.userId === userId);
  if (!player) return { valid: false, error: 'Player not in this room.' };
  return { valid: true, player };
};

/**
 * Validate room join conditions
 */
const validateJoinRoom = (roomState, userId, isReconnecting = false) => {
  if (!roomState) return { valid: false, error: 'Room not found.' };
  
  if (isReconnecting) {
    // If reconnecting, bypass max players and coin checks since they already paid/joined
    return { valid: true };
  }

  if (roomState.status !== 'waiting') return { valid: false, error: 'Game already in progress.' };
  if (roomState.players.length >= roomState.maxPlayers) return { valid: false, error: 'Room is full.' };
  return { valid: true };
};

/**
 * Validate start game conditions
 */
const validateStartGame = (roomState, userId) => {
  if (!roomState) return { valid: false, error: 'Room not found.' };
  if (roomState.hostId !== userId) return { valid: false, error: 'Only the host can start the game.' };
  if (roomState.players.length < 1) return { valid: false, error: 'Need at least 1 player to start.' };
  if (roomState.status !== 'waiting') return { valid: false, error: 'Game already started.' };
  return { valid: true };
};

module.exports = {
  validateSets,
  validatePlayerInRoom,
  validateJoinRoom,
  validateStartGame,
};
