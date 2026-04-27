/**
 * Kitti Bot AI
 * Strategies for arranging 9 cards into 3 sets
 */
const { evaluateHand, compareHands } = require('./evaluator');

/**
 * Greedy Strategy: Find the best possible hand from available cards, repeat.
 * @param {Object[]} cards - 9 card objects
 * @returns {Object[][]} - Array of 3 sets, each with 3 cards
 */
const solveGreedy = (cards) => {
  const remaining = [...cards];
  const sets = [];

  for (let i = 0; i < 3; i++) {
    const bestHand = _findBestHand(remaining);
    sets.push(bestHand);
    // Remove selected cards from remaining
    const selectedIds = new Set(bestHand.map(c => c.id));
    for (let j = remaining.length - 1; j >= 0; j--) {
      if (selectedIds.has(remaining[j].id)) {
        remaining.splice(j, 1);
      }
    }
  }

  return sets;
};

/**
 * Finds the best 3-card hand from a pool of cards
 */
const _findBestHand = (pool) => {
  let best = null;
  let bestEval = null;

  // Simple brute force for 3-card combinations from pool
  for (let i = 0; i < pool.length; i++) {
    for (let j = i + 1; j < pool.length; j++) {
      for (let k = j + 1; k < pool.length; k++) {
        const hand = [pool[i], pool[j], pool[k]];
        const currentEval = evaluateHand(hand);
        
        if (!best || compareHands(currentEval, bestEval) > 0) {
          best = hand;
          bestEval = currentEval;
        }
      }
    }
  }
  return best;
};

module.exports = {
  solveGreedy
};
