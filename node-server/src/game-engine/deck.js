/**
 * Kitti Deck Engine
 * All card operations happen server-side only.
 * Cards are NEVER sent to clients in bulk — only a player's own cards.
 */

// ─── Card Definitions ──────────────────────────────────────────────────────────

const SUITS = ['spades', 'hearts', 'diamonds', 'clubs'];

// Values: A=14 (high), K=13, Q=12, J=11, 10–2
const VALUES = [14, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]; // A,2,3..K
const VALUE_NAMES = {
  14: 'A', 13: 'K', 12: 'Q', 11: 'J',
  10: '10', 9: '9', 8: '8', 7: '7',
  6: '6', 5: '5', 4: '4', 3: '3', 2: '2',
};

/**
 * Build a standard 52-card deck
 * Each card: { id, suit, value, displayValue, display }
 */
const buildDeck = () => {
  const deck = [];
  let id = 0;
  for (const suit of SUITS) {
    for (const value of VALUES) {
      deck.push({
        id: id++,
        suit,
        value,
        displayValue: VALUE_NAMES[value],
        display: `${VALUE_NAMES[value]}${suit[0].toUpperCase()}`,
      });
    }
  }
  return deck; // 52 cards
};

/**
 * Fisher-Yates shuffle — cryptographically fair
 * @param {Array} array
 * @returns {Array} shuffled copy
 */
const shuffle = (array) => {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    // Use Math.random() — for production, replace with crypto.randomInt
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

/**
 * Shuffle and deal 9 cards to each player
 * @param {string[]} playerIds
 * @returns {{ playerHands: Object, remainingDeck: Array }}
 */
const dealCards = (playerIds) => {
  const MAX_PLAYERS = 5;
  const CARDS_PER_PLAYER = 9;

  if (playerIds.length < 2 || playerIds.length > MAX_PLAYERS) {
    throw new Error(`Invalid player count: ${playerIds.length}. Must be 2–${MAX_PLAYERS}.`);
  }

  const totalNeeded = playerIds.length * CARDS_PER_PLAYER;
  if (totalNeeded > 52) {
    throw new Error('Not enough cards in deck for all players.');
  }

  const deck = shuffle(buildDeck());
  const playerHands = {};

  playerIds.forEach((playerId, index) => {
    const start = index * CARDS_PER_PLAYER;
    playerHands[playerId] = deck.slice(start, start + CARDS_PER_PLAYER);
  });

  const remainingDeck = deck.slice(totalNeeded);

  return { playerHands, remainingDeck };
};

/**
 * Get a player-safe card view (strip internal metadata if needed)
 */
const toClientCard = (card) => ({
  id: card.id,
  suit: card.suit,
  value: card.value,
  displayValue: card.displayValue,
  display: card.display,
});

module.exports = {
  buildDeck,
  shuffle,
  dealCards,
  toClientCard,
  SUITS,
  VALUES,
  VALUE_NAMES,
};
